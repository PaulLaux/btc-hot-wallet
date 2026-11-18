/**
 * HD wallet: a BIP-39 mnemonic and optional passphrase, encrypted with the user's password (PBKDF2 + AES-GCM).
 * Addresses (BIP-84, see chains in utils/bitcoin.js) are stored unencrypted per chain, { main: [...], ltc: [...], ... },
 * so a locked wallet can still show balances: receive addresses in `addresses`, and in `change` the change addresses
 * other wallets used (found by the restore scan, Header/saga.js); hasPassphrase too, for the scan's warning.
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
    change: Object.fromEntries(Object.keys(chains).map((chain) => [chain, []])),
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
 * Signing key of one of the vault's receive or change addresses. The addresses are stored unencrypted, so the
 * address is derived again: a key is only returned for an address the seed really has at that index.
 */
export function keyFor(vault, seed, chain, address) {
  const receive = vault.addresses[chain].indexOf(address);
  const branch = receive < 0 ? 1 : 0;
  const index = receive < 0 ? vault.change[chain].indexOf(address) : receive;
  if (index < 0 || deriveAddresses(seed, chain, index, 1, branch)[0] !== address) {
    throw new Error(`Address ${address} is not in this wallet`);
  }
  return privateKey(seed, chain, index, branch);
}
