
import { createSelector } from 'reselect';

/**
 * Direct selector to the sendToken state domain
 */
const selectSendTokenDomain = (state) => state.sendtoken;


const makeSelectFrom = () => createSelector(
  selectSendTokenDomain,
  (substate) => substate.from
);

const makeSelectTo = () => createSelector(
  selectSendTokenDomain,
  (substate) => substate.to
);

const makeSelectAmount = () => createSelector(
  selectSendTokenDomain,
  (substate) => substate.amount
);

const makeSelectComfirmationLoading = () => createSelector(
  selectSendTokenDomain,
  (substate) => substate.comfirmationLoading
);

const makeSelectConfirmationError = () => createSelector(
  selectSendTokenDomain,
  (substate) => substate.confirmationError
);

const makeSelectConfirmationMsg = () => createSelector(
  selectSendTokenDomain,
  (substate) => substate.confirmationMsg
);

const makeSelectSendInProgress = () => createSelector(
  selectSendTokenDomain,
  (substate) => substate.sendInProgress
);

const makeSelectSendError = () => createSelector(
  selectSendTokenDomain,
  (substate) => substate.sendError
);

const makeSelectSendTx = () => createSelector(
  selectSendTokenDomain,
  (substate) => substate.sendTx
);

const makeSelectLocked = () => createSelector(
  selectSendTokenDomain,
  (substate) => substate.locked
);

const makeSelectFeeSpeed = () => createSelector(
  selectSendTokenDomain,
  (substate) => substate.feeSpeed
);

const makeSelectPsbt = () => createSelector(
  selectSendTokenDomain,
  (substate) => substate.psbt
);

const makeSelectIsSendComfirmationLocked = () => createSelector(
  selectSendTokenDomain,
  (substate) => substate.sendInProgress !== false || substate.sendTx !== false
);

// export default makeSelectSendToken;
export {
  selectSendTokenDomain,

  makeSelectFrom,
  makeSelectTo,
  makeSelectAmount,
  makeSelectLocked,

  makeSelectComfirmationLoading,
  makeSelectConfirmationError,
  makeSelectConfirmationMsg,
  makeSelectFeeSpeed,
  makeSelectPsbt,

  makeSelectIsSendComfirmationLocked,

  makeSelectSendInProgress,
  makeSelectSendError,
  makeSelectSendTx,
};
