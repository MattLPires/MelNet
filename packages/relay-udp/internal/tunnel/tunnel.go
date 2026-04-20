// Package tunnel manages encrypted WireGuard-like tunnels between clients and the relay.
package tunnel

import (
	"fmt"
	"net"
	"sync"
)

// Tunnel represents an encrypted tunnel session for a single client.
type Tunnel struct {
	// PeerAddr is the real UDP address of the connected client.
	PeerAddr *net.UDPAddr
	// VirtualIP is the 10.x.x.x address assigned inside the room.
	VirtualIP net.IP
}

// Manager handles creation and teardown of tunnels for a room.
type Manager interface {
	// AddPeer registers a new client tunnel.
	AddPeer(peerAddr *net.UDPAddr, virtualIP net.IP) error
	// RemovePeer tears down a client tunnel.
	RemovePeer(virtualIP net.IP) error
	// Route returns the real peer address for a given virtual IP destination.
	Route(dstVirtualIP net.IP) (*net.UDPAddr, error)
	// Close tears down all tunnels.
	Close() error
}

// TunnelManager is an in-memory implementation of Manager.
type TunnelManager struct {
	mu sync.RWMutex
	// peers maps virtual IP string → Tunnel.
	peers map[string]*Tunnel
}

// NewTunnelManager creates a new TunnelManager.
func NewTunnelManager() *TunnelManager {
	return &TunnelManager{
		peers: make(map[string]*Tunnel),
	}
}

// AddPeer registers a client with its real UDP address and virtual IP.
func (tm *TunnelManager) AddPeer(peerAddr *net.UDPAddr, virtualIP net.IP) error {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	key := virtualIP.To4().String()
	if _, exists := tm.peers[key]; exists {
		return fmt.Errorf("peer with virtual IP %s already registered", key)
	}

	tm.peers[key] = &Tunnel{
		PeerAddr:  peerAddr,
		VirtualIP: virtualIP,
	}
	return nil
}

// RemovePeer unregisters a client by virtual IP.
func (tm *TunnelManager) RemovePeer(virtualIP net.IP) error {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	key := virtualIP.To4().String()
	if _, exists := tm.peers[key]; !exists {
		return fmt.Errorf("peer with virtual IP %s not found", key)
	}

	delete(tm.peers, key)
	return nil
}

// Route returns the real UDP address for the given destination virtual IP.
func (tm *TunnelManager) Route(dstVirtualIP net.IP) (*net.UDPAddr, error) {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	key := dstVirtualIP.To4().String()
	tunnel, exists := tm.peers[key]
	if !exists {
		return nil, fmt.Errorf("no route for virtual IP %s", key)
	}
	return tunnel.PeerAddr, nil
}

// Close tears down all tunnels and clears state.
func (tm *TunnelManager) Close() error {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	tm.peers = make(map[string]*Tunnel)
	return nil
}
