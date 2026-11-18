/**
 * Wallet operations
 */
import { call, put, race, select, take, takeLatest } from 'redux-saga/effects';

import {
  GENERATE_WALLET,
  GENERATE_KEYSTORE,
  RESTORE_WALLET_FROM_SEED,
  GENERATE_ADDRESS,
  LOCK_WALLET,
  UNLOCK_WALLET,
  UNLOCK_WALLET_SUCCESS,
  CLOSE_WALLET,
  SHOW_SEND_TOKEN,
  SAVE_WALLET,
  LOAD_WALLET,
} from 'containers/HomePage/constants';

import {
  makeSelectPassword,
  makeSelectSeed,
  makeSelectUserSeed,
  makeSelectUserPassword,
  makeSelectKeystore,
  makeSelectChain,
} from 'containers/HomePage/selectors';

import { loadNetwork } from 'containers/Header/actions';
import Network from 'containers/Header/network';

import { changeFrom } from 'containers/SendToken/actions';

import generateString from 'utils/crypto';
import askPassword from 'utils/askPassword';
import { newMnemonic, isMnemonicValid, createVault, openVault, addAddress } from 'utils/wallet';
import { chains } from 'utils/bitcoin';

import { generatedPasswordLength, offlineModeString, defaultNetwork, localStorageKey, autoLockTime } from 'utils/constants';

import { timer } from 'utils/common';

import { checkBalance } from 'containers/Header/saga';

import {
  generateWalletSucces,
  generateWalletError,
  generateKeystoreSuccess,
  generateKeystoreError,
  changeUserSeed,
  generateKeystore,
  restoreWalletFromSeedError,
  restoreWalletFromSeedSuccess,
  generateAddressSuccess,
  generateAddressError,
  lockWallet,
  unlockWalletSuccess,
  unlockWalletError,
  saveWallet,
  saveWalletSuccess,
  saveWalletError,
  loadWalletSuccess,
  loadWalletError,
} from './actions';

/**
 * Create new seed and password
 */
export function* generateWallet() {
  try {
    const password = generateString(generatedPasswordLength);
    const seed = newMnemonic();

    yield call(timer, 500);

    yield put(generateWalletSucces(seed, password));
  } catch (err) {
    yield put(generateWalletError(err.message));
  }
}


/**
 * check seed given by user; the passphrase (BIP-39, '' for none) goes on to the keystore
 */
export function* restoreFromSeed({ passphrase }) {
  try {
    const userPassword = yield select(makeSelectUserPassword());
    let userSeed = yield select(makeSelectUserSeed());

    // remove trailing spaces if needed
    yield put(changeUserSeed(userSeed.replace(/^\s+|\s+$/g, '')));
    userSeed = yield select(makeSelectUserSeed());

    if (!isMnemonicValid(userSeed)) {
      yield put(restoreWalletFromSeedError('Invalid seed'));
      return;
    }

    if (userPassword.length < 8) {
      yield put(restoreWalletFromSeedError('Password length must be 8 characters at least'));
      return;
    }

    yield put(restoreWalletFromSeedSuccess(userSeed, userPassword));
    yield put(generateKeystore(passphrase));
  } catch (err) {
    yield put(restoreWalletFromSeedError(err.message));
  }
}

/**
 * Create new keystore with the first address
 */
export function* genKeystore({ passphrase }) {
  try {
    const password = yield select(makeSelectPassword());
    const seedPhrase = yield select(makeSelectSeed());
    // allow time to render components before cpu intensive tasks:
    yield call(timer, 300);

    const ks = yield call(createVault, seedPhrase, password, passphrase);

    yield put(generateKeystoreSuccess(ks, Network[defaultNetwork].chain));
    yield put(loadNetwork(defaultNetwork));
    yield put(saveWallet());
  } catch (err) {
    const errorString = `genKeystore error - ${err}`;
    yield put(generateKeystoreError(errorString));
  }
}


/**
 * Generate new address from same key
 * will run after GENERATE_ADDRESS action
 */
export function* generateAddress() {
  try {
    const ks = yield select(makeSelectKeystore());
    if (!ks) {
      throw new Error('No keystore found');
    }

    const password = yield select(makeSelectPassword());
    if (!password) {
      throw new Error('Wallet Locked');
    }

    const chain = yield select(makeSelectChain());
    const newKs = addAddress(ks, yield call(openVault, ks, password), chain);
    const newAddress = newKs.addresses[chain].at(-1);
    yield put(generateAddressSuccess(newKs, newAddress));
    yield put(saveWallet());

    // balance checking for new address (will be aborted in offline mode)
    try {
      yield call(checkBalance, newAddress);
    } catch { /* offline */ }
  } catch (err) {
    yield call(timer, 1000); // eye candy
    yield put(generateAddressError(err.message));
  }
}

/**
 * unlock wallet using user given password
 */
export function* unlockWallet() {
  try {
    const currentPassword = yield select(makeSelectPassword());
    if (currentPassword) {
      throw Error('Wallet Already unlocked');
    }

    const ks = yield select(makeSelectKeystore());
    if (!ks) {
      throw new Error('No keystore to unlock');
    }

    const userPassword = yield call(askPassword);
    if (!userPassword) {
      throw Error('No password entered');
    }

    yield call(openVault, ks, userPassword);
    yield put(unlockWalletSuccess(userPassword));
  } catch (err) {
    const errorString = `Unlock wallet error - ${err.message}`;
    yield put(unlockWalletError(errorString));
  }
}

/**
 * Lock the wallet after autoLockTime unless it is locked or closed before
 */
export function* autoLock() {
  const { timeout } = yield race({ timeout: call(timer, autoLockTime), locked: take([LOCK_WALLET, CLOSE_WALLET]) });
  if (timeout) {
    yield put(lockWallet());
  }
}

/**
 * change source address when opening send modal
 */
export function* changeSourceAddress(action) {
  if (action.address) {
    yield put(changeFrom(action.address));
  }
}

/**
 * Disconnect from network during closeWallet
 */
export function* closeWallet() {
  yield deleteWallet();
  yield put(loadNetwork(offlineModeString));
}

/**
 * Save wallet to localStorage
 */
export function* saveWalletS() {
  try {
    const ks = yield select(makeSelectKeystore());
    if (!ks) {
      throw new Error('No keystore defined');
    }

    localStorage.setItem(localStorageKey, JSON.stringify(ks));

    yield put(saveWalletSuccess());
  } catch (err) {
    const errorString = `${err.message}`;
    yield put(saveWalletError(errorString));
  }
}

/**
 * Load wallet from localStorage
 */
export function* loadWalletS() {
  try {
    yield call(timer, 1000);
    const existingKs = yield select(makeSelectKeystore());
    if (existingKs) {
      throw new Error('Existing keystore present  - aborting load form localStorage');
    }

    const ks = JSON.parse(localStorage.getItem(localStorageKey));
    if (!ks) {
      throw new Error('No keystore found in localStorage');
    }
    // a wallet saved before Litecoin has none of its addresses (shown empty until one is added), one saved before
    // change addresses none of those
    const empty = Object.fromEntries(Object.keys(chains).map((chain) => [chain, []]));
    ks.addresses = { ...empty, ...ks.addresses };
    ks.change = { ...empty, ...ks.change };

    yield put(generateKeystoreSuccess(ks, Network[defaultNetwork].chain));
    yield put(loadNetwork(defaultNetwork));
    yield put(loadWalletSuccess());
  } catch (err) {
    const errorString = `${err.message}`;
    yield put(loadWalletError(errorString));
  }
}

/**
 * Delete the saved wallet from localStorage, and nothing else: another wallet (such as ETH Hot Wallet)
 * may store its vault on the same origin
 */
export function* deleteWallet() {
  try {
    localStorage.removeItem(localStorageKey);
  } catch { /* storage blocked by the browser: nothing was saved */ }
}

/**
 * Root saga manages watcher lifecycle
 */
export default function* walletData() {
  // Watches for INIT_WALLET actions and calls initKS when one comes in.
  // By using `takeLatest` only the result of the latest API call is applied.
  // It returns task descriptor (just like fork) so we can continue execution

  yield takeLatest(GENERATE_WALLET, generateWallet);
  yield takeLatest(GENERATE_KEYSTORE, genKeystore);
  yield takeLatest(GENERATE_ADDRESS, generateAddress);
  yield takeLatest(RESTORE_WALLET_FROM_SEED, restoreFromSeed);
  yield takeLatest(UNLOCK_WALLET, unlockWallet);
  // a new or restored wallet starts unlocked
  yield takeLatest([UNLOCK_WALLET_SUCCESS, GENERATE_KEYSTORE], autoLock);
  yield takeLatest(SHOW_SEND_TOKEN, changeSourceAddress);
  yield takeLatest(CLOSE_WALLET, closeWallet);

  yield takeLatest(SAVE_WALLET, saveWalletS);
  yield takeLatest(LOAD_WALLET, loadWalletS);
}
