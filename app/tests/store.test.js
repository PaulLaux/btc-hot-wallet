import createStore from '../store';
import { generateKeystoreSuccess, changeBalance, setAddresses, setExchangeRates } from 'containers/HomePage/actions';
import { makeSelectAddressMap, makeSelectChain, makeSelectCoin, makeSelectExchangeRates } from 'containers/HomePage/selectors';

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

  it('shows the coin and the prices of the shown addresses', () => {
    const store = createStore();
    store.dispatch(setExchangeRates({ BTC: { usd: 94000.5, eur: 81000.25 }, LTC: { usd: 80.5, eur: 70.25 } }));
    expect(makeSelectExchangeRates()(store.getState())).toEqual({}); // no addresses shown yet
    store.dispatch(generateKeystoreSuccess(keystore, 'test'));
    expect(makeSelectCoin()(store.getState())).toBe('BTC');
    expect(makeSelectExchangeRates()(store.getState())).toEqual({ usd: 94000.5, eur: 81000.25 });
    store.dispatch(setAddresses(['ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh'], 'ltc'));
    expect(makeSelectCoin()(store.getState())).toBe('LTC');
    expect(makeSelectExchangeRates()(store.getState())).toEqual({ usd: 80.5, eur: 70.25 });
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
