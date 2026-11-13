import * as btc from '@scure/btc-signer';
import { hex } from '@scure/base';
import { deriveAddresses, privateKey, checkAddress, toSats, toBtc, buildTx, signTx } from '../bitcoin';

const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
// BIP-84 test vectors m/84'/0'/0'/0/{0,1}, and the testnet addresses of m/84'/1'/0'/0/{0,1}
const main = ['bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu', 'bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g'];
const test = ['tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl', 'tb1qd7spv5q28348xl4myc8zmh983w5jx32cjhkn97'];

// Coins as EsploraProvider.unspent returns them: outputs of one funding transaction, paying `address`
function coinsOf(address, amounts) {
  const script = btc.OutScript.encode(btc.Address(btc.TEST_NETWORK).decode(address));
  const raw = btc.RawTx.encode({
    version: 2,
    segwitFlag: false,
    inputs: [{ txid: new Uint8Array(32), index: 0, finalScriptSig: new Uint8Array(), sequence: 0xffffffff }],
    outputs: amounts.map((amount) => ({ amount, script })),
    witnesses: [],
    lockTime: 0,
  });
  const txid = btc.Transaction.fromRaw(raw, { allowUnknownInputs: true }).id;
  return amounts.map((amount, index) => ({ txid, index, nonWitnessUtxo: raw }));
}

// { address: amount } of a transaction's outputs
const outputsOf = (tx) => Object.fromEntries([...Array(tx.outputsLength).keys()].map((i) => {
  const { script, amount } = tx.getOutput(i);
  return [btc.Address(btc.TEST_NETWORK).encode(btc.OutScript.decode(script)), amount];
}));

describe('addresses', () => {
  it('derives BIP-84 receive addresses', () => {
    expect(deriveAddresses(mnemonic, 'main', 0, 2)).toEqual(main);
    expect(deriveAddresses(mnemonic, 'test', 0, 2)).toEqual(test);
    expect(deriveAddresses(mnemonic, 'test', 1, 1)).toEqual([test[1]]);
  });

  it('accepts every address type of the chain, and nothing else', () => {
    [main[0], main[0].toUpperCase(), '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2', '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',
      'bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr']
      .forEach((address) => expect(() => checkAddress(address, 'main')).not.toThrow());
    expect(() => checkAddress(test[0], 'main')).toThrow('Not a Bitcoin address');
    expect(() => checkAddress(main[0], 'test')).toThrow('Not a testnet address');
    expect(() => checkAddress(`${main[0].slice(0, -1)}x`, 'main')).toThrow(); // bad checksum
    expect(() => checkAddress('0x9858EfFD232B4033E47d90003D41EC34EcaEda94', 'main')).toThrow();
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
    expect(toBtc(150000000n)).toBe('1.5');
    expect(toBtc('1')).toBe('0.00000001');
    expect(toBtc('0')).toBe('0');
  });
});

describe('transactions', () => {
  const [from, to] = test;
  const coins = coinsOf(from, [100000n, 546n, 30000n]);

  it('pays the amount, sends the change back to the sender, and signals RBF', () => {
    const { psbt, fee, vsize, inputs } = buildTx(coins, from, to, 120000n, 2n, 'test');
    expect({ fee, vsize, inputs }).toEqual({ fee: 418, vsize: 209, inputs: 2 });
    const tx = btc.Transaction.fromPSBT(hex.decode(psbt));
    expect(outputsOf(tx)).toEqual({ [to]: 120000n, [from]: 130000n - 120000n - 418n });
    expect(tx.getInput(0).sequence).toBe(0xfffffffd);
  });

  it('never spends coins of 546 sats or less', () => {
    // 100000 alone can't pay 99900 + fee; with the 546-sat coin it could
    expect(() => buildTx(coinsOf(from, [100000n, 546n]), from, to, 99900n, 1n, 'test')).toThrow('Not enough funds');
  });

  it('refuses amounts the coins cannot cover, and destinations on another network', () => {
    expect(() => buildTx(coins, from, to, 130000n, 2n, 'test')).toThrow('Not enough funds');
    expect(() => buildTx(coins, from, main[1], 1000n, 2n, 'test')).toThrow('Not a testnet address');
  });

  it('signs exactly the built transaction, and only with the key of the sender', () => {
    const { psbt } = buildTx(coins, from, to, 120000n, 2n, 'test');
    expect(() => signTx(psbt, privateKey(mnemonic, 'test', 1))).toThrow();
    const signed = signTx(psbt, privateKey(mnemonic, 'test', 0));
    const tx = btc.Transaction.fromRaw(hex.decode(signed.hex));
    expect(tx.id).toBe(signed.id);
    expect(outputsOf(tx)).toEqual(outputsOf(btc.Transaction.fromPSBT(hex.decode(psbt))));
  });
});
