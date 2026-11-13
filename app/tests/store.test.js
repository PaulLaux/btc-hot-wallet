import createStore from '../store';
import { generateKeystoreSuccess, changeBalance, setAddresses } from 'containers/HomePage/actions';
import { makeSelectAddressMap, makeSelectChain } from 'containers/HomePage/selectors';

const keystore = { addresses: { main: ['bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu'], test: ['tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl'] } };
const [address] = keystore.addresses.test;

describe('store', () => {
  it('keeps addresses and balances as plain objects', () => {
    const store = createStore();
    store.dispatch(generateKeystoreSuccess(keystore, 'test'));
    store.dispatch(changeBalance(address, '5000000', '-80000'));
    store.dispatch(changeBalance(keystore.addresses.main[0], '1', '0')); // not in the table: ignored

    expect(makeSelectAddressMap()(store.getState())).toEqual({ [address]: { balance: '5000000', unconfirmed: '-80000' } });
  });

  it('shows the addresses of one chain at a time, without the old balances', () => {
    const store = createStore();
    store.dispatch(generateKeystoreSuccess(keystore, 'test'));
    store.dispatch(changeBalance(address, '5000000', '0'));
    store.dispatch(setAddresses(keystore.addresses.main, 'main'));
    expect(makeSelectChain()(store.getState())).toBe('main');
    expect(makeSelectAddressMap()(store.getState())).toEqual({ [keystore.addresses.main[0]]: { balance: false } });
  });

  it('checks that state stays serializable: balances are strings, not bigint', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createStore();
    store.dispatch(generateKeystoreSuccess(keystore, 'test'));
    store.dispatch(changeBalance(address, '150000000', '0'));
    expect(error).not.toHaveBeenCalled();
    store.dispatch(changeBalance(address, 1n, '0'));
    expect(error.mock.calls.some(([msg]) => msg.includes('non-serializable value was detected in the state'))).toBe(true);
    error.mockRestore();
  });
});
