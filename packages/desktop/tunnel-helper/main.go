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
	"time"
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

	// Clean up leftover adapter
	if old, err := wintun.OpenAdapter("MelNet"); err == nil && old != nil {
		log.Println("cleaning up leftover adapter")
		old.Close()
		time.Sleep(500 * time.Millisecond)
	}

	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)

	var adapter *wintun.Adapter
	var session wintun.Session
	var relay *net.UDPConn
	var stopCh chan struct{}
	var wg sync.WaitGroup

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

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigCh
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

			log.Println("creating wintun adapter...")
			var err error
			adapter, err = wintun.CreateAdapter("MelNet", "MelNet", nil)
			if err != nil {
				sendErr(fmt.Sprintf("failed to create adapter: %v", err))
				adapter = nil
				continue
			}
			log.Println("adapter created")

			// Configure IP (run in background, don't block)
			log.Printf("configuring IP %s/%s...", msg.VirtualIP, msg.Subnet)
			cmd := exec.Command("netsh", "interface", "ip", "set", "address",
				"MelNet", "static", msg.VirtualIP, msg.Subnet)
			if out, err := cmd.CombinedOutput(); err != nil {
				log.Printf("netsh set: %s (trying add)", string(out))
				cmd2 := exec.Command("netsh", "interface", "ip", "add", "address",
					"MelNet", msg.VirtualIP, msg.Subnet)
				if out2, err2 := cmd2.CombinedOutput(); err2 != nil {
					sendErr(fmt.Sprintf("failed to set IP: %s", string(out2)))
					adapter.Close()
					adapter = nil
					continue
				}
			}
			log.Println("IP configured")

			// Start session
			session, err = adapter.StartSession(0x400000)
			if err != nil {
				sendErr(fmt.Sprintf("failed to start session: %v", err))
				adapter.Close()
				adapter = nil
				continue
			}
			log.Println("session started")

			// Send started IMMEDIATELY — relay connection happens in background
			send(Message{Type: "started", VirtualIP: msg.VirtualIP})

			stopCh = make(chan struct{})

			// Connect to relay in background
			wg.Add(1)
			go func(relayHost string, relayPort int, virtualIPStr string) {
				defer wg.Done()

				log.Printf("resolving relay %s:%d...", relayHost, relayPort)
				relayAddr, err := net.ResolveUDPAddr("udp", fmt.Sprintf("%s:%d", relayHost, relayPort))
				if err != nil {
					log.Printf("relay resolve failed: %v", err)
					return
				}

				conn, err := net.DialUDP("udp", nil, relayAddr)
				if err != nil {
					log.Printf("relay connect failed: %v", err)
					return
				}
				relay = conn
				log.Println("relay connected")

				// Send registration packet: [0xFF 0xFF 0xFF 0xFF][4 bytes virtual IP]
				virtualIP := net.ParseIP(virtualIPStr).To4()
				if virtualIP != nil {
					regPkt := make([]byte, 8)
					regPkt[0] = 0xFF
					regPkt[1] = 0xFF
					regPkt[2] = 0xFF
					regPkt[3] = 0xFF
					copy(regPkt[4:8], virtualIP)
					relay.Write(regPkt)
					log.Printf("registered with relay as %s", virtualIPStr)
				}

				// TUN → Relay
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
								readWait := session.ReadWaitEvent()
								windows.WaitForSingleObject(readWait, 100)
								continue
							}
						}
						if len(pkt) < 20 {
							session.ReleaseReceivePacket(pkt)
							continue
						}
						dstIP := pkt[16:20]
						relayPkt := make([]byte, 4+len(pkt))
						copy(relayPkt[0:4], dstIP)
						copy(relayPkt[4:], pkt)
						session.ReleaseReceivePacket(pkt)
						if relay != nil {
							relay.Write(relayPkt)
						}
					}
				}()

				// Relay → TUN
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
						relay.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
						n, err := relay.Read(buf)
						if err != nil {
							select {
							case <-stopCh:
								return
							default:
								continue
							}
						}
						if n <= 4 {
							continue
						}
						ipPkt := buf[4:n]
						pktBuf, err := session.AllocateSendPacket(len(ipPkt))
						if err != nil {
							continue
						}
						copy(pktBuf, ipPkt)
						session.SendPacket(pktBuf)
					}
				}()
			}(msg.RelayHost, msg.RelayPort, msg.VirtualIP)

		case "stop":
			cleanup()
			stopCh = nil
			send(Message{Type: "stopped"})
		}
	}
}

func init() {
	exePath, err := os.Executable()
	if err != nil {
		return
	}
	dir := exePath[:len(exePath)-len("tunnel-helper.exe")]
	dllPath := dir + "wintun.dll"
	if _, err := os.Stat(dllPath); err == nil {
		kernel32 := windows.NewLazySystemDLL("kernel32.dll")
		setDllDir := kernel32.NewProc("SetDllDirectoryW")
		dirW, _ := windows.UTF16PtrFromString(dir)
		setDllDir.Call(uintptr(unsafe.Pointer(dirW)))
	}
}
