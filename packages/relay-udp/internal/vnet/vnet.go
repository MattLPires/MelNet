// Package vnet manages virtual network (subnet) allocation and IP assignment per room.
package vnet

import (
	"fmt"
	"net"
	"sync"
)

// Room represents an isolated virtual subnet for a game room.
type Room struct {
	// ID is the unique room identifier.
	ID string
	// Subnet is the 10.x.x.0/24 range allocated to this room.
	Subnet *net.IPNet
	// Members maps memberID to their assigned virtual IP.
	Members map[string]net.IP
	// ipToMember is the reverse map: virtual IP string → memberID.
	ipToMember map[string]string
	// nextHost is the next host octet to assign (starts at 2, max 254).
	nextHost byte
}

// Manager handles virtual network lifecycle for rooms.
type Manager interface {
	// CreateRoom allocates a new subnet for the given room ID.
	CreateRoom(roomID string) (*Room, error)
	// AssignIP assigns the next available virtual IP in the room to a member.
	AssignIP(roomID string, memberID string) (net.IP, error)
	// ReleaseIP frees a virtual IP when a member leaves.
	ReleaseIP(roomID string, memberID string) error
	// DestroyRoom tears down the subnet and releases all IPs.
	DestroyRoom(roomID string) error
	// GetRoomForIP returns the roomID that owns the given virtual IP.
	GetRoomForIP(virtualIP net.IP) (string, error)
	// GetPeerAddr returns the real UDP address registered for dstVirtualIP in the given room.
	GetPeerAddr(roomID string, dstVirtualIP net.IP) (*net.UDPAddr, error)
	// RegisterPeerAddr associates a real UDP address with a virtual IP in a room.
	RegisterPeerAddr(roomID string, virtualIP net.IP, addr *net.UDPAddr) error
}

// peerEntry holds the real UDP address for a peer in a room.
type peerEntry struct {
	addr *net.UDPAddr
}

// VNetManager is an in-memory implementation of Manager.
type VNetManager struct {
	mu    sync.RWMutex
	rooms map[string]*Room
	// ipIndex maps virtual IP string → roomID for fast lookup.
	ipIndex map[string]string
	// peerAddrs maps "roomID:virtualIP" → real UDP address.
	peerAddrs map[string]*peerEntry
	// nextSecondOctet is used to allocate unique 10.x.0.0/24 subnets.
	nextSecondOctet byte
}

// NewVNetManager creates a new in-memory VNetManager.
func NewVNetManager() *VNetManager {
	return &VNetManager{
		rooms:           make(map[string]*Room),
		ipIndex:         make(map[string]string),
		peerAddrs:       make(map[string]*peerEntry),
		nextSecondOctet: 0,
	}
}

// CreateRoom allocates a 10.x.0.0/24 subnet for the room.
func (m *VNetManager) CreateRoom(roomID string) (*Room, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.rooms[roomID]; exists {
		return nil, fmt.Errorf("room %s already exists", roomID)
	}

	if m.nextSecondOctet == 255 {
		return nil, fmt.Errorf("no more subnets available")
	}

	octet := m.nextSecondOctet
	m.nextSecondOctet++

	subnetStr := fmt.Sprintf("10.%d.0.0/24", octet)
	_, subnet, err := net.ParseCIDR(subnetStr)
	if err != nil {
		return nil, fmt.Errorf("failed to parse subnet %s: %w", subnetStr, err)
	}

	room := &Room{
		ID:         roomID,
		Subnet:     subnet,
		Members:    make(map[string]net.IP),
		ipToMember: make(map[string]string),
		nextHost:   2, // .1 reserved for gateway/relay, start at .2
	}
	m.rooms[roomID] = room
	return room, nil
}

// AssignIP assigns the next available IP in the room's subnet to a member.
func (m *VNetManager) AssignIP(roomID string, memberID string) (net.IP, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	room, exists := m.rooms[roomID]
	if !exists {
		return nil, fmt.Errorf("room %s not found", roomID)
	}

	if _, already := room.Members[memberID]; already {
		return room.Members[memberID], nil
	}

	if room.nextHost > 254 {
		return nil, fmt.Errorf("room %s: no more IPs available", roomID)
	}

	// Build IP from subnet base + host octet.
	baseIP := room.Subnet.IP.To4()
	ip := make(net.IP, 4)
	copy(ip, baseIP)
	ip[3] = room.nextHost
	room.nextHost++

	room.Members[memberID] = ip
	room.ipToMember[ip.String()] = memberID
	m.ipIndex[ip.String()] = roomID

	return ip, nil
}

// ReleaseIP frees the virtual IP assigned to a member.
func (m *VNetManager) ReleaseIP(roomID string, memberID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	room, exists := m.rooms[roomID]
	if !exists {
		return fmt.Errorf("room %s not found", roomID)
	}

	ip, hasMember := room.Members[memberID]
	if !hasMember {
		return fmt.Errorf("member %s not found in room %s", memberID, roomID)
	}

	ipStr := ip.String()
	delete(room.Members, memberID)
	delete(room.ipToMember, ipStr)
	delete(m.ipIndex, ipStr)

	// Also clean up peer address.
	peerKey := roomID + ":" + ipStr
	delete(m.peerAddrs, peerKey)

	return nil
}

// DestroyRoom removes the room and all associated IPs.
func (m *VNetManager) DestroyRoom(roomID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	room, exists := m.rooms[roomID]
	if !exists {
		return fmt.Errorf("room %s not found", roomID)
	}

	// Clean up all IP index entries and peer addresses for this room.
	for _, ip := range room.Members {
		ipStr := ip.String()
		delete(m.ipIndex, ipStr)
		peerKey := roomID + ":" + ipStr
		delete(m.peerAddrs, peerKey)
	}

	delete(m.rooms, roomID)
	return nil
}

// GetRoomForIP returns the roomID that owns the given virtual IP.
func (m *VNetManager) GetRoomForIP(virtualIP net.IP) (string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	roomID, exists := m.ipIndex[virtualIP.To4().String()]
	if !exists {
		return "", fmt.Errorf("no room found for IP %s", virtualIP)
	}
	return roomID, nil
}

// GetPeerAddr returns the real UDP address for a virtual IP in a room.
func (m *VNetManager) GetPeerAddr(roomID string, dstVirtualIP net.IP) (*net.UDPAddr, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	peerKey := roomID + ":" + dstVirtualIP.To4().String()
	entry, exists := m.peerAddrs[peerKey]
	if !exists {
		return nil, fmt.Errorf("no peer address for IP %s in room %s", dstVirtualIP, roomID)
	}
	return entry.addr, nil
}

// RegisterPeerAddr associates a real UDP address with a virtual IP in a room.
func (m *VNetManager) RegisterPeerAddr(roomID string, virtualIP net.IP, addr *net.UDPAddr) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	room, exists := m.rooms[roomID]
	if !exists {
		return fmt.Errorf("room %s not found", roomID)
	}

	ipStr := virtualIP.To4().String()
	if _, hasMember := room.ipToMember[ipStr]; !hasMember {
		return fmt.Errorf("IP %s is not assigned in room %s", virtualIP, roomID)
	}

	peerKey := roomID + ":" + ipStr
	m.peerAddrs[peerKey] = &peerEntry{addr: addr}
	return nil
}

// FindRoomByPeerAddr searches all rooms for a peer registered with the given
// real UDP address string. Returns the roomID if found.
// This enables the relay to verify that a source address is a registered peer,
// enforcing that all traffic must pass through the relay.
func (m *VNetManager) FindRoomByPeerAddr(addrStr string) (string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for key, entry := range m.peerAddrs {
		if entry.addr.String() == addrStr {
			// key format is "roomID:virtualIP" — extract roomID.
			for i := len(key) - 1; i >= 0; i-- {
				if key[i] == ':' {
					return key[:i], nil
				}
			}
		}
	}
	return "", fmt.Errorf("no peer registered with address %s", addrStr)
}
