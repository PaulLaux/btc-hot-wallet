/**
 * Network access over public Esplora REST APIs (see network.js). Coins come with their funding transaction,
 * so their amounts are verified.
 */
import { EsploraProvider } from '@scure/btc-signer/net.js';
import { chains } from 'utils/bitcoin';

// Blocks to confirm within: slow ~1 hour, normal ~30 minutes, fast next block
export const feeTargets = { slow: 6, normal: 3, fast: 1 };
// The same speeds in mempool.space's own fee API, for networks with recommendedFees
const recommended = { slow: 'hourFee', normal: 'halfHourFee', fast: 'fastestFee' };

/**
 * fetch for URLs under apis[0] that tries the next API on a network error, 429, 5xx or no answer within
 * `timeout` ms. (mempool.space sends its 429 without CORS headers: browsers report a network error.)
 * Later requests start at the API that answered last, so a failing API costs its timeout only once.
 */
export const failoverFetch = (apis, timeout = 15000) => {
  let first = 0;
  return async (url, opts = {}) => {
    const path = url.slice(apis[0].length);
    for (let n = 0; ; n += 1) {
      const i = (first + n) % apis.length;
      const last = n === apis.length - 1;
      const signal = AbortSignal.any([opts.signal, AbortSignal.timeout(timeout)].filter(Boolean));
      try {
        const res = await fetch(apis[i] + path, { ...opts, signal });
        if (last || (res.status !== 429 && res.status < 500)) {
          first = i;
          return res;
        }
      } catch (err) {
        if (last) throw err;
      }
    }
  };
};

/** Client for a network from network.js: { chain, apis, genesis, recommendedFees } */
export function connect({ chain, apis, genesis, recommendedFees }) {
  const apiFetch = failoverFetch(apis);
  const batchFetch = failoverFetch(apis.slice(0, 1)); // the first API only, with the timeout
  let batch = true; // until a batch request fails (usedAddresses)
  const provider = new EsploraProvider(apiFetch, apis[0], chains[chain].network);
  const get = async (path) => {
    const res = await apiFetch(apis[0] + path);
    if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
    return res.text();
  };
  return {
    /** Height of the chain tip; throws unless the API serves this network */
    async height() {
      if (await get('/block-height/0') !== genesis) throw new Error('The API serves another network');
      return Number(await get('/blocks/tip/height'));
    },
    /** Confirmed balance in sats and the unconfirmed change to it, as decimal strings; whether ever used */
    async addressInfo(address) {
      const { chain_stats: confirmed, mempool_stats: pending } = JSON.parse(await get(`/address/${address}`));
      const net = (stats) => stats.funded_txo_sum - stats.spent_txo_sum;
      return {
        balance: String(net(confirmed)),
        unconfirmed: String(net(pending)),
        used: confirmed.tx_count + pending.tx_count > 0,
      };
    },
    /**
     * The ever used ones of `addresses`, as a Set. The first API is asked for all of them at once with
     * POST /addresses/txs: mempool.space and litecoinspace.org have it (mempool's electrs, up to 300 addresses;
     * not in their API docs), blockstream.info does not. The body goes as text/plain: JSON would need a CORS
     * preflight, which they answer with 404. The answer is the latest 50 transactions of them all, so the
     * addresses not seen yet are asked again until no new one shows up. Once that fails, each address is checked
     * on its own for the rest of this connection, one request at a time (addressInfo: the API that answered
     * last, see failoverFetch).
     */
    async usedAddresses(addresses) {
      const used = new Set();
      if (batch) {
        try {
          for (let left = addresses; left.length; left = left.filter((a) => !used.has(a))) {
            const res = await batchFetch(`${apis[0]}/addresses/txs`, { method: 'POST', body: JSON.stringify(left) });
            if (!res.ok) throw new Error(`/addresses/txs: ${res.status}`);
            const seen = (await res.json())
              .flatMap((tx) => [...tx.vin.map((i) => i.prevout?.scriptpubkey_address), ...tx.vout.map((o) => o.scriptpubkey_address)])
              .filter((a) => left.includes(a));
            if (!seen.length) return used;
            seen.forEach((a) => used.add(a));
          }
          return used;
        } catch {
          batch = false;
        }
      }
      for (const address of addresses) if ((await this.addressInfo(address)).used) used.add(address);
      return used;
    },
    /** Unspent coins of the address, each with its funding transaction (for bitcoin.js buildTx) */
    coins: async (address) => (await provider.unspent(address)).utxo,
    /** Fee rate in sat/vB for 'slow', 'normal' or 'fast' */
    feeRate: async (speed) => (recommendedFees
      ? BigInt(Math.ceil(JSON.parse(await get('/v1/fees/recommended'))[recommended[speed]]))
      : provider.fee(feeTargets[speed])),
    /** Broadcast a signed transaction (hex); returns its id */
    broadcast: (txHex) => provider.sendTx(txHex),
  };
}
