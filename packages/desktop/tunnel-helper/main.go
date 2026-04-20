// MelNet Tunnel Helper — Creates a real TUN interface via wintun and bridges
// packets between the virtual network interface and the UDP relay.
//
// Requires administrator privileges and wintun.dll in the same directory.
//
// IPC protocol (stdin/stdout, newline-delimited JSON):
//   Electron → Helper: {"type":"start","virtualIp":"10.0.1.2","subnet":"255.255.255.0","relayHost":"...","relayPort":4242}
//   Electron → Helper: {"type":"stop"}
//   Helper → Electron: {"type":"started","virtualIp":"10.0.1.2"}
//   Helper → Electron: {"type":"stopped"}
//   Helper → Electron: {"type":"error","message":"..."}

package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"os"
	"os/exec"
	"os/signal"
	"sync"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.zx2c4.com/wintun"
)

type Message struct {
	Type      string `json:"type"`
	VirtualIP string `json:"virtualIp,omitempty"`
	Subnet    string `json:"subnet,omitempty"`
	RelayHost string `json:"relayHost,omitempty"`
	RelayPort int    `json:"relayPort,omitempty"`
	TunnelKey string `json:"tunnelKey,omitempty"`
	Msg       string `json:"message,omitempty"`
}

var (
	encoder *json.Encoder
	mu      sync.Mutex
)

func send(msg Message) {
	mu.Lock()
	defer mu.Unlock()
	encoder.Encode(msg)
}

func sendErr(s string) {
	send(Message{Type: "error", Msg: s})
}

func main() {
	encoder = json.NewEncoder(os.Stdout)
	log.SetOutput(os.Stderr)

	// Clean up any leftover adapter from a previous crash
	if old, err := wintun.OpenAdapter("MelNet"); err == nil && old != nil {
		log.Println("cleaning up leftover MelNet adapter")
		old.Close()
	}

	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)

	var adapter *wintun.Adapter
	var session wintun.Session
	var relay *net.UDPConn
	var stopCh chan struct{}
	var wg sync.WaitGroup

	// Cleanup on any exit (crash, SIGTERM, stdin close, etc.)
	cleanup := func() {
		if stopCh != nil {
			select {
			case <-stopCh:
			default:
				close(stopCh)
			}
			wg.Wait()
		}
		if relay != nil {
			relay.Close()
			relay = nil
		}
		if adapter != nil {
			session.End()
			adapter.Close()
			adapter = nil
			log.Println("adapter cleaned up")
		}
	}
	defer cleanup()

	// Also handle OS signals
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigCh
		log.Println("signal received, cleaning up")
		cleanup()
		os.Exit(0)
	}()

	for scanner.Scan() {
		var msg Message
		if err := json.Unmarshal(scanner.Bytes(), &msg); err != nil {
			sendErr(fmt.Sprintf("invalid JSON: %v", err))
			continue
		}

		switch msg.Type {
		case "start":
			if adapter != nil {
				sendErr("already running")
				continue
			}

			// Delete any leftover adapter from previous crash
			existingAdapter, err := wintun.OpenAdapter("MelNet")
			if err == nil && existingAdapter != nil {
				existingAdapter.Close()
			}

			// Create wintun adapter
			adapter, err = wintun.CreateAdapter("MelNet", "MelNet", nil)
			if err != nil {
				sendErr(fmt.Sprintf("failed to create adapter: %v", err))
				adapter = nil
				continue
			}

			// Get the LUID and configure IP via netsh
			luid := adapter.LUID()
			_ = luid

			// Configure IP address using netsh (most reliable on Windows)
			cmd := exec.Command("netsh", "interface", "ip", "set", "address",
				"MelNet", "static", msg.VirtualIP, msg.Subnet)
			if out, err := cmd.CombinedOutput(); err != nil {
				log.Printf("netsh set address: %s", string(out))
				// Try add instead
				cmd2 := exec.Command("netsh", "interface", "ip", "add", "address",
					"MelNet", msg.VirtualIP, msg.Subnet)
				if out2, err2 := cmd2.CombinedOutput(); err2 != nil {
					sendErr(fmt.Sprintf("failed to set IP: %s / %s", string(out), string(out2)))
					adapter.Close()
					adapter = nil
					continue
				}
			}

			// Set interface metric to high priority so games prefer it
			exec.Command("netsh", "interface", "ip", "set", "interface",
				"MelNet", "metric=1").Run()

			// Start wintun session
			session, err = adapter.StartSession(0x400000) // 4MB ring buffer
			if err != nil {
				sendErr(fmt.Sprintf("failed to start session: %v", err))
				adapter.Close()
				adapter = nil
				continue
			}

			// Connect to relay
			relayAddr, err := net.ResolveUDPAddr("udp", fmt.Sprintf("%s:%d", msg.RelayHost, msg.RelayPort))
			if err != nil {
				sendErr(fmt.Sprintf("failed to resolve relay: %v", err))
				session.End()
				adapter.Close()
				adapter = nil
				continue
			}

			relay, err = net.DialUDP("udp", nil, relayAddr)
			if err != nil {
				sendErr(fmt.Sprintf("failed to connect relay: %v", err))
				session.End()
				adapter.Close()
				adapter = nil
				continue
			}

			stopCh = make(chan struct{})

			// TUN → Relay: read packets from wintun, forward to relay
			wg.Add(1)
			go func() {
				defer wg.Done()
				for {
					select {
					case <-stopCh:
						return
					default:
					}

					pkt, err := session.ReceivePacket()
					if err != nil {
						select {
						case <-stopCh:
							return
						default:
							// Wait for readable event
							readWait := session.ReadWaitEvent()
							windows.WaitForSingleObject(readWait, 250)
							continue
						}
					}

					if len(pkt) < 20 {
						session.ReleaseReceivePacket(pkt)
						continue
					}

					// Build relay packet: [4 bytes dst IP][raw IP packet]
					dstIP := pkt[16:20]
					relayPkt := make([]byte, 4+len(pkt))
					copy(relayPkt[0:4], dstIP)
					copy(relayPkt[4:], pkt)
					session.ReleaseReceivePacket(pkt)

					relay.Write(relayPkt)
				}
			}()

			// Relay → TUN: receive packets from relay, inject into wintun
			wg.Add(1)
			go func() {
				defer wg.Done()
				buf := make([]byte, 65536)
				for {
					select {
					case <-stopCh:
						return
					default:
					}

					n, err := relay.Read(buf)
					if err != nil {
						select {
						case <-stopCh:
							return
						default:
							log.Printf("relay read: %v", err)
							continue
						}
					}

					if n <= 4 {
						continue
					}

					// Strip 4-byte header, write raw IP packet to TUN
					ipPkt := buf[4:n]
					pktBuf, err := session.AllocateSendPacket(len(ipPkt))
					if err != nil {
						continue
					}
					copy(pktBuf, ipPkt)
					session.SendPacket(pktBuf)
				}
			}()

			log.Printf("tunnel started: %s/%s via %s:%d", msg.VirtualIP, msg.Subnet, msg.RelayHost, msg.RelayPort)
			send(Message{Type: "started", VirtualIP: msg.VirtualIP})

		case "stop":
			if stopCh != nil {
				close(stopCh)
				wg.Wait()
			}
			if relay != nil {
				relay.Close()
				relay = nil
			}
			if adapter != nil {
				session.End()
				adapter.Close()
				adapter = nil
			}
			log.Println("tunnel stopped")
			send(Message{Type: "stopped"})
		}
	}
}

// Ensure wintun.dll is loaded from the same directory as the executable
func init() {
	// Get the directory of the current executable
	exePath, err := os.Executable()
	if err != nil {
		return
	}
	dir := exePath[:len(exePath)-len("tunnel-helper.exe")]
	dllPath := dir + "wintun.dll"

	// Check if wintun.dll exists in the exe directory
	if _, err := os.Stat(dllPath); err == nil {
		// Set DLL directory so wintun.dll is found
		kernel32 := windows.NewLazySystemDLL("kernel32.dll")
		setDllDir := kernel32.NewProc("SetDllDirectoryW")
		dirW, _ := windows.UTF16PtrFromString(dir)
		setDllDir.Call(uintptr(unsafe.Pointer(dirW)))
	}
}
