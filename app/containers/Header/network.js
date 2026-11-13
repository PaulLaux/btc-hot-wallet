// Each network lists public Esplora APIs, tried in order (see utils/esplora.js): mempool.space, then
// blockstream.info; Litecoin has only litecoinspace.org, a mempool.space fork without /fee-estimates
// (recommendedFees: fee rates from /v1/fees/recommended). genesis is the hash of block 0, checked on
// connect; chain picks the addresses (utils/bitcoin.js): Testnet4 and Signet share the test chain's.
const esplora = (path) => [`https://mempool.space${path}/api`, `https://blockstream.info${path}/api`];

// The network menu lists them in this order, under their group
const Network = {
  Bitcoin: {
    group: 'Bitcoin',
    chain: 'main',
    apis: esplora(''),
    genesis: '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f',
    tx_explorer: 'https://mempool.space/tx/',
  },
  Testnet4: {
    group: 'Bitcoin',
    chain: 'test',
    apis: esplora('/testnet4'),
    genesis: '00000000da84f2bafbbc53dee25a72ae507ff4914b867c565be350b0da8bf043',
    tx_explorer: 'https://mempool.space/testnet4/tx/',
  },
  Signet: {
    group: 'Bitcoin',
    chain: 'test',
    apis: esplora('/signet'),
    genesis: '00000008819873e925422c1ff0f99f7cc9bbb232af63a077a480a3633bee1ef6',
    tx_explorer: 'https://mempool.space/signet/tx/',
  },
  Litecoin: {
    group: 'Litecoin',
    chain: 'ltc',
    apis: ['https://litecoinspace.org/api'],
    genesis: '12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2',
    tx_explorer: 'https://litecoinspace.org/tx/',
    recommendedFees: true,
  },
  'Litecoin Testnet': {
    group: 'Litecoin',
    chain: 'ltctest',
    apis: ['https://litecoinspace.org/testnet/api'],
    genesis: '4966625a4b2851d9fdee139e56211a0d88575f59ed816ff5e6a63deb4e3e29a0',
    tx_explorer: 'https://litecoinspace.org/testnet/tx/',
    recommendedFees: true,
  },
  Offline: { group: 'Other', apis: [], tx_explorer: null },
};

export default Network;
