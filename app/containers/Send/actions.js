/*
 *
 * Send actions
 *
 */
import {
  CHANGE_AMOUNT,
  CHANGE_FROM,
  CHANGE_TO,
  CHANGE_FEE_SPEED,

  CONFIRM_SEND_TRANSACTION,
  CONFIRM_SEND_TRANSACTION_SUCCESS,
  CONFIRM_SEND_TRANSACTION_ERROR,

  ABORT_TRANSACTION,
  SEND_TRANSACTION,
  SEND_TRANSACTION_SUCCESS,
  SEND_TRANSACTION_ERROR,
} from './constants';

/**
 * Update from address
 * @param  {string} address 'bc1q..'
 *
 * @return {object}    An action object with a type of CHANGE_FROM and address
 */
export function changeFrom(address) {
  return {
    type: CHANGE_FROM,
    address,
  };
}

export function changeAmount(amount) {
  return {
    type: CHANGE_AMOUNT,
    amount,
  };
}

export function changeTo(inputAddress) {
  // remove unnecessary spaces
  const address = inputAddress.replace(/^\s+|\s+$/g, '');
  return {
    type: CHANGE_TO,
    address,
  };
}


/**
 * Choose the fee rate: 'slow', 'normal' or 'fast' (see utils/esplora.js)
 *
 * @return {object}    An action object with a type of CHANGE_FEE_SPEED and the speed
 */
export function changeFeeSpeed(speed) {
  return {
    type: CHANGE_FEE_SPEED,
    speed,
  };
}

/**
 * initiate confirmation object
 *
 * @return {object}    An action object with a type of CONFIRM_SEND_TRANSACTION
 */
export function confirmSendTransaction() {
  return {
    type: CONFIRM_SEND_TRANSACTION,
  };
}

/**
 * transaction built: the message for the user to check, and the unsigned transaction to sign on send
 * @param  {string} msg amount, network, addresses and fee
 * @param  {string} psbt the unsigned transaction (PSBT, hex)
 *
 * @return {object}    An action object with a type of CONFIRM_SEND_TRANSACTION_SUCCESS
 */
export function confirmSendTransactionSuccess(msg, psbt) {
  return {
    type: CONFIRM_SEND_TRANSACTION_SUCCESS,
    msg,
    psbt,
  };
}

/**
 * Error confirming transaction
 *
 * @return {object}    An action object with a type of CONFIRM_SEND_TRANSACTION_ERROR
 */
export function confirmSendTransactionError(error) {
  return {
    type: CONFIRM_SEND_TRANSACTION_ERROR,
    error,
  };
}

/**
 * Abort transaction after it has been confirmed
 *
 * @return {object}    An action object with a type of ABORT_TRANSACTION
 */
export function abortTransaction() {
  return {
    type: ABORT_TRANSACTION,
  };
}

/**
 * initiate Send
 *
 * @return {object}    An action object with a type of SEND_TRANSACTION
 */
export function sendTransaction() {
  return {
    type: SEND_TRANSACTION,
  };
}

/**
 * transaction sent successfully
 *
 * @return {object}    An action object with a type of SEND_TRANSACTION_SUCCESS
 */
export function sendTransactionSuccess(tx) {
  return {
    type: SEND_TRANSACTION_SUCCESS,
    tx,
  };
}

/**
 * Error sending transaction
 *
 * @return {object}    An action object with a type of SEND_TRANSACTION_ERROR
 */
export function sendTransactionError(error) {
  return {
    type: SEND_TRANSACTION_ERROR,
    error,
  };
}

