// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { randomBytes } from 'node:crypto';
import { encrypt, decrypt, generateKeyPair } from './crypto';
import { TunnelClient, ipToBuffer, bufferToIp } from './TunnelClient';

// ─── Crypto tests ────────────────────────────────────────────────

describe('crypto', () => {
  const key = randomBytes(32);

  it('encrypt then decrypt returns original data', () => {
    const plaintext = Buffer.from('hello melnet tunnel');
    const encrypted = encrypt(plaintext, key);
    const decrypted = decrypt(encrypted, key);
    expect(decrypted).toEqual(plaintext);
  });

  it('encrypted output is longer than plaintext (nonce + tag)', () => {
    const plaintext = Buffer.from('test');
    const encrypted = encrypt(plaintext, key);
    // 12 (nonce) + 16 (auth tag) + plaintext length
    expect(encrypted.length).toBe(12 + 16 + plaintext.length);
  });

  it('decrypt fails with wrong key', () => {
    const plaintext = Buffer.from('secret data');
    const encrypted = encrypt(plaintext, key);
    const wrongKey = randomBytes(32);
    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });

  it('decrypt fails with tampered ciphertext', () => {
    const plaintext = Buffer.from('important');
    const encrypted = encrypt(plaintext, key);
    // Flip a byte in the ciphertext portion
    encrypted[encrypted.length - 1] ^= 0xff;
    expect(() => decrypt(encrypted, key)).toThrow();
  });

  it('rejects invalid key length', () => {
    const shortKey = randomBytes(16);
    expect(() => encrypt(Buffer.from('x'), shortKey)).toThrow('Key must be 32 bytes');
    expect(() => decrypt(Buffer.alloc(30), shortKey)).toThrow('Key must be 32 bytes');
  });

  it('decrypt rejects data too short', () => {
    expect(() => decrypt(Buffer.alloc(10), key)).toThrow('Data too short');
  });

  it('handles empty plaintext', () => {
    const empty = Buffer.alloc(0);
    const encrypted = encrypt(empty, key);
    const decrypted = decrypt(encrypted, key);
    expect(decrypted).toEqual(empty);
  });

  it('generateKeyPair returns 32-byte keys', () => {
    const { publicKey, privateKey } = generateKeyPair();
    expect(publicKey.length).toBe(32);
    expect(privateKey.length).toBe(32);
  });

  it('each encryption produces different ciphertext (random nonce)', () => {
    const plaintext = Buffer.from('same input');
    const enc1 = encrypt(plaintext, key);
    const enc2 = encrypt(plaintext, key);
    expect(enc1).not.toEqual(enc2);
    // But both decrypt to the same plaintext
    expect(decrypt(enc1, key)).toEqual(plaintext);
    expect(decrypt(enc2, key)).toEqual(plaintext);
  });
});

// ─── IP utility tests ────────────────────────────────────────────

describe('IP utilities', () => {
  it('ipToBuffer converts dotted-quad to 4-byte buffer', () => {
    const buf = ipToBuffer('10.0.1.2');
    expect(buf).toEqual(Buffer.from([10, 0, 1, 2]));
  });

  it('bufferToIp converts 4-byte buffer to dotted-quad', () => {
    const ip = bufferToIp(Buffer.from([192, 168, 1, 100]));
    expect(ip).toBe('192.168.1.100');
  });

  it('ipToBuffer rejects invalid IPs', () => {
    expect(() => ipToBuffer('999.0.0.1')).toThrow('Invalid IP');
    expect(() => ipToBuffer('10.0.1')).toThrow('Invalid IP');
    expect(() => ipToBuffer('not.an.ip.addr')).toThrow('Invalid IP');
  });

  it('bufferToIp rejects short buffers', () => {
    expect(() => bufferToIp(Buffer.from([1, 2]))).toThrow('Buffer too short');
  });

  it('roundtrip ipToBuffer → bufferToIp', () => {
    const ip = '10.42.0.7';
    expect(bufferToIp(ipToBuffer(ip))).toBe(ip);
  });
});

// ─── TunnelClient tests ──────────────────────────────────────────

describe('TunnelClient', () => {
  let client: TunnelClient;

  afterEach(() => {
    client?.disconnect();
  });

  it('starts disconnected', () => {
    client = new TunnelClient();
    expect(client.isConnected).toBe(false);
    expect(client.virtualIp).toBe('');
  });

  it('connect establishes tunnel and sets state', async () => {
    client = new TunnelClient();
    const key = randomBytes(32);
    await client.connect('127.0.0.1', 9999, '10.0.1.1', key);
    expect(client.isConnected).toBe(true);
    expect(client.virtualIp).toBe('10.0.1.1');
  });

  it('connect is idempotent when already connected', async () => {
    client = new TunnelClient();
    const key = randomBytes(32);
    await client.connect('127.0.0.1', 9999, '10.0.1.1', key);
    // Second connect should resolve immediately
    await client.connect('127.0.0.1', 9999, '10.0.1.1', key);
    expect(client.isConnected).toBe(true);
  });

  it('disconnect tears down tunnel', async () => {
    client = new TunnelClient();
    const key = randomBytes(32);
    await client.connect('127.0.0.1', 9999, '10.0.1.1', key);
    client.disconnect();
    expect(client.isConnected).toBe(false);
    expect(client.virtualIp).toBe('');
  });

  it('disconnect is safe when not connected', () => {
    client = new TunnelClient();
    expect(() => client.disconnect()).not.toThrow();
  });

  it('sendPacket throws when not connected', () => {
    client = new TunnelClient();
    expect(() => client.sendPacket('10.0.1.2', Buffer.from('data'))).toThrow(
      'Tunnel is not connected'
    );
  });

  it('sendPacket does not throw when connected', async () => {
    client = new TunnelClient();
    const key = randomBytes(32);
    await client.connect('127.0.0.1', 9999, '10.0.1.1', key);
    // sendPacket sends via UDP — won't throw even if relay isn't listening
    expect(() => client.sendPacket('10.0.1.2', Buffer.from('game data'))).not.toThrow();
  });

  it('two clients can exchange packets via loopback', async () => {
    const key = randomBytes(32);

    // Client A
    const clientA = new TunnelClient();
    await clientA.connect('127.0.0.1', 0, '10.0.1.1', key);

    // Client B — we'll use its bound port as the "relay"
    const clientB = new TunnelClient();
    await clientB.connect('127.0.0.1', 0, '10.0.1.2', key);

    // Get the actual bound port of client B's socket (via internal access)
    const socketB = (clientB as any).socket;
    const portB = socketB.address().port;

    const received = new Promise<{ srcIp: string; data: Buffer }>((resolve) => {
      clientB.onPacket((srcIp, data) => {
        resolve({ srcIp, data });
      });
    });

    // Point client A to send to client B's port directly (simulating relay)
    (clientA as any)._relayPort = portB;
    clientA.sendPacket('10.0.1.2', Buffer.from('hello from A'));

    const result = await received;
    expect(result.srcIp).toBe('10.0.1.2');
    expect(result.data.toString()).toBe('hello from A');

    clientA.disconnect();
    clientB.disconnect();
  });
});
