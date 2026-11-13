# BTC Hot Wallet

A Bitcoin and Litecoin web wallet. Keys are generated, stored and used for signing inside the page, so it needs no extension or external signer.

Background: the Bitcoin version of [ETH Hot Wallet](https://eth.hot-wallet.org) ([how that was built](https://medium.freecodecamp.org/how-to-build-an-ethereum-wallet-web-app-ac77dcaac573), Medium).

## Features

- BIP-39 seed (12 words; 24 also accepted on restore) and native SegWit addresses on the BIP-84 path (`m/84'/0'/0'/0/n`, Litecoin `m/84'/2'/0'/0/n`, test networks `m/84'/1'/0'/0/n`), so the seed also works in other wallets such as Sparrow
- The seed is stored in the browser, encrypted with your password (PBKDF2 + AES-GCM)
- Transactions are built and signed in the page; you check the amount, both addresses and the fee before sending
- Fee: slow, normal or fast; transactions signal replace-by-fee
- Change goes back to the sending address, or to the fee when it is too small for nodes to relay (546 sats, 5460 on Litecoin); coins of 546 sats or less are never spent (they may carry inscriptions)
- Restoring a seed finds the addresses it used before
- Balances count confirmed transactions only; unconfirmed ones show as a note below
- Locks itself 15 minutes after unlocking
- Content Security Policy: the page runs only its own scripts and connects only to its APIs and CoinGecko
- Networks: Bitcoin, Testnet4, Signet, Litecoin, Litecoin Testnet or offline
- Balances converted to USD and EUR
- Responsive layout for mobile

## Networks and APIs

- Public [Esplora](https://github.com/Blockstream/esplora/blob/master/API.md) APIs, no key and no server of our own: [mempool.space](https://mempool.space/docs/api/rest), with blockstream.info as fallback when it fails, limits requests or doesn't answer within 15 seconds
- Litecoin: [litecoinspace.org](https://litecoinspace.org), a mempool.space fork (no fallback)
- [CoinGecko](https://www.coingecko.com/) for exchange rates

The wallet checks that each API serves the chosen network (its genesis block hash), and checks each coin's amount against its funding transaction before signing. The API operators see your IP address and every address the wallet looks up.

## Development

Requires Node.js 20.19+ or 22.12+.

| Command | |
| --- | --- |
| `npm start` | Dev server with live reload at http://localhost:3001 |
| `npm run build` | Production bundle in `build/` |
| `npm run preview` | Serve the production bundle locally |
| `npm test` | Run the tests (Vitest) |
| `npm run lint` | Lint (ESLint) |

Built with [@scure/btc-signer](https://github.com/paulmillr/scure-btc-signer) (addresses, transactions, signing, Esplora client), [@scure/bip32 and bip39](https://github.com/paulmillr/scure-bip32), [react-boilerplate](https://github.com/react-boilerplate/react-boilerplate) (React, Redux, Redux-Saga, Reselect), [Ant Design](https://github.com/ant-design/ant-design) and [Vite](https://vite.dev).

### Code layout

- `app/utils/bitcoin.js`: the chains (Bitcoin, Litecoin, their test networks), addresses, keys, building and signing transactions
- `app/utils/esplora.js`: network access (balances, coins, fee rates, broadcast) with API failover
- `app/utils/wallet.js`: seed encryption and the stored addresses
- `app/containers/HomePage`: wallet actions (create, restore, unlock, add address, save and load)
- `app/containers/Header`: all network communication (connect, restore scan, balances, sending, exchange rates) in `saga.js`; the networks in `network.js`
- `app/containers/SendToken`: state of the send dialog; checks and sending happen in Header

## License

MIT, see `LICENSE.md`.
