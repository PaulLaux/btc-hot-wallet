/**
 * Bitcoin keys, addresses and transactions: native SegWit (P2WPKH, BIP-84) on @scure/btc-signer.
 * Chains: 'main' (bc1…) and 'test' (tb1…, used by Testnet4 and Signet). Amounts are bigint sats.
 */
import * as btc from '@scure/btc-signer';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import { hex } from '@scure/base';

const networks = { main: btc.NETWORK, test: btc.TEST_NETWORK };
const RBF = 0xfffffffd; // signals replace-by-fee: a stuck transaction can be resent with a higher fee
const DUST = 546n; // coins this small may carry an inscription: never spend them

// Receive keys m/84'/<coin type>'/0'/0: coin type 0 on mainnet, 1 on the test networks
const receiveKeys = (mnemonic, chain) =>
  HDKey.fromMasterSeed(mnemonicToSeedSync(mnemonic)).derive(`m/84'/${chain === 'main' ? 0 : 1}'/0'/0`);

/** `count` receive addresses, from index `from` */
export function deriveAddresses(mnemonic, chain, from, count) {
  const keys = receiveKeys(mnemonic, chain);
  return Array.from({ length: count }, (_, i) => btc.p2wpkh(keys.deriveChild(from + i).publicKey, networks[chain]).address);
}

/** Private key of receive address `index` */
export const privateKey = (mnemonic, chain, index) => receiveKeys(mnemonic, chain).deriveChild(index).privateKey;

/** Throws unless `address` is valid on this chain; any type (1…, 3…, bc1q…, bc1p…) */
export function checkAddress(address, chain) {
  try {
    btc.Address(networks[chain]).decode(address);
  } catch {
    throw new Error(`Not a ${chain === 'main' ? 'Bitcoin' : 'testnet'} address: ${address}`);
  }
}

/** BTC amount to sats. Never rounds: more than 8 decimals is an error */
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

/** Sats (bigint or decimal string) to a BTC amount, every digit kept */
export const toBtc = (sats) => btc.Decimal.encode(BigInt(sats));

/** Amount of a coin from EsploraProvider.unspent, read from its funding transaction */
const coinAmount = (coin) => btc.RawTx.decode(coin.nonWitnessUtxo).outputs[coin.index].amount;

/**
 * Unsigned transaction that pays `amount` sats to `to` from the coins of `from`, with change back to `from`.
 * @param {object[]} coins the coins of `from`, from EsploraProvider.unspent (with their funding transaction)
 * @param {bigint} feeRate sat/vB
 * @return {object} { psbt: hex, fee: sats, vsize, inputs: count }
 */
export function buildTx(coins, from, to, amount, feeRate, chain) {
  checkAddress(to, chain);
  const spendable = coins.filter((coin) => coinAmount(coin) > DUST).map((coin) => ({ ...coin, sequence: RBF }));
  const selected = btc.selectUTXO(spendable, [{ address: to, amount }], 'default', {
    changeAddress: from, feePerByte: feeRate, network: networks[chain], createTx: true,
  });
  if (!selected) throw new Error('Not enough funds for the amount and the fee');
  return {
    psbt: hex.encode(selected.tx.toPSBT()),
    fee: Number(selected.fee),
    vsize: Math.ceil(selected.weight / 4),
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
