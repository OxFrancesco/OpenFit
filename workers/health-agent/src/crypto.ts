export type EncryptedJson = {
  ciphertext: string;
  iv: string;
  version: 1;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64Decode(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function getAesKey(secret: string): Promise<CryptoKey> {
  const trimmed = secret.trim();
  let keyBytes: Uint8Array | undefined;

  try {
    const decoded = base64Decode(trimmed);
    if (decoded.byteLength === 16 || decoded.byteLength === 24 || decoded.byteLength === 32) {
      keyBytes = decoded;
    }
  } catch {
    keyBytes = undefined;
  }

  if (!keyBytes) {
    keyBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", textEncoder.encode(trimmed)));
  }

  return crypto.subtle.importKey("raw", toArrayBuffer(keyBytes), "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptJson(value: unknown, secret: string): Promise<EncryptedJson> {
  const key = await getAesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = textEncoder.encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ iv, name: "AES-GCM" }, key, plaintext);

  return {
    ciphertext: base64Encode(new Uint8Array(ciphertext)),
    iv: base64Encode(iv),
    version: 1
  };
}

export async function decryptJson(encrypted: EncryptedJson, secret: string): Promise<unknown> {
  if (encrypted.version !== 1) {
    throw new Error("Unsupported encrypted payload version");
  }

  const key = await getAesKey(secret);
  const plaintext = await crypto.subtle.decrypt(
    { iv: toArrayBuffer(base64Decode(encrypted.iv)), name: "AES-GCM" },
    key,
    toArrayBuffer(base64Decode(encrypted.ciphertext))
  );

  return JSON.parse(textDecoder.decode(plaintext));
}

export async function secureEqual(left: string | undefined, right: string | undefined): Promise<boolean> {
  if (!left || !right) {
    return false;
  }

  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", textEncoder.encode(left)),
    crypto.subtle.digest("SHA-256", textEncoder.encode(right))
  ]);

  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let diff = left.length === right.length ? 0 : 1;

  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index] ^ rightBytes[index];
  }

  return diff === 0;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
