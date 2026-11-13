import { call, put } from 'redux-saga/effects';
import { autoLock, saveWalletS, loadWalletS, deleteWallet } from '../saga';
import { lockWallet, saveWalletSuccess, saveWalletError, generateKeystoreSuccess, loadWalletSuccess } from '../actions';
import { LOAD_WALLET_ERROR } from '../constants';
import { loadNetwork } from 'containers/Header/actions';
import { defaultNetwork, localStorageKey } from 'utils/constants';
import { timer } from 'utils/common';

// action creators show antd messages, which need a DOM
vi.mock('antd', () => ({ message: { success: () => {}, error: () => {} } }));

describe('autoLock', () => {
  it('locks the wallet when the timer wins', () => {
    const gen = autoLock();
    gen.next(); // race between the timer and a manual lock / close
    expect(gen.next({ timeout: true }).value).toEqual(put(lockWallet()));
    expect(gen.next().done).toBe(true);
  });

  it('does nothing if the wallet was locked or closed first', () => {
    const gen = autoLock();
    gen.next();
    expect(gen.next({ locked: {} }).done).toBe(true);
  });
});

describe('wallet in localStorage', () => {
  const vault = { salt: '00ff', iv: 'abcd', data: '1234', addresses: { main: ['bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu'], test: ['tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl'] } };
  let storage;

  beforeEach(() => {
    const items = new Map();
    storage = {
      getItem: (k) => (items.has(k) ? items.get(k) : null),
      setItem: (k, v) => items.set(k, String(v)),
      removeItem: (k) => items.delete(k),
    };
    vi.stubGlobal('localStorage', storage);
    vi.spyOn(console, 'log').mockImplementation(() => {}); // loadWalletError logs
    vi.spyOn(console, 'warn').mockImplementation(() => {}); // saveWalletError warns
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const load = () => {
    const gen = loadWalletS();
    expect(gen.next().value).toEqual(call(timer, 1000));
    gen.next(); // select the current keystore
    return gen.next(false); // none in memory: read localStorage
  };

  it('saves the vault as JSON under the wallet key', () => {
    const gen = saveWalletS();
    gen.next(); // select the keystore
    expect(gen.next(vault).value).toEqual(put(saveWalletSuccess()));
    expect(storage.getItem(localStorageKey)).toBe(JSON.stringify(vault));
  });

  it('does not save without a keystore', () => {
    const gen = saveWalletS();
    gen.next();
    expect(gen.next(false).value).toEqual(put(saveWalletError('No keystore defined')));
    expect(storage.getItem(localStorageKey)).toBe(null);
  });

  it('loads a saved wallet', () => {
    storage.setItem(localStorageKey, JSON.stringify(vault));
    const gen = loadWalletS();
    gen.next();
    gen.next();
    expect(gen.next(false).value).toEqual(put(generateKeystoreSuccess(vault, 'test'))); // Testnet4 is the default
    expect(gen.next().value).toEqual(put(loadNetwork(defaultNetwork)));
    expect(gen.next().value).toEqual(put(loadWalletSuccess()));
  });

  it('reports a missing or corrupt wallet as a load error', () => {
    expect(load().value.payload.action).toEqual({ type: LOAD_WALLET_ERROR, error: 'No keystore found in localStorage' });
    storage.setItem(localStorageKey, '{not json');
    expect(load().value.payload.action.type).toBe(LOAD_WALLET_ERROR);
  });

  it('deletes only its own wallet, and survives storage blocked by the browser', () => {
    storage.setItem(localStorageKey, JSON.stringify(vault));
    storage.setItem('wallet', '{"addresses":["0x9858EfFD232B4033E47d90003D41EC34EcaEda94"]}'); // ETH Hot Wallet's vault
    expect(deleteWallet().next().done).toBe(true);
    expect(storage.getItem(localStorageKey)).toBe(null);
    expect(storage.getItem('wallet')).not.toBe(null);

    vi.stubGlobal('localStorage', { removeItem: () => { throw new DOMException('The operation is insecure.', 'SecurityError'); } });
    expect(() => deleteWallet().next()).not.toThrow();
  });
});
