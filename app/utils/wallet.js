/**
 * HD wallet: a BIP-39 mnemonic and optional passphrase, encrypted with the user's password (PBKDF2 + AES-GCM).
 * Addresses (BIP-84, see chains in utils/bitcoin.js) are stored unencrypted per chain, { main: [...], ltc: [...], ... },
 * so a locked wallet can still show balances; hasPassphrase too, for the restore scan's warning (Header/saga.js).
 */
import { hex } from '@scure/base';
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist as english } from '@scure/bip39/wordlists/english.js';
import { chains, deriveAddresses, privateKey } from 'utils/bitcoin';

const PBKDF2_ITERATIONS = 600000;

export const newMnemonic = () => generateMnemonic(english); // 12 words; restore also takes 24
export const isMnemonicValid = (mnemonic) => validateMnemonic(mnemonic, english);

async function aesKey(password, salt) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

/** Encrypt the mnemonic and passphrase (BIP-39, '' for none), and derive the first address of each chain */
export async function createVault(mnemonic, password, passphrase = '') {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const secret = new TextEncoder().encode(JSON.stringify({ mnemonic, passphrase }));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(password, salt), secret);
  const seed = mnemonicToSeedSync(mnemonic, passphrase);
  return {
    salt: hex.encode(salt),
    iv: hex.encode(iv),
    data: hex.encode(new Uint8Array(data)),
    addresses: Object.fromEntries(Object.keys(chains).map((chain) => [chain, deriveAddresses(seed, chain, 0, 1)])),
    hasPassphrase: passphrase !== '',
  };
}

/**
 * The BIP-39 seed of the vault's mnemonic and passphrase; throws if the password is wrong.
 * A vault saved before passphrases holds the mnemonic alone.
 */
export async function openVault(vault, password) {
  let text;
  try {
    const key = await aesKey(password, hex.decode(vault.salt));
    const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: hex.decode(vault.iv) }, key, hex.decode(vault.data));
    text = new TextDecoder().decode(data);
  } catch {
    throw new Error('Invalid password');
  }
  const { mnemonic, passphrase } = text.startsWith('{') ? JSON.parse(text) : { mnemonic: text };
  return mnemonicToSeedSync(mnemonic, passphrase);
}

/** Return the vault with the next address of the chain added */
export function addAddress(vault, seed, chain) {
  const addresses = vault.addresses[chain];
  return { ...vault, addresses: { ...vault.addresses, [chain]: [...addresses, ...deriveAddresses(seed, chain, addresses.length, 1)] } };
}

/**
 * Signing key of one of the vault's addresses. The addresses are stored unencrypted, so the address is
 * derived again: a key is only returned for an address the seed really has at that index.
 */
export function keyFor(vault, seed, chain, address) {
  const index = vault.addresses[chain].indexOf(address);
  if (index < 0 || deriveAddresses(seed, chain, index, 1)[0] !== address) {
    throw new Error(`Address ${address} is not in this wallet`);
  }
  return privateKey(seed, chain, index);
}
