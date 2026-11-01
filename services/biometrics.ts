// WebAuthn Passkey & Biometric Service (Face ID / Touch ID / Windows Hello / Android Fingerprint)

export interface PasskeyAccount {
  username: string;
  credentialId: string;
  registeredAt: string;
  displayName?: string;
}

// Backwards compatibility type alias
export type BiometricAccount = PasskeyAccount;

const PASSKEY_ACCOUNTS_KEY = 'rmch_passkey_accounts';
const LEGACY_STORAGE_KEY = 'rmch_biometric_account';

// Check if WebAuthn / Passkeys are supported by this browser and device
export async function isPasskeySupported(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false;
  }
  try {
    if (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
    return true;
  } catch {
    return false;
  }
}

// Backwards compatibility alias
export const isBiometricsSupported = isPasskeySupported;

// Retrieve all passkeys stored on this device (with automatic legacy migration)
export function getAllPasskeyAccounts(): PasskeyAccount[] {
  try {
    const raw = localStorage.getItem(PASSKEY_ACCOUNTS_KEY);
    const accounts: PasskeyAccount[] = raw ? JSON.parse(raw) : [];

    // Migrate from legacy single-account storage if present
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      try {
        const legacy = JSON.parse(legacyRaw) as PasskeyAccount;
        if (legacy && legacy.username) {
          const alreadyExists = accounts.some(
            (a) => a.username.toLowerCase() === legacy.username.toLowerCase()
          );
          if (!alreadyExists) {
            accounts.push(legacy);
            localStorage.setItem(PASSKEY_ACCOUNTS_KEY, JSON.stringify(accounts));
          }
        }
      } catch {
        // ignore JSON parse error
      }
    }

    return accounts;
  } catch {
    return [];
  }
}

// Get the most recently used/registered passkey account
export function getRegisteredBiometricAccount(): PasskeyAccount | null {
  const accounts = getAllPasskeyAccounts();
  return accounts.length > 0 ? accounts[0] : null;
}

// Save or update a passkey account on this device
export function savePasskeyAccount(account: PasskeyAccount): void {
  const accounts = getAllPasskeyAccounts().filter(
    (a) => a.username.toLowerCase() !== account.username.toLowerCase()
  );
  accounts.unshift(account); // Prepend as most recently active
  localStorage.setItem(PASSKEY_ACCOUNTS_KEY, JSON.stringify(accounts));
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(account));
}

// Remove a specific passkey account from this device
export function removePasskeyAccount(username?: string): void {
  if (!username) {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem(PASSKEY_ACCOUNTS_KEY);
    return;
  }

  const accounts = getAllPasskeyAccounts().filter(
    (a) => a.username.toLowerCase() !== username.toLowerCase()
  );
  localStorage.setItem(PASSKEY_ACCOUNTS_KEY, JSON.stringify(accounts));

  const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacyRaw) {
    try {
      const legacy = JSON.parse(legacyRaw);
      if (legacy?.username?.toLowerCase() === username.toLowerCase()) {
        if (accounts.length > 0) {
          localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(accounts[0]));
        } else {
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  }
}

// Backwards compatibility alias
export const removeBiometricAccount = removePasskeyAccount;

// Convert ArrayBuffer to Base64URL string
function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Convert Base64URL string to ArrayBuffer
function base64UrlToBuffer(base64Url: string): ArrayBuffer {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

// Register a new Passkey for a user
export async function registerPasskey(username: string): Promise<boolean> {
  if (!username) throw new Error('Username required for passkey registration');

  const cleanUsername = username.trim().toLowerCase();
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const userId = new TextEncoder().encode(cleanUsername);

  const hostname = window.location.hostname;
  const rp: PublicKeyCredentialRpEntity = {
    name: 'RMCH Student Hub',
    ...(hostname !== 'localhost' && hostname ? { id: hostname } : {}),
  };

  const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
    challenge,
    rp,
    user: {
      id: userId,
      name: cleanUsername,
      displayName: username.trim(),
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' },  // ES256 (standard for Face ID / Touch ID / Passkeys)
      { alg: -257, type: 'public-key' }, // RS256 (Windows Hello fallback)
    ],
    authenticatorSelection: {
      userVerification: 'preferred',
      residentKey: 'required', // Enables discoverable Passkey in device Keychain / Credential Manager
      requireResidentKey: true,
    },
    timeout: 60000,
    attestation: 'none',
  };

  const credential = (await navigator.credentials.create({
    publicKey: publicKeyCredentialCreationOptions,
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('Passkey registration was cancelled or not completed.');
  }

  const credentialId = bufferToBase64Url(credential.rawId);
  const account: PasskeyAccount = {
    username: cleanUsername,
    credentialId,
    registeredAt: new Date().toISOString(),
    displayName: username.trim(),
  };

  savePasskeyAccount(account);
  return true;
}

// Backwards compatibility alias
export const registerBiometrics = registerPasskey;

// Authenticate with Passkey
// If targetUsername is provided, targets that specific account.
// If omitted, triggers discoverable Passkey selection (showing all passkeys available on device/Keychain).
export async function authenticateWithPasskey(targetUsername?: string): Promise<string> {
  const accounts = getAllPasskeyAccounts();
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const hostname = window.location.hostname;

  let allowCredentials: PublicKeyCredentialDescriptor[] | undefined = undefined;

  if (targetUsername) {
    const matched = accounts.find(
      (a) => a.username.toLowerCase() === targetUsername.trim().toLowerCase()
    );
    if (matched?.credentialId) {
      allowCredentials = [
        {
          id: base64UrlToBuffer(matched.credentialId),
          type: 'public-key',
          transports: ['internal'],
        },
      ];
    }
  }

  const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    ...(hostname !== 'localhost' && hostname ? { rpId: hostname } : {}),
    ...(allowCredentials && allowCredentials.length > 0 ? { allowCredentials } : {}),
    userVerification: 'preferred',
    timeout: 60000,
  };

  const assertion = (await navigator.credentials.get({
    publicKey: publicKeyCredentialRequestOptions,
  })) as (PublicKeyCredential & { response: AuthenticatorAssertionResponse }) | null;

  if (!assertion) {
    throw new Error('Passkey authentication was cancelled or failed.');
  }

  // 1. Resolve from assertion userHandle (resident credential standard)
  if (assertion.response?.userHandle && assertion.response.userHandle.byteLength > 0) {
    const decoded = new TextDecoder().decode(assertion.response.userHandle).trim().toLowerCase();
    if (decoded) {
      return decoded;
    }
  }

  // 2. Resolve by matching credential ID against known accounts
  const returnedCredId = bufferToBase64Url(assertion.rawId);
  const matchedByCred = accounts.find((a) => a.credentialId === returnedCredId);
  if (matchedByCred?.username) {
    return matchedByCred.username;
  }

  // 3. Fallback to targetUsername if specified
  if (targetUsername) {
    return targetUsername.trim().toLowerCase();
  }

  // 4. Fallback if single account registered
  if (accounts.length === 1) {
    return accounts[0].username;
  }

  throw new Error('Could not identify which account matched this passkey.');
}

// Backwards compatibility alias
export const authenticateWithBiometrics = authenticateWithPasskey;
