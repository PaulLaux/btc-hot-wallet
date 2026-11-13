/* The coin: its ticker, base units per coin (10 ** decimals) and CoinGecko ID for prices */
export const symbol = 'ETH';
export const decimals = 18;
export const coinGeckoId = 'ethereum';

/* Auto generated password lenght */
export const generatedPasswordLength = 12;

// time in ms for check balancess polling
export const timeBetweenCheckbalances = 180 * 1000;

// an unlocked wallet locks itself after this time (ms)
export const autoLockTime = 15 * 60 * 1000;

/* offline mode is special case of error */
export const offlineModeString = 'Offline';
/* Default network to connect after wallet creation (see network.js) */
export const defaultNetwork = 'Sepolia Testnet';

/* encrypted wallet (see utils/wallet.js) is saved to local storage under this key */
export const localStorageKey = 'wallet';

// addresses:
export const github = 'https://github.com/PaulLaux/eth-hot-wallet';

// APIs:
// Keyless CoinGecko endpoint, queried with ?ids=<coinGeckoId>&vs_currencies=...
export const coinGeckoPriceApi = 'https://api.coingecko.com/api/v3/simple/price';
