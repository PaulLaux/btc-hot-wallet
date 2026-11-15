import { hex } from '@scure/base';
import { failoverFetch, connect } from '../esplora';
import { coinsOf } from './coins';

const apis = ['https://a.example/api', 'https://b.example/api'];
const testnet4 = { chain: 'test', apis, genesis: '00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043' };
const address = 'tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl';

// Stub fetch: routes map 'METHOD url' to [status, body] or an Error; returns the list of calls made
function stubFetch(routes) {
  const calls = [];
  vi.stubGlobal('fetch', async (url, opts = {}) => {
    const call = `${opts.method || 'GET'} ${url}`;
    calls.push(call);
    const [status, body] = routes[call] || [404, 'Not found'];
    if (status instanceof Error) throw status;
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  });
  return calls;
}
afterEach(() => vi.unstubAllGlobals());

describe('failoverFetch', () => {
  const get = failoverFetch(apis);
  const url = `${apis[0]}/blocks/tip/height`;
  const b = `GET ${apis[1]}/blocks/tip/height`;

  it('tries the next API on a network error, 429 or 5xx', async () => {
    for (const failure of [[new TypeError('Failed to fetch')], [429, 'Too Many Requests'], [503, 'Unavailable']]) {
      const calls = stubFetch({ [`GET ${url}`]: failure, [b]: [200, '100'] });
      expect(await (await failoverFetch(apis)(url)).text()).toBe('100');
      expect(calls).toEqual([`GET ${url}`, b]);
    }
  });

  it('starts later requests at the API that answered last, and goes back when that one fails', async () => {
    const sticky = failoverFetch(apis);
    let calls = stubFetch({ [`GET ${url}`]: [503, ''], [b]: [200, '100'] });
    await sticky(url);
    await sticky(url);
    expect(calls).toEqual([`GET ${url}`, b, b]);
    calls = stubFetch({ [`GET ${url}`]: [200, '101'], [b]: [503, ''] });
    expect(await (await sticky(url)).text()).toBe('101');
    expect(calls).toEqual([b, `GET ${url}`]);
  });

  it('tries the next API when one does not answer in time', async () => {
    vi.stubGlobal('fetch', (target, { signal }) => (target.startsWith(apis[0])
      ? new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason)))
      : Promise.resolve(new Response('100'))));
    expect(await (await failoverFetch(apis, 20)(url)).text()).toBe('100');
  });

  it('returns other errors as they are, and the last answer when all fail', async () => {
    let calls = stubFetch({ [`GET ${url}`]: [400, 'Bad request'] });
    expect((await get(url)).status).toBe(400);
    expect(calls).toHaveLength(1);
    calls = stubFetch({ [`GET ${url}`]: [503, ''], [b]: [502, ''] });
    expect((await get(url)).status).toBe(502);
    stubFetch({ [`GET ${url}`]: [new TypeError('Failed to fetch')], [b]: [new TypeError('Failed to fetch')] });
    await expect(get(url)).rejects.toThrow('Failed to fetch');
  });
});

describe('connect', () => {
  const api = (path) => `GET ${apis[0]}${path}`;

  it('checks that the API serves the network before reading the tip', async () => {
    stubFetch({ [api('/block-height/0')]: [200, testnet4.genesis], [api('/blocks/tip/height')]: [200, '123456'] });
    expect(await connect(testnet4).height()).toBe(123456);
    stubFetch({ [api('/block-height/0')]: [200, '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f'] });
    await expect(connect(testnet4).height()).rejects.toThrow('The API serves another network');
  });

  it('reads the confirmed balance, the unconfirmed change, and whether the address was ever used', async () => {
    const stats = (funded, spent, txs) => ({ funded_txo_sum: funded, spent_txo_sum: spent, tx_count: txs });
    stubFetch({ [api(`/address/${address}`)]: [200, { chain_stats: stats(150000, 50000, 3), mempool_stats: stats(20000, 100000, 1) }] });
    expect(await connect(testnet4).addressInfo(address)).toEqual({ balance: '100000', unconfirmed: '-80000', used: true });
    stubFetch({ [api(`/address/${address}`)]: [200, { chain_stats: stats(0, 0, 0), mempool_stats: stats(0, 0, 0) }] });
    expect(await connect(testnet4).addressInfo(address)).toEqual({ balance: '0', unconfirmed: '0', used: false });
  });

  describe('usedAddresses', () => {
    const [a0, a1, a2, a3] = ['tb1qa0', 'tb1qa1', 'tb1qa2', 'tb1qa3'];
    const tx = (from, to) => ({ vin: [{ prevout: from && { scriptpubkey_address: from } }], vout: [{ scriptpubkey_address: to }] });

    it('asks the first API for all addresses at once, again for those not seen yet', async () => {
      // like the 50 transaction limit: answers only the transactions of the first used address asked
      const txsOf = { [a1]: [tx(null, a1), tx(a1, 'tb1qother')], [a3]: [tx('tb1qother', a3)] };
      const asked = [];
      vi.stubGlobal('fetch', async (url, { method, body }) => {
        expect(`${method} ${url}`).toBe(`POST ${apis[0]}/addresses/txs`);
        expect(typeof body).toBe('string'); // sent as text/plain: no CORS preflight
        asked.push(JSON.parse(body));
        return Response.json(txsOf[asked.at(-1).find((a) => txsOf[a])] || []);
      });
      expect(await connect(testnet4).usedAddresses([a0, a1, a2, a3])).toEqual(new Set([a1, a3]));
      expect(asked).toEqual([[a0, a1, a2, a3], [a0, a2, a3], [a0, a2]]);
    });

    it('checks one address at a time, staying on the next API after a failure, once the batch fails', async () => {
      const info = (txs) => [200, { chain_stats: { tx_count: txs }, mempool_stats: { tx_count: 0 } }];
      const calls = stubFetch({
        [api(`/address/${a0}`)]: info(0),
        [api(`/address/${a1}`)]: [429, 'Too Many Requests'],
        [`GET ${apis[1]}/address/${a1}`]: info(2),
        [`GET ${apis[1]}/address/${a2}`]: info(1),
      });
      const net = connect(testnet4);
      expect(await net.usedAddresses([a0, a1, a2])).toEqual(new Set([a1, a2]));
      expect(calls).toEqual([`POST ${apis[0]}/addresses/txs`, api(`/address/${a0}`), api(`/address/${a1}`),
        `GET ${apis[1]}/address/${a1}`, `GET ${apis[1]}/address/${a2}`]);
      calls.length = 0;
      await net.usedAddresses([a2]);
      expect(calls).toEqual([`GET ${apis[1]}/address/${a2}`]); // no batch request again on this connection
    });
  });

  it('returns coins with their funding transaction, and refuses one that does not match its id', async () => {
    const [coin] = coinsOf(address, [100000n]);
    const { txid, nonWitnessUtxo: raw } = coin;
    const utxo = [200, [{ txid, vout: 0, value: 100000, status: { confirmed: true } }]];
    stubFetch({ [api(`/address/${address}/utxo`)]: utxo, [api(`/tx/${txid}/hex`)]: [200, hex.encode(raw)] });
    expect(await connect(testnet4).coins(address)).toEqual([coin]);
    const other = coinsOf(address, [100000n], 1)[0].nonWitnessUtxo;
    stubFetch({ [api(`/address/${address}/utxo`)]: utxo, [api(`/tx/${txid}/hex`)]: [200, hex.encode(other)] });
    await expect(connect(testnet4).coins(address)).rejects.toThrow();
  });

  it('rounds fee rates up to whole sat/vB, falling back to the nearest target', async () => {
    stubFetch({ [api('/fee-estimates')]: [200, { 1: 3.511, 3: 2.338, 6: 1.109, 144: 0.1 }] });
    const net = connect(testnet4);
    expect([await net.feeRate('fast'), await net.feeRate('normal'), await net.feeRate('slow')]).toEqual([4n, 3n, 2n]);
    stubFetch({ [api('/fee-estimates')]: [200, { 144: 0.495, 1008: 0.1 }] }); // blockstream's testnet4 lists only these
    expect(await connect(testnet4).feeRate('fast')).toBe(1n);
  });

  it('reads fee rates from mempool.space\'s recommended fees on networks without /fee-estimates', async () => {
    stubFetch({ [api('/v1/fees/recommended')]: [200, { fastestFee: 3, halfHourFee: 2, hourFee: 1.5, economyFee: 1, minimumFee: 1 }] });
    const net = connect({ ...testnet4, chain: 'ltctest', recommendedFees: true });
    expect([await net.feeRate('fast'), await net.feeRate('normal'), await net.feeRate('slow')]).toEqual([3n, 2n, 2n]);
  });

  it('broadcasts the hex and returns the txid, or the node error', async () => {
    const txid = 'ab'.repeat(32);
    let calls = stubFetch({ [`POST ${apis[0]}/tx`]: [200, txid] });
    expect(await connect(testnet4).broadcast('0200')).toBe(txid);
    expect(calls).toEqual([`POST ${apis[0]}/tx`]);
    calls = stubFetch({ [`POST ${apis[0]}/tx`]: [400, 'sendrawtransaction RPC error: {"code":-26,"message":"min relay fee not met"}'] });
    await expect(connect(testnet4).broadcast('0200')).rejects.toThrow('min relay fee not met');
    expect(calls).toHaveLength(1); // a rejected transaction is not sent to the other API
  });
});
