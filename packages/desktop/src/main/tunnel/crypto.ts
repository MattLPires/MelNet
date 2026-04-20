import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'chacha20-poly1305';
const KEY_LENGTH = 32;
const NONCE_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt data using ChaCha20-Poly1305.
 * Output format: [12 bytes nonce][16 bytes auth tag][ciphertext]
 */
export function encrypt(data: Buffer, key: Buffer): Buffer {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Key must be ${KEY_LENGTH} bytes`);
  }

  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, nonce, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([nonce, authTag, encrypted]);
}

/**
 * Decrypt data encrypted with ChaCha20-Poly1305.
 * Expects input format: [12 bytes nonce][16 bytes auth tag][ciphertext]
 */
export function decrypt(data: Buffer, key: Buffer): Buffer {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Key must be ${KEY_LENGTH} bytes`);
  }

  const minLength = NONCE_LENGTH + AUTH_TAG_LENGTH;
  if (data.length < minLength) {
    throw new Error('Data too short to contain nonce and auth tag');
  }

  const nonce = data.subarray(0, NONCE_LENGTH);
  const authTag = data.subarray(NONCE_LENGTH, NONCE_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(NONCE_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, nonce, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Generate a 32-byte key pair placeholder.
 * In production this would use X25519 (Curve25519) key exchange.
 * For now, generates random symmetric keys.
 */
export function generateKeyPair(): { publicKey: Buffer; privateKey: Buffer } {
  const privateKey = randomBytes(KEY_LENGTH);
  // Placeholder: in a real WireGuard implementation, publicKey would be
  // derived from privateKey via Curve25519 scalar multiplication.
  const publicKey = randomBytes(KEY_LENGTH);
  return { publicKey, privateKey };
}
