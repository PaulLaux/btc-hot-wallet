import * as btc from '@scure/btc-signer';
import { hex } from '@scure/base';
import { mnemonicToSeedSync } from '@scure/bip39';
import { deriveAddresses, privateKey, checkAddress, toSats, fromSats, buildTx, signTx } from '../bitcoin';
import { coinsOf } from './coins';

const seed = mnemonicToSeedSync('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
// BIP-84 test vectors m/84'/0'/0'/0/{0,1}, and the testnet addresses of m/84'/1'/0'/0/{0,1}
const main = ['bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu', 'bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g'];
const test = ['tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl', 'tb1qd7spv5q28348xl4myc8zmh983w5jx32cjhkn97'];
// Litecoin m/84'/2'/0'/0/{0,1}, and its testnet: the keys of the test addresses above
const ltc = ['ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh', 'ltc1qwlezpr3890hcp6vva9twqh27mr6edadreqvhnn'];
const ltctest = ['tltc1q6rz28mcfaxtmd6v789l9rrlrusdprr9pesrjxk', 'tltc1qd7spv5q28348xl4myc8zmh983w5jx32ctl5d4h'];

// { address: amount } of a transaction's outputs
const outputsOf = (tx) => Object.fromEntries([...Array(tx.outputsLength).keys()].map((i) => {
  const { script, amount } = tx.getOutput(i);
  return [btc.Address(btc.TEST_NETWORK).encode(btc.OutScript.decode(script)), amount];
}));

describe('addresses', () => {
  it('derives BIP-84 receive addresses', () => {
    expect(deriveAddresses(seed, 'main', 0, 2)).toEqual(main);
    expect(deriveAddresses(seed, 'test', 0, 2)).toEqual(test);
    expect(deriveAddresses(seed, 'test', 1, 1)).toEqual([test[1]]);
    expect(deriveAddresses(seed, 'ltc', 0, 2)).toEqual(ltc);
    expect(deriveAddresses(seed, 'ltctest', 0, 2)).toEqual(ltctest);
  });

  it('accepts every address type of the chain, and nothing else', () => {
    [main[0], main[0].toUpperCase(), '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2', '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',
      'bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr']
      .forEach((address) => expect(() => checkAddress(address, 'main')).not.toThrow());
    expect(() => checkAddress(test[0], 'main')).toThrow('Not a Bitcoin address');
    expect(() => checkAddress(main[0], 'test')).toThrow('Not a Bitcoin testnet address');
    expect(() => checkAddress(`${main[0].slice(0, -1)}x`, 'main')).toThrow(); // bad checksum
    expect(() => checkAddress('0x9858EfFD232B4033E47d90003D41EC34EcaEda94', 'main')).toThrow();
    expect(() => checkAddress(ltc[0], 'main')).toThrow('Not a Bitcoin address');
    expect(() => checkAddress(main[0], 'ltc')).toThrow('Not a Litecoin address');
    expect(() => checkAddress(test[0], 'ltctest')).toThrow('Not a Litecoin testnet address');
    expect(() => checkAddress(ltctest[0], 'ltctest')).not.toThrow();
  });
});

describe('amounts', () => {
  it('converts BTC to sats exactly, never rounding', () => {
    expect(toSats('1.5')).toBe(150000000n);
    expect(toSats('0.00000001')).toBe(1n);
    expect(toSats('1.500000000')).toBe(150000000n); // trailing zeros are fine
    expect(toSats('21000000')).toBe(2100000000000000n);
    expect(() => toSats('0.000000001')).toThrow('at most 8 decimals');
    expect(() => toSats('1e-8')).toThrow('at most 8 decimals');
    expect(() => toSats(null)).toThrow('at most 8 decimals');
    expect(() => toSats('0')).toThrow('Amount must be positive');
    expect(() => toSats('-1')).toThrow('Amount must be positive');
  });

  it('shows sats as BTC with every digit', () => {
    expect(fromSats(150000000n)).toBe('1.5');
    expect(fromSats('1')).toBe('0.00000001');
    expect(fromSats('0')).toBe('0');
  });
});

describe('transactions', () => {
  const [from, to] = test;
  const coins = coinsOf(from, [100000n, 546n, 30000n]);

  it('pays the amount, sends the change back to the sender, and signals RBF', () => {
    const { psbt, fee, inputs } = buildTx(coins, from, to, 120000n, 2n, 'test');
    expect({ fee, inputs }).toEqual({ fee: 418, inputs: 2 }); // 209 vB at 2 sat/vB
    const tx = btc.Transaction.fromPSBT(hex.decode(psbt));
    expect(outputsOf(tx)).toEqual({ [to]: 120000n, [from]: 130000n - 120000n - 418n });
    expect(tx.getInput(0).sequence).toBe(0xfffffffd);
  });

  it('never spends coins of 546 sats or less', () => {
    // 100000 alone can't pay 99900 + fee; with the 546-sat coin it could
    expect(() => buildTx(coinsOf(from, [100000n, 546n]), from, to, 99900n, 1n, 'test')).toThrow('Not enough funds');
  });

  it('adds no change below the dust limit of the coin: 546 sats on Bitcoin, 5460 on Litecoin', () => {
    // change of 3859 sats; the coins of test[0] are also those of ltctest[0] (same key, same script)
    const outputs = (chain, sender, recipient) => btc.Transaction.fromPSBT(hex.decode(
      buildTx(coinsOf(from, [100000n]), sender, recipient, 96000n, 1n, chain).psbt)).outputsLength;
    expect(outputs('test', from, to)).toBe(2);
    expect(outputs('ltctest', ltctest[0], ltctest[1])).toBe(1);
  });

  it('refuses amounts the coins cannot cover, and destinations on another network', () => {
    expect(() => buildTx(coins, from, to, 130000n, 2n, 'test')).toThrow('Not enough funds');
    expect(() => buildTx(coins, from, main[1], 1000n, 2n, 'test')).toThrow('Not a Bitcoin testnet address');
  });

  it('signs exactly the built transaction, and only with the key of the sender', () => {
    const { psbt } = buildTx(coins, from, to, 120000n, 2n, 'test');
    expect(() => signTx(psbt, privateKey(seed, 'test', 1))).toThrow();
    const signed = signTx(psbt, privateKey(seed, 'test', 0));
    const tx = btc.Transaction.fromRaw(hex.decode(signed.hex));
    expect(tx.id).toBe(signed.id);
    expect(outputsOf(tx)).toEqual(outputsOf(btc.Transaction.fromPSBT(hex.decode(psbt))));
  });
});
