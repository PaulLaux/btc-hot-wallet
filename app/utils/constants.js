/* Auto generated password lenght */
export const generatedPasswordLength = 12;

// time in ms for check balancess polling
export const timeBetweenCheckbalances = 180 * 1000;

// an unlocked wallet locks itself after this time (ms)
export const autoLockTime = 15 * 60 * 1000;

/* offline mode is special case of error */
export const offlineModeString = 'Offline';
/* Default network to connect after wallet creation (see network.js) */
export const defaultNetwork = 'Testnet4';

/* encrypted wallet (see utils/wallet.js) is saved to local storage under this key */
export const localStorageKey = 'btc-wallet';

// addresses:
export const github = 'https://github.com/PaulLaux/btc-hot-wallet';

// APIs:
// The CoinGecko ID of each coin (see chains in utils/bitcoin.js)
export const coinGeckoIds = { BTC: 'bitcoin', LTC: 'litecoin' };
// Keyless CoinGecko endpoint, queried with ?ids=<CoinGecko IDs>&vs_currencies=...
export const coinGeckoPriceApi = 'https://api.coingecko.com/api/v3/simple/price';
