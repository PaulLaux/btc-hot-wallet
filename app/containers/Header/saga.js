import { createWalletClient, formatEther, getAddress, http, isAddress, parseUnits, publicActions } from 'viem';
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
  makeSelectFee,
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
  symbol,
  decimals,
} from 'utils/constants';
import { timer } from 'utils/common';
import { openVault, accountFor } from 'utils/wallet';

import {
  makeSelectNetworkName,
  makeSelectPrevNetworkName,
} from './selectors';
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

// Client for the connected network (null when offline) and the chain ID it serves
let client = null;
let chainId = null;

/**
 * connect to rpc and check that it serves the expected chain
 */
export function* loadNetwork(action) {
  try {
    const rpcAddress = Network[action.networkName].rpc;
    if (!rpcAddress) {
      throw new Error(`${action.networkName} network not found`);
    }

    if (action.networkName === offlineModeString) {
      client = null;
      yield put(stopPollingBalances());
      yield put(loadNetworkError(offlineModeString));
      return;
    }

    const keystore = yield select(makeSelectKeystore());
    if (!keystore) {
      throw new Error('keystore not initiated - Create wallet before connecting');
    }

    client = null;
    const newClient = createWalletClient({ transport: http(rpcAddress) }).extend(publicActions);
    const newChainId = yield call([newClient, newClient.getChainId]);
    const expectedChainId = Network[action.networkName].chainId;
    if (expectedChainId && newChainId !== expectedChainId) {
      throw new Error(`RPC for ${action.networkName} serves chain ID ${newChainId}, expected ${expectedChainId}`);
    }
    const blockNumber = yield call([newClient, newClient.getBlockNumber]);
    [client, chainId] = [newClient, newChainId];

    yield call(timer, 600);

    yield put(loadNetworkSuccess(Number(blockNumber)));

    // other network: clear the balances of the old one
    const prevNetwork = yield select(makeSelectPrevNetworkName());
    if (prevNetwork !== action.networkName) {
      yield put(setAddresses(keystore.addresses));
    }

    // actions after succesfull network load :
    yield put(checkBalances());
    yield put(getExchangeRates());
  } catch (err) {
    yield put(loadNetworkError(err.shortMessage || err.message));
  }
}


/**
 * parseUnits that never rounds: parseUnits would round 0.0000005 USDC up to 0.000001,
 * and 0.0000001 USDC down to 0. More decimals than the coin has is an error instead.
 */
export function toUnits(amount, unitDecimals = decimals) {
  const fraction = String(amount).split('.')[1] || '';
  if (fraction.replace(/0+$/, '').length > unitDecimals) {
    throw new Error(`Amount can have at most ${unitDecimals} decimals`);
  }
  return parseUnits(String(amount), unitDecimals);
}

/**
 * Check the transaction and estimate gas and fees. The user confirms the full addresses, the network
 * and the max gas fee, and SendTransaction signs with exactly this gas and these fee caps.
 * (On Base and Optimism a small L1 data fee comes on top.)
 */
export function* confirmSendTransaction() {
  try {
    const fromAddress = yield select(makeSelectFrom());
    const amount = yield select(makeSelectAmount());
    const toAddress = yield select(makeSelectTo());

    if (!isAddress(fromAddress)) {
      throw new Error('Source address invalid');
    }

    if (amount <= 0) {
      throw new Error('Amount must be possitive');
    }
    const value = toUnits(amount);

    if (!isAddress(toAddress)) {
      throw new Error('Destenation address invalid');
    }

    if (!client) {
      throw new Error('Not connected to a network');
    }

    const [gas, { maxFeePerGas, maxPriorityFeePerGas }] = yield all([
      call([client, client.estimateGas], { account: fromAddress, to: toAddress, value }),
      call([client, client.estimateFeesPerGas]),
    ]);
    const networkName = yield select(makeSelectNetworkName());

    const msg = [
      `Send ${amount} ${symbol} on ${networkName}`,
      `From: ${getAddress(fromAddress)}`,
      `To: ${getAddress(toAddress)}`,
      `Max gas fee: ${formatEther(gas * maxFeePerGas)} ETH`,
    ].join('\n');
    const fee = { gas: String(gas), maxFeePerGas: String(maxFeePerGas), maxPriorityFeePerGas: String(maxPriorityFeePerGas) };
    yield put(confirmSendTransactionSuccess(msg, fee));
  } catch (err) {
    yield put(confirmSendTransactionError(err.shortMessage || err.message));
  }
}

/**
 * Sign the confirmed transfer locally and broadcast it. Not client.sendTransaction:
 * viem lets the node fill in the transaction (eth_fillTransaction), and the node's chain ID, gas
 * and fees then replace ours.
 */
export function* SendTransaction() {
  const keystore = yield select(makeSelectKeystore());
  try {
    const fromAddress = yield select(makeSelectFrom());
    const amount = yield select(makeSelectAmount());
    const toAddress = yield select(makeSelectTo());
    const password = yield select(makeSelectPassword());
    const fee = yield select(makeSelectFee());

    if (!password) {
      throw new Error('No password found - please unlock wallet before send');
    }
    if (!keystore) {
      throw new Error('No keystore found - please create wallet');
    }
    if (!client) {
      throw new Error('Not connected to a network');
    }
    const account = accountFor(keystore, yield call(openVault, keystore, password), fromAddress);

    const nonce = yield call([client, client.getTransactionCount], { address: account.address, blockTag: 'pending' });
    const serializedTransaction = yield call([account, account.signTransaction], {
      chainId,
      nonce,
      to: toAddress,
      value: toUnits(amount),
      gas: BigInt(fee.gas),
      maxFeePerGas: BigInt(fee.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(fee.maxPriorityFeePerGas),
    });
    const tx = yield call([client, client.sendRawTransaction], { serializedTransaction });

    yield put(sendTransactionSuccess(tx));
  } catch (err) {
    yield put(sendTransactionError(err.shortMessage || err.message));
  }
}


/* *************  Polling saga and polling flow for check balances ***************** */
// Balances are kept as decimal strings (wei): Redux state must be serializable
export function* getBalance(address) {
  return (yield call([client, client.getBalance], { address })).toString();
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
 * Price of one coin per currency from CoinGecko: { usd: 2238.55, eur: 2007.67, btc: 0.0294 }
 */
export function* getRates() {
  try {
    const prices = yield call(request, `${coinGeckoPriceApi}?ids=${coinGeckoId}&vs_currencies=usd,eur,btc`);
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
