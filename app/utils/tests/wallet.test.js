import * as btc from '@scure/btc-signer';
import { pubECDSA } from '@scure/btc-signer/utils.js';
import { newMnemonic, isMnemonicValid, createVault, openVault, addAddress, keyFor } from '../wallet';

// Standard test mnemonic: BIP-84 test vectors, and its testnet addresses m/84'/1'/0'/0/{0,1}
const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const main0 = 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu';
const test = ['tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl', 'tb1qd7spv5q28348xl4myc8zmh983w5jx32cjhkn97'];
const ltc = { ltc: ['ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh'], ltctest: ['tltc1q6rz28mcfaxtmd6v789l9rrlrusdprr9pesrjxk'] };
const addressOf = (key) => btc.p2wpkh(pubECDSA(key), btc.TEST_NETWORK).address;

describe('wallet', () => {
  it('generates valid 12-word mnemonics, and accepts 24 words', () => {
    const generated = newMnemonic();
    expect(generated.split(' ')).toHaveLength(12);
    expect(isMnemonicValid(generated)).toBe(true);
    expect(isMnemonicValid(mnemonic.replace('about', 'abandon'))).toBe(false);
    expect(isMnemonicValid(`${'abandon '.repeat(23)}art`)).toBe(true);
  });

  it('encrypts the mnemonic and derives the first address of each chain', async () => {
    const vault = await createVault(mnemonic, 'password-123');
    expect(vault.addresses).toEqual({ main: [main0], test: [test[0]], ...ltc });
    expect(JSON.stringify(vault)).not.toContain('abandon');
    expect(await openVault(vault, 'password-123')).toBe(mnemonic);
    await expect(openVault(vault, 'wrong-password')).rejects.toThrow('Invalid password');
  });

  it('adds addresses per chain, and gives the signing key of each', async () => {
    const vault = addAddress(await createVault(mnemonic, 'password-123'), mnemonic, 'test');
    expect(vault.addresses).toEqual({ main: [main0], test, ...ltc });
    expect(addressOf(keyFor(vault, mnemonic, 'test', test[1]))).toBe(test[1]);
    expect(() => keyFor(vault, mnemonic, 'main', test[1])).toThrow('is not in this wallet');
    // the addresses are stored unencrypted: a changed list must not get a key for the wrong index
    const swapped = { ...vault, addresses: { ...vault.addresses, test: [test[1], test[0]] } };
    expect(() => keyFor(swapped, mnemonic, 'test', test[1])).toThrow('is not in this wallet');
  });
});
