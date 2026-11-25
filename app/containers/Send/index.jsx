/**
 *
 * Send
 *
 */

import React from 'react';
import { Modal, Button } from 'antd';
import { connect } from 'react-redux';
import { createStructuredSelector } from 'reselect';

import SendFrom from 'components/SendFrom';
import SendTo from 'components/SendTo';
import SendAmount from 'components/SendAmount';
import SendFee from 'components/SendFee';
import SendConfirmationView from 'components/SendConfirmationView';
import SendProgress from 'components/SendProgress';

import { makeSelectAddressMap, makeSelectCoin } from 'containers/HomePage/selectors';
import { makeSelectTxExplorer } from 'containers/Header/selectors';

import {
  changeFrom,
  changeAmount,
  changeTo,
  changeFeeSpeed,
  confirmSendTransaction,
  sendTransaction,
  abortTransaction,
} from './actions';

import {
  makeSelectFrom,
  makeSelectTo,
  makeSelectAmount,
  makeSelectFeeSpeed,
  makeSelectLocked,
  makeSelectConfirmationLoading,
  makeSelectConfirmationError,
  makeSelectConfirmationMsg,
  makeSelectIsSendConfirmationLocked,
  makeSelectSendInProgress,
  makeSelectSendError,
  makeSelectSendTx,
} from './selectors';

function Send(props) {
  const {
    isShowSend,
    onHideSend,

    from,
    to,
    addressList,
    coin,
    onChangeFrom,
    amount,
    locked,
    onChangeAmount,
    onChangeTo,
    feeSpeed,
    onChangeFeeSpeed,
    confirmationLoading,
    confirmationError,
    confirmationMsg,
    isSendConfirmationLocked,
    onConfirmSendTransaction,
    onSendTransaction,
    onAbortTransaction,

    sendInProgress,
    sendError,
    sendTx,

    txExplorer,
    } = props;

  const SendFromProps = { from, addressList, onChangeFrom, locked };
  const SendAmountProps = { amount, onChangeAmount, locked };
  const SendToProps = { to, onChangeTo, locked };
  const SendFeeProps = { feeSpeed, onChangeFeeSpeed, locked };

  const SendConfirmationViewProps = {
    confirmationLoading,
    confirmationError,
    confirmationMsg,
    onSendTransaction,
    onAbortTransaction,
    sendInProgress,
    isSendConfirmationLocked,
    sendError,
    coin,
  };
  const SendProgressProps = { sendInProgress, sendError, sendTx, txExplorer };

  const modalFooter = [
    <Button key="reset" type="default" size="large" onClick={onAbortTransaction}>
      Reset
    </Button>,
    <Button key="close" type="default" size="large" onClick={onHideSend}>
      Close
    </Button>,
  ];

  return (
    <div style={{ maxWidth: '600px', margin: 'auto' }}>
      <Modal
        open={isShowSend}
        title={`Send ${coin}`}
        onOk={onHideSend}
        onCancel={onHideSend}
        footer={modalFooter}
      >
        <SendFrom {...SendFromProps} /> <br />
        <SendAmount {...SendAmountProps} /> {coin}<br /> <br />
        <SendTo {...SendToProps} /> <br />
        <SendFee {...SendFeeProps} /> <br />
        <Button onClick={onConfirmSendTransaction} disabled={locked} >
          Create transaction
        </Button>
        <SendConfirmationView {...SendConfirmationViewProps} />
        <br />
        <SendProgress {...SendProgressProps} />
      </Modal>
    </div>
  );
}

const mapStateToProps = createStructuredSelector({
  from: makeSelectFrom(),
  to: makeSelectTo(),
  amount: makeSelectAmount(),
  feeSpeed: makeSelectFeeSpeed(),
  addressList: makeSelectAddressMap(),
  coin: makeSelectCoin(),

  locked: makeSelectLocked(),

  confirmationLoading: makeSelectConfirmationLoading(),
  confirmationError: makeSelectConfirmationError(),
  confirmationMsg: makeSelectConfirmationMsg(),

  isSendConfirmationLocked: makeSelectIsSendConfirmationLocked(),

  sendInProgress: makeSelectSendInProgress(),
  sendError: makeSelectSendError(),
  sendTx: makeSelectSendTx(),

  txExplorer: makeSelectTxExplorer(),

});

function mapDispatchToProps(dispatch) {
  return {
    onChangeFrom: (address) => {
      dispatch(changeFrom(address));
    },
    onChangeAmount: (amount) => {
      dispatch(changeAmount(amount));
    },
    onChangeTo: (evt) => {
      dispatch(changeTo(evt.target.value));
    },
    onChangeFeeSpeed: (evt) => {
      dispatch(changeFeeSpeed(evt.target.value));
    },
    onConfirmSendTransaction: (evt) => {
      if (evt !== undefined && evt.preventDefault) evt.preventDefault();
      dispatch(confirmSendTransaction());
    },
    onAbortTransaction: (evt) => {
      if (evt !== undefined && evt.preventDefault) evt.preventDefault();
      dispatch(abortTransaction());
    },
    onSendTransaction: (evt) => {
      if (evt !== undefined && evt.preventDefault) evt.preventDefault();
      dispatch(sendTransaction());
    },
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Send);
