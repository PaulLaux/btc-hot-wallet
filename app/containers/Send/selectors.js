
import { createSelector } from 'reselect';

/**
 * Direct selector to the send state domain
 */
const selectSendDomain = (state) => state.send;


const makeSelectFrom = () => createSelector(
  selectSendDomain,
  (substate) => substate.from
);

const makeSelectTo = () => createSelector(
  selectSendDomain,
  (substate) => substate.to
);

const makeSelectAmount = () => createSelector(
  selectSendDomain,
  (substate) => substate.amount
);

const makeSelectConfirmationLoading = () => createSelector(
  selectSendDomain,
  (substate) => substate.confirmationLoading
);

const makeSelectConfirmationError = () => createSelector(
  selectSendDomain,
  (substate) => substate.confirmationError
);

const makeSelectConfirmationMsg = () => createSelector(
  selectSendDomain,
  (substate) => substate.confirmationMsg
);

const makeSelectSendInProgress = () => createSelector(
  selectSendDomain,
  (substate) => substate.sendInProgress
);

const makeSelectSendError = () => createSelector(
  selectSendDomain,
  (substate) => substate.sendError
);

const makeSelectSendTx = () => createSelector(
  selectSendDomain,
  (substate) => substate.sendTx
);

const makeSelectLocked = () => createSelector(
  selectSendDomain,
  (substate) => substate.locked
);

const makeSelectFeeSpeed = () => createSelector(
  selectSendDomain,
  (substate) => substate.feeSpeed
);

const makeSelectPsbt = () => createSelector(
  selectSendDomain,
  (substate) => substate.psbt
);

const makeSelectIsSendConfirmationLocked = () => createSelector(
  selectSendDomain,
  (substate) => substate.sendInProgress !== false || substate.sendTx !== false
);

// export default makeSelectSend;
export {
  selectSendDomain,

  makeSelectFrom,
  makeSelectTo,
  makeSelectAmount,
  makeSelectLocked,

  makeSelectConfirmationLoading,
  makeSelectConfirmationError,
  makeSelectConfirmationMsg,
  makeSelectFeeSpeed,
  makeSelectPsbt,

  makeSelectIsSendConfirmationLocked,

  makeSelectSendInProgress,
  makeSelectSendError,
  makeSelectSendTx,
};
