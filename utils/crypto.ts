
// utils/crypto.ts

// Convert ArrayBuffer to Base64
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// Convert Base64 to ArrayBuffer
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
};

// 1. Generate ECDH Key Pair (Curve P-256)
export const generateKeyPair = async (): Promise<{ publicKey: string, privateKey: string }> => {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey"]
  );

  const pubKeyParams = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privKeyParams = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);

  return {
    publicKey: JSON.stringify(pubKeyParams),
    privateKey: JSON.stringify(privKeyParams)
  };
};

// 2. Derive Shared Secret (AES-GCM Key)
export const deriveSharedKey = async (
  myPrivateKeyStr: string,
  otherPublicKeyStr: string
): Promise<CryptoKey> => {
  const myPrivJwk = JSON.parse(myPrivateKeyStr);
  const otherPubJwk = JSON.parse(otherPublicKeyStr);

  const myPrivateKey = await window.crypto.subtle.importKey(
    "jwk",
    myPrivJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey"]
  );

  const otherPublicKey = await window.crypto.subtle.importKey(
    "jwk",
    otherPubJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Derive AES-GCM key
  return await window.crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: otherPublicKey,
    },
    myPrivateKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
};

// 3. Encrypt Message
export const encryptMessage = async (text: string, sharedKey: CryptoKey): Promise<string> => {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);

  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    sharedKey,
    encoded
  );

  // Combine IV + Ciphertext
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return arrayBufferToBase64(combined.buffer);
};

// 4. Decrypt Message
export const decryptMessage = async (cipherTextBase64: string, sharedKey: CryptoKey): Promise<string> => {
  try {
    const buffer = base64ToArrayBuffer(cipherTextBase64);
    const data = new Uint8Array(buffer);
    
    const iv = data.slice(0, 12);
    const cipherText = data.slice(12);

    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      sharedKey,
      cipherText
    );

    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.error("Decryption failed", e);
    return "🔒 Decryption Failed";
  }
};
