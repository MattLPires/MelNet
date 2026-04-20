// MelNet UDP Relay — Simple packet forwarder for virtual LAN.
//
// Protocol:
//   Registration: first 4 bytes = 0xFFFFFFFF, next 4 bytes = client's virtual IP
//   Data packet:  first 4 bytes = destination virtual IP, rest = raw IP packet
//
// The relay maintains a mapping of virtual IP → real UDP address.
// When a data packet arrives, it looks up the destination virtual IP
// and forwards the packet to the corresponding real address.

package main

import (
	"encoding/binary"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
)

const defaultAddr = ":4242"

// Magic prefix for registration packets
var regMagic = [4]byte{0xFF, 0xFF, 0xFF, 0xFF}

type PeerEntry struct {
	addr      *net.UDPAddr
	virtualIP net.IP
}

type RelayServer struct {
	mu    sync.RWMutex
	// virtualIP string → real UDP address
	peers map[string]*net.UDPAddr
	// real UDP address string → virtual IP
	reverse map[string]net.IP
}

func NewRelayServer() *RelayServer {
	return &RelayServer{
		peers:   make(map[string]*net.UDPAddr),
		reverse: make(map[string]net.IP),
	}
}

func (r *RelayServer) Register(virtualIP net.IP, addr *net.UDPAddr) {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := virtualIP.To4().String()
	r.peers[key] = addr
	r.reverse[addr.String()] = virtualIP.To4()
	log.Printf("registered: %s → %s", key, addr)
}

func (r *RelayServer) Lookup(virtualIP net.IP) *net.UDPAddr {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.peers[virtualIP.To4().String()]
}

func (r *RelayServer) GetVirtualIP(addr *net.UDPAddr) net.IP {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.reverse[addr.String()]
}

func main() {
	addr := defaultAddr
	if envAddr := os.Getenv("RELAY_ADDR"); envAddr != "" {
		addr = envAddr
	}

	udpAddr, err := net.ResolveUDPAddr("udp", addr)
	if err != nil {
		log.Fatalf("failed to resolve %s: %v", addr, err)
	}

	conn, err := net.ListenUDP("udp", udpAddr)
	if err != nil {
		log.Fatalf("failed to listen on %s: %v", addr, err)
	}
	defer conn.Close()

	relay := NewRelayServer()

	fmt.Printf("melnet relay-udp listening on %s\n", addr)

	// Health check HTTP server for Fly.io (keeps machine alive)
	go func() {
		http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(200)
			w.Write([]byte("ok"))
		})
		httpPort := os.Getenv("PORT")
		if httpPort == "" {
			httpPort = "8080"
		}
		log.Printf("health check on :%s", httpPort)
		http.ListenAndServe(":"+httpPort, nil)
	}()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		buf := make([]byte, 65536)
		for {
			n, srcAddr, err := conn.ReadFromUDP(buf)
			if err != nil {
				log.Printf("read error: %v", err)
				continue
			}

			if n < 8 {
				continue
			}

			// Check if this is a registration packet
			if buf[0] == regMagic[0] && buf[1] == regMagic[1] && buf[2] == regMagic[2] && buf[3] == regMagic[3] {
				if n >= 8 {
					virtualIP := net.IP(make([]byte, 4))
					copy(virtualIP, buf[4:8])
					relay.Register(virtualIP, srcAddr)
					// Send ack back
					conn.WriteToUDP([]byte("OK"), srcAddr)
				}
				continue
			}

			// Data packet: [4 bytes dst virtual IP][payload]
			dstIP := make(net.IP, 4)
			binary.BigEndian.PutUint32(dstIP, binary.BigEndian.Uint32(buf[:4]))

			dstAddr := relay.Lookup(dstIP)
			if dstAddr == nil {
				// Unknown destination — drop silently
				continue
			}

			// Forward entire packet (including the 4-byte header) to destination
			conn.WriteToUDP(buf[:n], dstAddr)
		}
	}()

	<-sig
	fmt.Println("\nshutting down relay-udp")
}
