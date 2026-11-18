import * as btc from '@scure/btc-signer';
import { pubECDSA } from '@scure/btc-signer/utils.js';
import { hex } from '@scure/base';
import { mnemonicToSeedSync } from '@scure/bip39';
import { newMnemonic, isMnemonicValid, createVault, openVault, addAddress, keyFor } from '../wallet';

// Standard test mnemonic: BIP-84 test vectors, and its testnet addresses m/84'/1'/0'/0/{0,1}
const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const seed = mnemonicToSeedSync(mnemonic);
// BIP-39 test vector: the seed of the mnemonic with the passphrase TREZOR
const trezorSeed = 'c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04';
// a vault saved before passphrases (the mnemonic alone, password 'password-123')
const oldVault = {
  salt: '0744493a09e650bf44c720b64fb203eb',
  iv: 'cb0d300247dada89650c17dc',
  data: '0cfc54f69cc985d8fb652b7f82af3becc135ff39c71a0aeb00786798df2318ba3f3cd6b23958abd89fb2d6c1bc6118dc378b11571bca052b6a170f5ef679aa510841a260246257114f0bd28285531528855ac05f515da31f9962a43a5632ca5703f2abad73ee5edd5ec6269d8a',
};
const main0 = 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu';
const test = ['tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl', 'tb1qd7spv5q28348xl4myc8zmh983w5jx32cjhkn97'];
const ltc = { ltc: ['ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh'], ltctest: ['tltc1q6rz28mcfaxtmd6v789l9rrlrusdprr9pesrjxk'] };
// testnet change addresses m/84'/1'/0'/1/{0,1}
const testChange = ['tb1q9u62588spffmq4dzjxsr5l297znf3z6j5p2688', 'tb1qkwgskuzmmwwvqajnyr7yp9hgvh5y45kg8wvdmd'];
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
    expect(vault.hasPassphrase).toBe(false);
    expect(JSON.stringify(vault)).not.toContain('abandon');
    expect(await openVault(vault, 'password-123')).toEqual(seed);
    await expect(openVault(vault, 'wrong-password')).rejects.toThrow('Invalid password');
  });

  it('encrypts a passphrase with the mnemonic: other addresses, the seed of both', async () => {
    const vault = await createVault(mnemonic, 'password-123', 'TREZOR');
    expect(vault.hasPassphrase).toBe(true);
    expect(vault.addresses.main[0]).not.toBe(main0);
    expect(JSON.stringify(vault)).not.toContain('TREZOR');
    expect(hex.encode(await openVault(vault, 'password-123'))).toBe(trezorSeed);
  });

  it('opens vaults saved before passphrases', async () => {
    expect(await openVault(oldVault, 'password-123')).toEqual(seed);
  });

  it('adds addresses per chain, and gives the signing key of each', async () => {
    const vault = addAddress(await createVault(mnemonic, 'password-123'), seed, 'test');
    expect(vault.addresses).toEqual({ main: [main0], test, ...ltc });
    expect(addressOf(keyFor(vault, seed, 'test', test[1]))).toBe(test[1]);
    expect(() => keyFor(vault, seed, 'main', test[1])).toThrow('is not in this wallet');
    // the addresses are stored unencrypted: a changed list must not get a key for the wrong index
    const swapped = { ...vault, addresses: { ...vault.addresses, test: [test[1], test[0]] } };
    expect(() => keyFor(swapped, seed, 'test', test[1])).toThrow('is not in this wallet');
  });

  it('gives the signing key of a change address, found by the restore scan', async () => {
    const vault = await createVault(mnemonic, 'password-123');
    expect(vault.change).toEqual({ main: [], test: [], ltc: [], ltctest: [] });
    expect(() => keyFor(vault, seed, 'test', testChange[1])).toThrow('is not in this wallet');
    const found = { ...vault, change: { ...vault.change, test: testChange } };
    expect(addressOf(keyFor(found, seed, 'test', testChange[1]))).toBe(testChange[1]);
    // listed as a receive address, a change address gets no key
    const moved = { ...vault, addresses: { ...vault.addresses, test: [test[0], testChange[1]] } };
    expect(() => keyFor(moved, seed, 'test', testChange[1])).toThrow('is not in this wallet');
  });
});
