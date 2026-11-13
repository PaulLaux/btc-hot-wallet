import createStore from '../store';
import header from 'containers/Header/reducer';
import { loadNetwork } from 'containers/Header/actions';
import { generateKeystoreSuccess, changeBalance } from 'containers/HomePage/actions';
import { makeSelectAddressMap } from 'containers/HomePage/selectors';

const address = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';

describe('store', () => {
  it('keeps addresses and balances as plain objects', () => {
    const store = createStore();
    store.dispatch(generateKeystoreSuccess({ addresses: [address] }));
    store.dispatch(changeBalance(address, '5000000'));
    store.dispatch(changeBalance('0x000000000000000000000000000000000000dEaD', '1')); // not in the table: ignored

    expect(makeSelectAddressMap()(store.getState())).toEqual({ [address]: { index: 1, balance: '5000000' } });
  });

  it('checks that state stays serializable: balances are strings, not bigint', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createStore();
    store.dispatch(generateKeystoreSuccess({ addresses: [address] }));
    store.dispatch(changeBalance(address, '1500000000000000000'));
    expect(error).not.toHaveBeenCalled();
    store.dispatch(changeBalance(address, 1n));
    expect(error.mock.calls.some(([msg]) => msg.includes('non-serializable value was detected in the state'))).toBe(true);
    error.mockRestore();
  });

  it('remembers the previous network, but not Offline', () => {
    let state = header(undefined, loadNetwork('Ethereum Mainnet'));
    expect(state.prevNetworkName).toBe('Sepolia Testnet'); // the default, since we were Offline
    state = header(state, loadNetwork('Local RPC'));
    expect(state).toMatchObject({ prevNetworkName: 'Ethereum Mainnet', networkName: 'Local RPC' });
  });
});
