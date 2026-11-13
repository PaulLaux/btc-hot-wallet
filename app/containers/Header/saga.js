import { all, take, call, delay, put, select, takeLatest, race, fork } from 'redux-saga/effects';

import {
  makeSelectKeystore,
  makeSelectPassword,
  makeSelectAddressMap,
} from 'containers/HomePage/selectors';
import {
  changeBalance,
  setExchangeRates,
  setAddresses,
} from 'containers/HomePage/actions';
import request from 'utils/request';

import {
  confirmSendTransactionSuccess,
  confirmSendTransactionError,
  sendTransactionSuccess,
  sendTransactionError,
} from 'containers/SendToken/actions';
import {
  makeSelectFrom,
  makeSelectTo,
  makeSelectAmount,
  makeSelectFeeSpeed,
  makeSelectPsbt,
} from 'containers/SendToken/selectors';
import {
  COMFIRM_SEND_TRANSACTION,
  SEND_TRANSACTION,
} from 'containers/SendToken/constants';

import {
  timeBetweenCheckbalances,
  offlineModeString,
  coinGeckoPriceApi,
  coinGeckoId,
} from 'utils/constants';
import { timer } from 'utils/common';
import { openVault, keyFor } from 'utils/wallet';
import { checkAddress, toSats, toBtc, buildTx, signTx } from 'utils/bitcoin';
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
    // the addresses of this network's chain, without the balances of the previous network
    yield put(setAddresses(keystore.addresses[network.chain], network.chain));

    // actions after succesfull network load :
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
      `Send ${toBtc(sats)} BTC on ${networkName}`,
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
export function* getBalance(address) {
  return (yield call([net, net.addressInfo], address)).balance;
}

export function* checkAllBalances() {
  try {
    const addresses = Object.keys(yield select(makeSelectAddressMap()));
    for (const address of addresses) {
      yield put(changeBalance(address, yield call(getBalance, address)));
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

// Start Polling when first call to checkAllBalances succeded or fails
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
 * Price of one coin per currency from CoinGecko: { usd: 94000.5, eur: 81000.25 }
 */
export function* getRates() {
  try {
    const prices = yield call(request, `${coinGeckoPriceApi}?ids=${coinGeckoId}&vs_currencies=usd,eur`);
    yield put(setExchangeRates(prices[coinGeckoId] || {}));
    yield put(getExchangeRatesSuccess());
  } catch (err) {
    yield put(getExchangeRatesError(err.message));
  }
}


// Individual exports for testing
export default function* defaultSaga() {
  yield takeLatest(LOAD_NETWORK, loadNetwork);
  yield takeLatest(COMFIRM_SEND_TRANSACTION, confirmSendTransaction);
  yield takeLatest(SEND_TRANSACTION, SendTransaction);
  yield takeLatest(GET_EXCHANGE_RATES, getRates);

  /* poll check balances */
  yield all([
    fork(watchPollData),
    takeLatest(CHECK_BALANCES, checkAllBalances),
  ]);
  /* End of poll check balances */
}
