/*
 *
 * SendToken reducer
 *
 */
import { createReducer } from '@reduxjs/toolkit';
import {
  CHANGE_FROM,
  CHANGE_AMOUNT,
  CHANGE_TO,
  CHANGE_FEE_SPEED,

  COMFIRM_SEND_TRANSACTION,
  COMFIRM_SEND_TRANSACTION_SUCCESS,
  COMFIRM_SEND_TRANSACTION_ERROR,

  ABORT_TRANSACTION,
  SEND_TRANSACTION,
  SEND_TRANSACTION_SUCCESS,
  SEND_TRANSACTION_ERROR,

} from './constants';


const initialState = {
  from: '',
  to: '',
  amount: 0,
  feeSpeed: 'normal', // 'slow', 'normal' or 'fast'
  locked: false,

  comfirmationLoading: false,
  confirmationError: false,
  confirmationMsg: false,
  psbt: false, // the confirmed unsigned transaction (hex): exactly this is signed on send

  sendInProgress: false,
  sendError: false,
  sendTx: false,

};

export default createReducer(initialState, (builder) => builder
  .addCase(CHANGE_FROM, (s, a) => { s.from = a.address; })
  .addCase(CHANGE_AMOUNT, (s, a) => { s.amount = a.amount; })
  .addCase(CHANGE_TO, (s, a) => { s.to = a.address; })
  .addCase(CHANGE_FEE_SPEED, (s, a) => { s.feeSpeed = a.speed; })

  .addCase(COMFIRM_SEND_TRANSACTION, (s) => {
    Object.assign(s, { comfirmationLoading: true, locked: true });
  })
  .addCase(COMFIRM_SEND_TRANSACTION_SUCCESS, (s, a) => {
    Object.assign(s, { comfirmationLoading: false, confirmationMsg: a.msg, psbt: a.psbt, confirmationError: false });
  })
  .addCase(COMFIRM_SEND_TRANSACTION_ERROR, (s, a) => {
    Object.assign(s, { comfirmationLoading: false, confirmationError: a.error, locked: false });
  })
  .addCase(ABORT_TRANSACTION, (s) => {
    Object.assign(s, { comfirmationLoading: false, confirmationMsg: false, psbt: false, confirmationError: false, locked: false, sendError: false, sendTx: false });
  })

  .addCase(SEND_TRANSACTION, (s) => {
    Object.assign(s, { sendInProgress: true, sendError: false, sendTx: false });
  })
  .addCase(SEND_TRANSACTION_SUCCESS, (s, a) => {
    Object.assign(s, { sendInProgress: false, sendError: false, sendTx: a.tx });
  })
  .addCase(SEND_TRANSACTION_ERROR, (s, a) => {
    Object.assign(s, { sendInProgress: false, sendError: a.error, sendTx: false });
  }));
