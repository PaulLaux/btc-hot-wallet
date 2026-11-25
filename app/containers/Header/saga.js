import { all, take, call, delay, put, select, takeLatest, race, fork } from 'redux-saga/effects';
import { message } from 'antd';

import {
  makeSelectKeystore,
  makeSelectPassword,
  makeSelectAddressMap,
} from 'containers/HomePage/selectors';
import {
  changeBalance,
  setExchangeRates,
  setAddresses,
  generateKeystoreSuccess,
  saveWallet,
} from 'containers/HomePage/actions';
import request from 'utils/request';

import {
  confirmSendTransactionSuccess,
  confirmSendTransactionError,
  sendTransactionSuccess,
  sendTransactionError,
} from 'containers/Send/actions';
import {
  makeSelectFrom,
  makeSelectTo,
  makeSelectAmount,
  makeSelectFeeSpeed,
  makeSelectPsbt,
} from 'containers/Send/selectors';
import {
  CONFIRM_SEND_TRANSACTION,
  SEND_TRANSACTION,
} from 'containers/Send/constants';

import {
  timeBetweenCheckbalances,
  offlineModeString,
  coinGeckoPriceApi,
  coinGeckoIds,
} from 'utils/constants';
import { timer } from 'utils/common';
import { openVault, keyFor } from 'utils/wallet';
import { chains, deriveAddresses, checkAddress, toSats, fromSats, buildTx, signTx } from 'utils/bitcoin';
import { connect } from 'utils/esplora';

import { makeSelectNetworkName } from './selectors';
import {
  loadNetworkSuccess,
  loadNetworkError,

  checkBalances,
  checkBalancesSuccess,
  CheckBalancesError,
  stopPollingBalances,

  getExchangeRates,
  getExchangeRatesSuccess,
  getExchangeRatesError,
} from './actions';

import {
  LOAD_NETWORK,
  CHECK_BALANCES,
  CHECK_BALANCES_SUCCESS,
  CHECK_BALANCES_ERROR,
  STOP_POLL_BALANCES,
  GET_EXCHANGE_RATES,
} from './constants';

import Network from './network';

// Esplora client of the connected network (utils/esplora.js), null when offline
let net = null;
// networks checked for used addresses in this session, per wallet: '<vault salt> <network name>'
const scanned = new Set();
const usedAddresses = (addresses) => net.usedAddresses(addresses);
// unused addresses in a row after the last used one that end the restore scan: the gap limit of BIP-44, as in Ledger Live
export const GAP = 20;
const longer = (a, b) => (a.length > b.length ? a : b);

/**
 * The addresses of a branch (utils/bitcoin.js) up to its last used one: checks them in blocks, one request each
 * where the API allows (utils/esplora.js usedAddresses), until GAP unused addresses follow the last used one
 */
function* usedUpTo(seed, chain, branch) {
  const addresses = [];
  let count = 0; // the addresses up to the last used one
  while (addresses.length < count + GAP) {
    const block = deriveAddresses(seed, chain, addresses.length, count + GAP - addresses.length, branch);
    const used = yield call(usedAddresses, block);
    for (const address of block) {
      addresses.push(address);
      if (used.has(address)) count = addresses.length;
    }
  }
  return addresses.slice(0, count);
}

/**
 * After a restore, find the receive and change addresses the wallet used before (usedUpTo). Runs while the wallet
 * is unlocked (deriving addresses needs the seed), once per network and wallet per session. A mistyped passphrase opens a
 * valid but empty wallet: warns when a wallet with a passphrase has no used address on a main network.
 * @return {object|null} the keystore with the addresses up to the last used one of each branch, or null if it has them all
 */
export function* findUsedAddresses(networkName, chain, keystore) {
  const password = yield select(makeSelectPassword());
  const id = `${keystore.salt} ${networkName}`; // a wallet restored after Close wallet has another salt
  if (!password || scanned.has(id)) return null;
  try {
    const seed = yield call(openVault, keystore, password);
    const receive = yield* usedUpTo(seed, chain, 0);
    const change = yield* usedUpTo(seed, chain, 1);
    scanned.add(id);
    if (!receive.length && !change.length && keystore.hasPassphrase && chains[chain].coinType !== 1) { // coin type 1: test networks
      message.warning(`No used address on ${networkName}: if this wallet has coins there, check the passphrase`, 15);
    }
    // receive addresses added after the last used one stay
    if (receive.length <= keystore.addresses[chain].length && change.length <= keystore.change[chain].length) return null;
    return {
      ...keystore,
      addresses: { ...keystore.addresses, [chain]: longer(receive, keystore.addresses[chain]) },
      change: { ...keystore.change, [chain]: longer(change, keystore.change[chain]) },
    };
  } catch (err) {
    message.warning(`Could not check for used addresses: ${err.message}`, 10);
    return null;
  }
}

/**
 * Connect to the network's API, check that it serves this network, and show the network's addresses
 */
export function* loadNetwork(action) {
  try {
    const network = Network[action.networkName];
    if (!network) {
      throw new Error(`${action.networkName} network not found`);
    }

    if (action.networkName === offlineModeString) {
      net = null;
      yield put(stopPollingBalances());
      yield put(loadNetworkError(offlineModeString));
      return;
    }

    const keystore = yield select(makeSelectKeystore());
    if (!keystore) {
      throw new Error('keystore not initiated - Create wallet before connecting');
    }

    net = null;
    const newNet = connect(network);
    const height = yield call([newNet, newNet.height]);
    net = newNet;

    yield call(timer, 600);

    yield put(loadNetworkSuccess(height));
    const found = yield call(findUsedAddresses, action.networkName, network.chain, keystore);
    if (found) {
      yield put(generateKeystoreSuccess(found, network.chain)); // the keystore with the used addresses, shown
      yield put(saveWallet());
    } else {
      // the addresses of this network's chain, without the balances of the previous network
      yield put(setAddresses(keystore, network.chain));
    }

    // actions after successful network load :
    yield put(checkBalances());
    yield put(getExchangeRates());
  } catch (err) {
    yield put(loadNetworkError(err.message));
  }
}

/**
 * Build the transaction: fetch the coins of the source address and the fee rate, select the coins.
 * The user checks the amount, network, full addresses and fee; SendTransaction then signs exactly
 * this transaction.
 */
export function* confirmSendTransaction() {
  try {
    const from = yield select(makeSelectFrom());
    const amount = yield select(makeSelectAmount());
    const to = yield select(makeSelectTo());
    const feeSpeed = yield select(makeSelectFeeSpeed());
    const networkName = yield select(makeSelectNetworkName());

    const sats = toSats(amount);
    if (!net) {
      throw new Error('Not connected to a network');
    }
    const { chain } = Network[networkName];
    checkAddress(to, chain);

    const [coins, feeRate] = yield all([call([net, net.coins], from), call([net, net.feeRate], feeSpeed)]);
    const tx = buildTx(coins, from, to, sats, feeRate, chain);

    const msg = [
      `Send ${fromSats(sats)} ${chains[chain].coin} on ${networkName}`,
      `From: ${from}`,
      `To: ${to}`,
      `Fee: ${tx.fee} sats (${feeRate} sat/vB, ${tx.inputs} ${tx.inputs === 1 ? 'coin' : 'coins'} spent)`,
    ].join('\n');
    yield put(confirmSendTransactionSuccess(msg, tx.psbt));
  } catch (err) {
    yield put(confirmSendTransactionError(err.message));
  }
}

/**
 * Sign the confirmed transaction locally and broadcast it
 */
export function* SendTransaction() {
  try {
    const keystore = yield select(makeSelectKeystore());
    const from = yield select(makeSelectFrom());
    const password = yield select(makeSelectPassword());
    const psbt = yield select(makeSelectPsbt());
    const networkName = yield select(makeSelectNetworkName());

    if (!password) {
      throw new Error('No password found - please unlock wallet before send');
    }
    if (!keystore) {
      throw new Error('No keystore found - please create wallet');
    }
    if (!net) {
      throw new Error('Not connected to a network');
    }
    const key = keyFor(keystore, yield call(openVault, keystore, password), Network[networkName].chain, from);
    const tx = signTx(psbt, key);
    yield call([net, net.broadcast], tx.hex);

    yield put(sendTransactionSuccess(tx.id));
  } catch (err) {
    yield put(sendTransactionError(err.message));
  }
}


/* *************  Polling saga and polling flow for check balances ***************** */
// Balances are kept as decimal strings (sats): Redux state must be serializable
export function* checkBalance(address) {
  const { balance, unconfirmed, used } = yield call([net, net.addressInfo], address);
  yield put(changeBalance(address, balance, unconfirmed, used));
}

export function* checkAllBalances() {
  try {
    const addresses = Object.keys(yield select(makeSelectAddressMap()));
    for (const address of addresses) {
      yield call(checkBalance, address);
    }
    yield put(checkBalancesSuccess());
  } catch (err) {
    yield put(CheckBalancesError(err.message));
  }
}

// Fetch data every X seconds
function* pollData() {
  try {
    // console.log('pollData');
    yield delay(timeBetweenCheckbalances);

    yield put(checkBalances());
  } catch {
    // console.log('pollData Error');
    // cancellation error -- can handle this if you wish
  }
}

// Start Polling when first call to checkAllBalances succeeded or fails
// Wait for successful response or fail, then fire another request
// Cancel polling on STOP_POLL_BALANCES
function* watchPollData() {
  while (true) {
    yield take([CHECK_BALANCES_SUCCESS, CHECK_BALANCES_ERROR]);
    yield race([
      call(pollData),
      take(STOP_POLL_BALANCES),
    ]);
  }
}
/* ******************************************************************************** */

/**
 * Price of each coin per currency from CoinGecko: { BTC: { usd: 94000.5, eur: 81000.25 }, ... }
 */
export function* getRates() {
  try {
    const prices = yield call(request, `${coinGeckoPriceApi}?ids=${Object.values(coinGeckoIds).join(',')}&vs_currencies=usd,eur`);
    yield put(setExchangeRates(Object.fromEntries(Object.entries(coinGeckoIds).map(([coin, id]) => [coin, prices[id] || {}]))));
    yield put(getExchangeRatesSuccess());
  } catch (err) {
    yield put(getExchangeRatesError(err.message));
  }
}


// Individual exports for testing
export default function* defaultSaga() {
  yield takeLatest(LOAD_NETWORK, loadNetwork);
  yield takeLatest(CONFIRM_SEND_TRANSACTION, confirmSendTransaction);
  yield takeLatest(SEND_TRANSACTION, SendTransaction);
  yield takeLatest(GET_EXCHANGE_RATES, getRates);

  /* poll check balances */
  yield all([
    fork(watchPollData),
    takeLatest(CHECK_BALANCES, checkAllBalances),
  ]);
  /* End of poll check balances */
}
