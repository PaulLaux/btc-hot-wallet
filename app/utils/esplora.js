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
 */
export const failoverFetch = (apis, timeout = 15000) => async (url, opts = {}) => {
  const path = url.slice(apis[0].length);
  for (let i = 0; ; i += 1) {
    const last = i === apis.length - 1;
    const signal = AbortSignal.any([opts.signal, AbortSignal.timeout(timeout)].filter(Boolean));
    try {
      const res = await fetch(apis[i] + path, { ...opts, signal });
      if (last || (res.status !== 429 && res.status < 500)) return res;
    } catch (err) {
      if (last) throw err;
    }
  }
};

/** Client for a network from network.js: { chain, apis, genesis, recommendedFees } */
export function connect({ chain, apis, genesis, recommendedFees }) {
  const apiFetch = failoverFetch(apis);
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
