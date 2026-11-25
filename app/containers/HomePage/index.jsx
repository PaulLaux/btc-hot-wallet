/*
 * HomePage
 *
 * This is the first thing users see of our App, at the '/' route
 *
 * NOTE: while this component should technically be a stateless functional
 * component (SFC), hot reloading does not currently support SFCs. If hot
 * reloading is not a necessity for you then you can refactor it and remove
 * the linting exception.
 */

import React from 'react';

import { connect } from 'react-redux';
import { createStructuredSelector } from 'reselect';

/* Components:  */
import AddressView from 'components/AddressView';
import Send from 'containers/Send';
import GenerateWalletModal from 'components/GenerateWalletModal';
import RestoreWalletModal from 'components/RestoreWalletModal';
import SubHeader from 'components/SubHeader';
import PageFooter from 'components/PageFooter';
import { Content } from 'components/PageFooter/sticky';

/* Header: */
import Header from 'containers/Header';
import { loadNetwork, checkBalances, getExchangeRates } from 'containers/Header/actions';
import {
  makeSelectNetworkReady,
  makeSelectCheckingBalanceDoneTime,
  makeSelectCheckingBalances,
  makeSelectCheckingBalancesError,
  makeSelectGetExchangeRatesDoneTime,
  makeSelectGetExchangeRatesLoading,
  makeSelectGetExchangeRatesError,
} from 'containers/Header/selectors';

/* HomePage */
import {
  generateWallet,
  generateWalletCancel,
  showRestoreWallet,
  restoreWalletCancel,
  generateKeystore,
  changeUserSeed,
  changeUserPassword,
  restoreWalletFromSeed,
  showSend,
  hideSend,
  generateAddress,
  lockWallet,
  unlockWallet,
  selectCurrency,
  closeWallet,
  saveWallet,
  loadWallet,
} from './actions';

import {
  makeSelectIsShowGenerateWallet,
  makeSelectGenerateWalletLoading,
  makeSelectGenerateWalletError,
  makeSelectSeed,
  makeSelectGenerateKeystoreLoading,
  makeSelectGenerateKeystoreError,
  makeSelectRestoreWalletError,
  makeSelectPassword,
  makeSelectIsConfirmed,
  makeSelectUserSeed,
  makeSelectUserPassword,
  makeSelectAddressMap,
  makeSelectShowRestoreWallet,
  makeSelectIsShowSend,
  makeSelectAddressListLoading,
  makeSelectAddressListError,
  makeSelectAddressListMsg,
  makeSelectExchangeRates,
  makeSelectCoin,
  makeSelectConvertTo,
  makeSelectSaveWalletLoading,
  makeSelectSaveWalletError,
  makeSelectLoadWalletLoading,
  makeSelectLoadwalletError,
} from './selectors';

export class HomePage extends React.PureComponent {
  componentDidMount() {
    this.props.onLoadWallet();
  }

  render() {
    const {
      onGenerateWallet,
      onGenerateWalletCancel,
      isShowGenerateWallet,
      generateWalletLoading,
      generateWalletError,

      generateKeystoreLoading,
      generateKeystoreError,
      seed,
      password,
      restoreWalletError,
      onGenerateKeystore,
      onGenerateAddress,
      onCheckBalances,
      isConfirmed,
      addressMap,
      coin,

      onShowRestoreWallet,
      isShowRestoreWallet,
      userSeed,
      userPassword,
      onChangeUserSeed,
      onChangeUserPassword,
      onRestoreWalletFromSeed,
      onRestoreWalletCancel,

      isShowSend,
      onShowSend,
      onHideSend,

      addressListLoading,
      addressListError,
      addressListMsg,

      networkReady,
      checkingBalanceDoneTime,
      checkingBalances,
      checkingBalancesError,

      onLockWallet,
      onUnlockWallet,

      exchangeRates,
      onSelectCurrency,
      convertTo,

      onGetExchangeRates,
      getExchangeRatesDoneTime,
      getExchangeRatesLoading,
      getExchangeRatesError,
      onCloseWallet,

      onSaveWallet,
      saveWalletLoading,
      saveWalletError,
      onLoadWallet,
      loadWalletLoading,
      loadWalletError,
    } = this.props;

    const subHeaderProps = {
      onGenerateWallet,
      onShowRestoreWallet,
      isConfirmed,
      onCloseWallet,
      onLockWallet,
      password,
      onUnlockWallet,

      onSaveWallet,
      saveWalletLoading,
      saveWalletError,
      onLoadWallet,
      loadWalletLoading,
      loadWalletError,
    };

    const generateWalletProps = {
      isShowGenerateWallet,
      generateWalletLoading,
      generateWalletError,

      seed,
      password,

      onGenerateWallet,
      onGenerateWalletCancel,
      onGenerateKeystore,
    };
    const restoreWalletModalProps = {
      isShowRestoreWallet,
      userSeed,
      userPassword,
      restoreWalletError,
      onChangeUserSeed,
      onChangeUserPassword,
      onRestoreWalletCancel,
      onRestoreWalletFromSeed,
    };

    const addressViewProps = {
      generateKeystoreLoading,
      generateKeystoreError,
      isConfirmed,
      addressMap,
      coin,

      onShowSend,

      onCheckBalances,
      onGenerateAddress,
      addressListLoading,
      addressListError,
      addressListMsg,
      networkReady,
      checkingBalanceDoneTime,
      checkingBalances,
      checkingBalancesError,
      onSelectCurrency,
      exchangeRates,
      convertTo,
      onGetExchangeRates,
      getExchangeRatesDoneTime,
      getExchangeRatesLoading,
      getExchangeRatesError,
    };

    const sendProps = { isShowSend, onHideSend };

    return (
      <div>
        <Content>
          <Header />
          <SubHeader {...subHeaderProps} />
          <GenerateWalletModal {...generateWalletProps} />
          <RestoreWalletModal {...restoreWalletModalProps} />
          <AddressView {...addressViewProps} />
          <Send {...sendProps} />
        </Content>
        <PageFooter />
      </div>
    );
  }
}

export function mapDispatchToProps(dispatch) {
  return {
    onGenerateWallet: (evt) => {
      if (evt !== undefined && evt.preventDefault) evt.preventDefault();
      dispatch(generateWallet());
    },
    onGenerateWalletCancel: (evt) => {
      if (evt !== undefined && evt.preventDefault) evt.preventDefault();
      dispatch(generateWalletCancel());
    },
    onGenerateKeystore: (evt) => {
      if (evt !== undefined && evt.preventDefault) evt.preventDefault();
      dispatch(generateKeystore());
    },
    onGenerateAddress: (evt) => {
      if (evt !== undefined && evt.preventDefault) evt.preventDefault();
      dispatch(generateAddress());
    },
    onLoadNetwork: (evt) => {
      if (evt !== undefined && evt.preventDefault) evt.preventDefault();
      dispatch(loadNetwork('local'));
    },
    onShowRestoreWallet: (evt) => {
      if (evt !== undefined && evt.preventDefault) evt.preventDefault();
      dispatch(showRestoreWallet());
    },
    onRestoreWalletCancel: (evt) => {
      if (evt !== undefined && evt.preventDefault) evt.preventDefault();
      dispatch(restoreWalletCancel());
    },
    onChangeUserSeed: (evt) => {
      if (evt !== undefined && evt.preventDefault) evt.preventDefault();
      // console.log(evt.target);
      dispatch(changeUserSeed(evt.target.value));
    },
    onChangeUserPassword: (evt) => {
      if (evt !== undefined && evt.preventDefault) evt.preventDefault();
      // console.log(evt.target);
      dispatch(changeUserPassword(evt.target.value));
    },
    onRestoreWalletFromSeed: (passphrase) => {
      dispatch(restoreWalletFromSeed(passphrase));
    },
    onCheckBalances: (evt) => {
      if (evt !== undefined && evt.preventDefault) evt.preventDefault();
      dispatch(checkBalances());
    },
    onShowSend: (address) => {
      dispatch(showSend(address));
    },
    onHideSend: () => {
      dispatch(hideSend());
    },
    onLockWallet: (evt) => {
      if (evt !== undefined && evt.preventDefault) evt.preventDefault();
      dispatch(lockWallet());
    },
    onUnlockWallet: (evt) => {
      if (evt !== undefined && evt.preventDefault) evt.preventDefault();
      dispatch(unlockWallet());
    },
    onSelectCurrency: (convertTo) => {
      // if (evt !== undefined && evt.preventDefault) evt.preventDefault();
      dispatch(selectCurrency(convertTo));
    },
    onGetExchangeRates: () => {
      // if (evt !== undefined && evt.preventDefault) evt.preventDefault();
      dispatch(getExchangeRates());
    },
    onCloseWallet: () => {
      dispatch(closeWallet());
    },
    onSaveWallet: () => {
      dispatch(saveWallet());
    },
    onLoadWallet: () => {
      dispatch(loadWallet());
    },
  };
}

const mapStateToProps = createStructuredSelector({
  isShowGenerateWallet: makeSelectIsShowGenerateWallet(),
  generateWalletLoading: makeSelectGenerateWalletLoading(),
  generateWalletError: makeSelectGenerateWalletError(),
  seed: makeSelectSeed(),
  password: makeSelectPassword(),

  generateKeystoreLoading: makeSelectGenerateKeystoreLoading(),
  generateKeystoreError: makeSelectGenerateKeystoreError(),
  restoreWalletError: makeSelectRestoreWalletError(),
  isConfirmed: makeSelectIsConfirmed(),
  addressMap: makeSelectAddressMap(),
  // keystore: makeSelectKeystore(),
  isShowRestoreWallet: makeSelectShowRestoreWallet(),
  userSeed: makeSelectUserSeed(),
  userPassword: makeSelectUserPassword(),

  isShowSend: makeSelectIsShowSend(),

  addressListLoading: makeSelectAddressListLoading(),
  addressListError: makeSelectAddressListError(),
  addressListMsg: makeSelectAddressListMsg(),

  networkReady: makeSelectNetworkReady(),
  checkingBalanceDoneTime: makeSelectCheckingBalanceDoneTime(),
  checkingBalances: makeSelectCheckingBalances(),
  checkingBalancesError: makeSelectCheckingBalancesError(),

  exchangeRates: makeSelectExchangeRates(),
  coin: makeSelectCoin(),
  convertTo: makeSelectConvertTo(),

  getExchangeRatesDoneTime: makeSelectGetExchangeRatesDoneTime(),
  getExchangeRatesLoading: makeSelectGetExchangeRatesLoading(),
  getExchangeRatesError: makeSelectGetExchangeRatesError(),

  saveWalletLoading: makeSelectSaveWalletLoading(),
  saveWalletError: makeSelectSaveWalletError(),
  loadWalletLoading: makeSelectLoadWalletLoading(),
  loadWalletError: makeSelectLoadwalletError(),
});

export default connect(mapStateToProps, mapDispatchToProps)(HomePage);
