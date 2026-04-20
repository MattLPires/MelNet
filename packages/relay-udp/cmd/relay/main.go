package main

import (
	"encoding/binary"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"

	"github.com/melnet/relay-udp/internal/vnet"
)

const defaultAddr = ":4242"

// minPacketSize is the minimum valid packet: 4 bytes dst IP + at least 1 byte payload.
const minPacketSize = 5

func main() {
	addr := defaultAddr
	if envAddr := os.Getenv("RELAY_ADDR"); envAddr != "" {
		addr = envAddr
	}

	conn, err := net.ListenPacket("udp", addr)
	if err != nil {
		log.Fatalf("failed to listen on %s: %v", addr, err)
	}
	defer conn.Close()

	vnetMgr := vnet.NewVNetManager()

	fmt.Printf("melnet relay-udp listening on %s\n", addr)

	// Graceful shutdown
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)

	go relayLoop(conn, vnetMgr)

	<-sig
	fmt.Println("\nshutting down relay-udp")
}

// relayLoop reads UDP packets and routes them through the vnet manager.
// Packet format: [4 bytes destination virtual IP][encrypted payload...]
func relayLoop(conn net.PacketConn, vnetMgr *vnet.VNetManager) {
	buf := make([]byte, 1500) // standard MTU
	for {
		n, srcAddr, err := conn.ReadFrom(buf)
		if err != nil {
			log.Printf("read error: %v", err)
			return
		}

		if n < minPacketSize {
			log.Printf("dropped: packet too small (%d bytes) from %s", n, srcAddr)
			continue
		}

		// Parse destination virtual IP from first 4 bytes.
		dstIP := make(net.IP, 4)
		binary.BigEndian.PutUint32(dstIP, binary.BigEndian.Uint32(buf[:4]))

		payload := buf[4:n]

		// Find which room the destination IP belongs to.
		dstRoomID, err := vnetMgr.GetRoomForIP(dstIP)
		if err != nil {
			log.Printf("dropped: unknown dst IP %s from %s", dstIP, srcAddr)
			continue
		}

		// Find which room the source belongs to by looking up the source address.
		// We identify the source by its real UDP address — find its virtual IP first.
		srcRoomID, err := findRoomForAddr(vnetMgr, srcAddr)
		if err != nil {
			log.Printf("dropped: unknown source %s", srcAddr)
			continue
		}

		// Enforce room isolation: source and destination must be in the same room.
		if srcRoomID != dstRoomID {
			log.Printf("dropped: cross-room packet from room %s to room %s (src=%s, dst=%s)",
				srcRoomID, dstRoomID, srcAddr, dstIP)
			continue
		}

		// Look up the real UDP address of the destination peer.
		dstAddr, err := vnetMgr.GetPeerAddr(dstRoomID, dstIP)
		if err != nil {
			log.Printf("dropped: no peer address for %s in room %s", dstIP, dstRoomID)
			continue
		}

		// Reject direct client-to-client: destination must not be the source itself.
		if srcAddr.String() == dstAddr.String() {
			log.Printf("dropped: self-send from %s", srcAddr)
			continue
		}

		// Forward the encrypted payload to the destination peer.
		if _, err := conn.WriteTo(payload, dstAddr); err != nil {
			log.Printf("forward error to %s: %v", dstAddr, err)
		}
	}
}

// findRoomForAddr searches all rooms for a peer registered with the given real UDP address.
// This is used to determine which room a source packet belongs to, enforcing that
// all traffic must go through the relay (no direct client-to-client).
func findRoomForAddr(vnetMgr *vnet.VNetManager, addr net.Addr) (string, error) {
	roomID, err := vnetMgr.FindRoomByPeerAddr(addr.String())
	if err != nil {
		return "", fmt.Errorf("source %s not registered: %w", addr, err)
	}
	return roomID, nil
}
