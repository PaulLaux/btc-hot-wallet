/**
 * Keys, addresses and transactions of the chains below: native SegWit (P2WPKH, BIP-84) on @scure/btc-signer.
 * Amounts are bigint sats.
 */
import * as btc from '@scure/btc-signer';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import { hex } from '@scure/base';

// Litecoin address formats; P2SH is M… (Q… on testnet): the older 3… (2…) form is not accepted
const LTC = { bech32: 'ltc', pubKeyHash: 0x30, scriptHash: 0x32, wif: 0xb0 };
const LTC_TEST = { bech32: 'tltc', pubKeyHash: 0x6f, scriptHash: 0x3a, wif: 0xef };

/**
 * Each chain: its coin and address format, and the coin type of its receive keys m/84'/<coin type>'/0'/0
 * (SLIP-44: 1 on every test network). Networks may share a chain: Testnet4 and Signet use 'test'.
 * dustRelayFeeRate (sat/vB): nodes relay no output worth less than creating and spending it at this rate;
 * smaller change goes to the fee (182 bytes, as @scure/btc-signer counts: 546 sats on Bitcoin, 5460 on Litecoin).
 */
export const chains = {
  main: { coin: 'BTC', name: 'Bitcoin', network: btc.NETWORK, coinType: 0, dustRelayFeeRate: 3n },
  test: { coin: 'BTC', name: 'Bitcoin testnet', network: btc.TEST_NETWORK, coinType: 1, dustRelayFeeRate: 3n },
  ltc: { coin: 'LTC', name: 'Litecoin', network: LTC, coinType: 2, dustRelayFeeRate: 30n },
  ltctest: { coin: 'LTC', name: 'Litecoin testnet', network: LTC_TEST, coinType: 1, dustRelayFeeRate: 30n },
};
const RBF = 0xfffffffd; // signals replace-by-fee: a stuck transaction can be resent with a higher fee
const DUST = 546n; // coins this small may carry an inscription: never spend them

const receiveKeys = (mnemonic, chain) =>
  HDKey.fromMasterSeed(mnemonicToSeedSync(mnemonic)).derive(`m/84'/${chains[chain].coinType}'/0'/0`);

/** `count` receive addresses, from index `from` */
export function deriveAddresses(mnemonic, chain, from, count) {
  const keys = receiveKeys(mnemonic, chain);
  return Array.from({ length: count }, (_, i) => btc.p2wpkh(keys.deriveChild(from + i).publicKey, chains[chain].network).address);
}

/** Private key of receive address `index` */
export const privateKey = (mnemonic, chain, index) => receiveKeys(mnemonic, chain).deriveChild(index).privateKey;

/** Throws unless `address` is valid on this chain; any type (on Bitcoin 1…, 3…, bc1q…, bc1p…) */
export function checkAddress(address, chain) {
  try {
    btc.Address(chains[chain].network).decode(address);
  } catch {
    throw new Error(`Not a ${chains[chain].name} address: ${address}`);
  }
}

/** Amount in coins to sats. Never rounds: more than 8 decimals is an error */
export function toSats(amount) {
  let sats;
  try {
    sats = btc.Decimal.decode(String(amount));
  } catch {
    throw new Error('Amount must be a number with at most 8 decimals');
  }
  if (sats <= 0n) throw new Error('Amount must be positive');
  return sats;
}

/** Sats (bigint or decimal string) to an amount in coins, every digit kept */
export const fromSats = (sats) => btc.Decimal.encode(BigInt(sats));

/** Amount of a coin from EsploraProvider.unspent, read from its funding transaction */
const coinAmount = (coin) => btc.RawTx.decode(coin.nonWitnessUtxo).outputs[coin.index].amount;

/**
 * Unsigned transaction that pays `amount` sats to `to` from the coins of `from`, with change back to `from`.
 * @param {object[]} coins the coins of `from`, from EsploraProvider.unspent (with their funding transaction)
 * @param {bigint} feeRate sat/vB
 * @return {object} { psbt: hex, fee: sats, inputs: count }
 */
export function buildTx(coins, from, to, amount, feeRate, chain) {
  checkAddress(to, chain);
  const spendable = coins.filter((coin) => coinAmount(coin) > DUST).map((coin) => ({ ...coin, sequence: RBF }));
  const selected = btc.selectUTXO(spendable, [{ address: to, amount }], 'default', {
    changeAddress: from, feePerByte: feeRate, createTx: true,
    network: chains[chain].network, dustRelayFeeRate: chains[chain].dustRelayFeeRate,
  });
  if (!selected) throw new Error('Not enough funds for the amount and the fee');
  return {
    psbt: hex.encode(selected.tx.toPSBT()),
    fee: Number(selected.fee),
    inputs: selected.inputs.length,
  };
}

/** Sign every input of the PSBT with `key`; returns the raw transaction and its id */
export function signTx(psbt, key) {
  const tx = btc.Transaction.fromPSBT(hex.decode(psbt), { strictPrevoutValidation: true });
  tx.sign(key); // throws if the key signs no input
  tx.finalize(); // throws if an input is left unsigned
  return { hex: tx.hex, id: tx.id };
}
