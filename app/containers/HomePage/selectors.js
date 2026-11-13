/**
 * Homepage selectors
 */

import { createSelector } from 'reselect';

const selectHome = (state) => state.home;


const makeSelectIsShowGenerateWallet = () => createSelector(
  selectHome,
  (homeState) => homeState.isShowGenerateWallet
);

const makeSelectGenerateWalletLoading = () => createSelector(
  selectHome,
  (homeState) => homeState.generateWalletLoading
);

const makeSelectGenerateWalletError = () => createSelector(
  selectHome,
  (homeState) => homeState.generateWalletError
);


const makeSelectGenerateKeystoreLoading = () => createSelector(
  selectHome,
  (homeState) => homeState.generateKeystoreLoading
);

const makeSelectGenerateKeystoreError = () => createSelector(
  selectHome,
  (homeState) => homeState.generateKeystoreError
);

const makeSelectRestoreWalletError = () => createSelector(
  selectHome,
  (homeState) => homeState.restoreWalletError
);

const makeSelectSeed = () => createSelector(
  selectHome,
  (homeState) => homeState.seed
);

const makeSelectPassword = () => createSelector(
  selectHome,
  (homeState) => homeState.password
);

const makeSelectIsComfirmed = () => createSelector(
  selectHome,
  (homeState) => homeState.isComfirmed
);


const makeSelectKeystore = () => createSelector(
  selectHome,
  (homeState) => homeState.keystore
);

const makeSelectShowRestoreWallet = () => createSelector(
  selectHome,
  (homeState) => homeState.isShowRestoreWallet
);

const makeSelectUserSeed = () => createSelector(
  selectHome,
  (homeState) => homeState.userSeed
);
const makeSelectUserPassword = () => createSelector(
  selectHome,
  (homeState) => homeState.userPassword
);

const makeSelectIsShowSendToken = () => createSelector(
  selectHome,
  (homeState) => homeState.isShowSendToken
);

/** 'main' or 'test': the chain of the addresses shown */
const makeSelectChain = () => createSelector(
  selectHome,
  (homeState) => homeState.chain
);

/** { address1: { index: 1, balance: satsString / false, unconfirmed: satsString }, ... } */
const makeSelectAddressMap = () => createSelector(
  selectHome,
  (homeState) => homeState.addressList
);


const makeSelectAddressListLoading = () => createSelector(
  selectHome,
  (homeState) => homeState.addressListLoading
);
const makeSelectAddressListError = () => createSelector(
  selectHome,
  (homeState) => homeState.addressListError
);
const makeSelectAddressListMsg = () => createSelector(
  selectHome,
  (homeState) => homeState.addressListMsg
);
const makeSelectExchangeRates = () => createSelector(
  selectHome,
  (homeState) => homeState.exchangeRates
);

const makeSelectConvertTo = () => createSelector(
  selectHome,
  (homeState) => homeState.convertTo
);

const makeSelectSaveWalletLoading = () => createSelector(
  selectHome,
  (homeState) => homeState.saveWalletLoading
);
const makeSelectSaveWalletError = () => createSelector(
  selectHome,
  (homeState) => homeState.saveWalletError
);
const makeSelectLoadWalletLoading = () => createSelector(
  selectHome,
  (homeState) => homeState.loadWalletLoading
);
const makeSelectLoadwalletError = () => createSelector(
  selectHome,
  (homeState) => homeState.loadWalletError
);

export {
  selectHome,
  makeSelectIsShowGenerateWallet,
  makeSelectGenerateWalletLoading,
  makeSelectGenerateWalletError,
  makeSelectGenerateKeystoreLoading,
  makeSelectGenerateKeystoreError,
  makeSelectRestoreWalletError,
  makeSelectSeed,
  makeSelectPassword,
  makeSelectIsComfirmed,
  makeSelectKeystore,
  makeSelectShowRestoreWallet,
  makeSelectUserSeed,
  makeSelectUserPassword,
  makeSelectIsShowSendToken,

  makeSelectAddressListLoading,
  makeSelectAddressListError,
  makeSelectAddressListMsg,
  makeSelectChain,
  makeSelectAddressMap,

  makeSelectExchangeRates,
  makeSelectConvertTo,

  makeSelectSaveWalletLoading,
  makeSelectSaveWalletError,
  makeSelectLoadWalletLoading,
  makeSelectLoadwalletError,
};
