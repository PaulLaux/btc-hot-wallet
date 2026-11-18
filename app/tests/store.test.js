import createStore from '../store';
import { generateKeystoreSuccess, generateAddressSuccess, changeBalance, setAddresses, setExchangeRates } from 'containers/HomePage/actions';
import { makeSelectAddressMap, makeSelectChain, makeSelectCoin, makeSelectExchangeRates } from 'containers/HomePage/selectors';

const keystore = {
  addresses: { main: ['bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu'], test: ['tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl'] },
  change: { main: [], test: [] },
};
const [address] = keystore.addresses.test;
const changeAddress = 'tb1q9u62588spffmq4dzjxsr5l297znf3z6j5p2688'; // m/84'/1'/0'/1/0 of the same seed

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
    store.dispatch(setAddresses(keystore, 'main'));
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
    store.dispatch(setAddresses({ addresses: { ltc: ['ltc1qjmxnz78nmc8nq77wuxh25n2es7rzm5c2rkk4wh'] }, change: { ltc: [] } }, 'ltc'));
    expect(makeSelectCoin()(store.getState())).toBe('LTC');
    expect(makeSelectExchangeRates()(store.getState())).toEqual({ usd: 80.5, eur: 70.25 });
  });

  it('lists change addresses after the receive ones, and drops them once empty', () => {
    const store = createStore();
    const map = () => makeSelectAddressMap()(store.getState());
    store.dispatch(generateKeystoreSuccess({ ...keystore, change: { ...keystore.change, test: [changeAddress] } }, 'test'));
    expect(Object.entries(map())).toEqual([[address, { balance: false }], [changeAddress, { balance: false, change: true }]]);
    store.dispatch(generateAddressSuccess(keystore, 'tb1qd7spv5q28348xl4myc8zmh983w5jx32cjhkn97')); // a receive address, added
    expect(Object.keys(map())).toEqual([address, 'tb1qd7spv5q28348xl4myc8zmh983w5jx32cjhkn97', changeAddress]);
    store.dispatch(changeBalance(changeAddress, '0', '-1000')); // spent, not confirmed yet: still shown
    expect(map()[changeAddress]).toEqual({ balance: '0', unconfirmed: '-1000', change: true });
    store.dispatch(changeBalance(changeAddress, '0', '0'));
    store.dispatch(changeBalance(address, '0', '0')); // an empty receive address stays
    expect(Object.keys(map())).toEqual([address, 'tb1qd7spv5q28348xl4myc8zmh983w5jx32cjhkn97']);
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
