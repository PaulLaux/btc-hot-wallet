/**
 *
 * SendToken
 *
 */

import React from 'react';
import { Modal, Button } from 'antd';
import { connect } from 'react-redux';
import { createStructuredSelector } from 'reselect';

import SendFrom from 'components/SendFrom';
import SendTo from 'components/SendTo';
import SendAmount from 'components/SendAmount';
import SendConfirmationView from 'components/SendConfirmationView';
import SendProgress from 'components/SendProgress';

import { makeSelectAddressMap } from 'containers/HomePage/selectors';
import { makeSelectTxExplorer } from 'containers/Header/selectors';
import { symbol } from 'utils/constants';

import {
  changeFrom,
  changeAmount,
  changeTo,
  confirmSendTransaction,
  sendTransaction,
  abortTransaction,
} from './actions';

import {
  makeSelectFrom,
  makeSelectTo,
  makeSelectAmount,
  makeSelectLocked,
  makeSelectComfirmationLoading,
  makeSelectConfirmationError,
  makeSelectConfirmationMsg,
  makeSelectIsSendComfirmationLocked,
  makeSelectSendInProgress,
  makeSelectSendError,
  makeSelectSendTx,
} from './selectors';

function SendToken(props) {
  const {
    isShowSendToken,
    onHideSendToken,

    from,
    to,
    addressList,
    onChangeFrom,
    amount,
    locked,
    onChangeAmount,
    onChangeTo,
    comfirmationLoading,
    confirmationError,
    confirmationMsg,
    isSendComfirmationLocked,
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

  const SendConfirmationViewProps = {
    comfirmationLoading,
    confirmationError,
    confirmationMsg,
    onSendTransaction,
    onAbortTransaction,
    sendInProgress,
    isSendComfirmationLocked,
    sendError,
  };
  const SendProgressProps = { sendInProgress, sendError, sendTx, txExplorer };

  const modalFooter = [
    <Button key="reset" type="default" size="large" onClick={onAbortTransaction}>
      Reset
    </Button>,
    <Button key="close" type="default" size="large" onClick={onHideSendToken}>
      Close
    </Button>,
  ];

  return (
    <div style={{ maxWidth: '600px', margin: 'auto' }}>
      <Modal
        open={isShowSendToken}
        title={`Send ${symbol}`}
        onOk={onHideSendToken}
        onCancel={onHideSendToken}
        footer={modalFooter}
      >
        <SendFrom {...SendFromProps} /> <br />
        <SendAmount {...SendAmountProps} /> {symbol}<br /> <br />
        <SendTo {...SendToProps} /> <br />
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
  addressList: makeSelectAddressMap(),

  locked: makeSelectLocked(),

  comfirmationLoading: makeSelectComfirmationLoading(),
  confirmationError: makeSelectConfirmationError(),
  confirmationMsg: makeSelectConfirmationMsg(),

  isSendComfirmationLocked: makeSelectIsSendComfirmationLocked(),

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

export default connect(mapStateToProps, mapDispatchToProps)(SendToken);
