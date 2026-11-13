import * as btc from '@scure/btc-signer';

/**
 * Test coins as EsploraProvider.unspent returns them: the outputs of one funding transaction that pays
 * `amounts` (sats) to a testnet `address`. Another lockTime gives another transaction.
 */
export function coinsOf(address, amounts, lockTime = 0) {
  const script = btc.OutScript.encode(btc.Address(btc.TEST_NETWORK).decode(address));
  const raw = btc.RawTx.encode({
    version: 2,
    segwitFlag: false,
    inputs: [{ txid: new Uint8Array(32), index: 0, finalScriptSig: new Uint8Array(), sequence: 0xffffffff }],
    outputs: amounts.map((amount) => ({ amount, script })),
    witnesses: [],
    lockTime,
  });
  const txid = btc.Transaction.fromRaw(raw, { allowUnknownInputs: true }).id;
  return amounts.map((amount, index) => ({ txid, index, nonWitnessUtxo: raw }));
}
