import { put } from 'redux-saga/effects';
import * as btc from '@scure/btc-signer';
import { hex } from '@scure/base';
import { loadNetwork, findUsedAddresses, confirmSendTransaction, SendTransaction } from '../saga';
import { confirmSendTransactionError, sendTransactionSuccess, sendTransactionError } from 'containers/SendToken/actions';
import { COMFIRM_SEND_TRANSACTION_SUCCESS } from 'containers/SendToken/constants';
import { setAddresses } from 'containers/HomePage/actions';
import { buildTx, deriveAddresses } from 'utils/bitcoin';
import { coinsOf } from 'utils/tests/coins';

// action creators show antd messages, which need a DOM
vi.mock('antd', () => ({ message: { success: () => {}, error: () => {}, warning: () => {} } }));

const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
// the first two testnet addresses of the mnemonic; only the first is in the wallet
const [from, to] = ['tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl', 'tb1qd7spv5q28348xl4myc8zmh983w5jx32cjhkn97'];
const keystore = { addresses: { main: ['bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu'], test: [from] } };
const coins = coinsOf(from, [100000n, 546n, 30000n]);

// feeds a generator one value per yield (the first next() starts it); returns the last yielded effect
const run = (gen, ...values) => [undefined, ...values].map((v) => gen.next(v).value).pop();

// feeds the selected from, amount, to, fee speed and network name; returns the resulting effect
const confirm = (amount, toAddress = to) => run(confirmSendTransaction(), from, amount, toAddress, 'normal', 'Testnet4');

describe('confirmSendTransaction', () => {
  it('rejects zero and amounts with more than 8 decimals', () => {
    expect(confirm('0')).toEqual(put(confirmSendTransactionError('Amount must be positive')));
    expect(confirm('0.000000001')).toEqual(put(confirmSendTransactionError('Amount must be a number with at most 8 decimals')));
  });

  it('needs a network to fetch coins and the fee rate', () => {
    expect(confirm('0.001')).toEqual(put(confirmSendTransactionError('Not connected to a network')));
  });
});

describe('on Testnet4', () => {
  // connect: the test answers the network check with a height and the scan with nothing found,
  // so nothing goes to the API
  let shown;
  beforeAll(() => { shown = run(loadNetwork({ networkName: 'Testnet4' }), keystore, 160000, undefined, undefined, null); });

  it('shows the addresses of the test chain', () => {
    expect(shown).toEqual(put(setAddresses([from], 'test')));
  });

  it('confirms the amount, network, full addresses and fee', () => {
    const gen = confirmSendTransaction();
    const fetches = run(gen, from, '0.0012', to, 'normal', 'Testnet4');
    expect(fetches.payload.map((effect) => effect.payload.args)).toEqual([[from], ['normal']]);
    const { action } = gen.next([coins, 2n]).value.payload;
    expect(action.type).toBe(COMFIRM_SEND_TRANSACTION_SUCCESS);
    expect(action.msg).toBe(`Send 0.0012 BTC on Testnet4\nFrom: ${from}\nTo: ${to}\nFee: 418 sats (2 sat/vB, 2 coins spent)`);
    expect(action.psbt).toBe(buildTx(coins, from, to, 120000n, 2n, 'test').psbt);
  });

  it('refuses a destination on another network', () => {
    const mainAddress = 'bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g';
    expect(confirm('0.001', mainAddress)).toEqual(put(confirmSendTransactionError(`Not a Bitcoin testnet address: ${mainAddress}`)));
  });

  it('signs exactly the confirmed transaction and broadcasts it', () => {
    const { psbt } = buildTx(coins, from, to, 120000n, 2n, 'test');
    const gen = SendTransaction();
    // keystore, from, password, psbt, network name, mnemonic
    const broadcast = run(gen, keystore, from, 'password', psbt, 'Testnet4', mnemonic);
    const tx = btc.Transaction.fromRaw(hex.decode(broadcast.payload.args[0]));
    const unsigned = btc.Transaction.fromPSBT(hex.decode(psbt));
    expect(tx.unsignedTx).toEqual(unsigned.unsignedTx);
    expect(gen.next(tx.id).value).toEqual(put(sendTransactionSuccess(tx.id)));
  });

  it('signs only for addresses of the wallet', () => {
    const { psbt } = buildTx(coinsOf(to, [100000n]), to, from, 50000n, 2n, 'test');
    expect(run(SendTransaction(), keystore, to, 'password', psbt, 'Testnet4', mnemonic))
      .toEqual(put(sendTransactionError(`Address ${to} is not in this wallet`)));
  });
});

describe('findUsedAddresses', () => {
  const addresses = deriveAddresses(mnemonic, 'test', 0, 12);
  // feeds the password and mnemonic, then whether each checked address was used; returns the result
  const scan = (networkName, password, used = []) => {
    const gen = findUsedAddresses(networkName, 'test', keystore);
    gen.next();
    let step = gen.next(password);
    if (step.done) return step.value; // locked, or this network was checked already
    step = gen.next(mnemonic);
    used.forEach((isUsed, i) => {
      expect(step.value.payload.args[0]).toBe(addresses[i]); // checks the addresses in order
      step = gen.next(isUsed);
    });
    expect(step.done).toBe(true);
    return step.value;
  };
  const unused = Array(10).fill(false);

  it('does nothing while the wallet is locked', () => {
    expect(scan('Signet', false)).toBe(null);
  });

  it('adds the addresses up to the last used one of the first ten', () => {
    expect(scan('Signet', 'password', [false, false, true, ...Array(7).fill(false)]).addresses)
      .toEqual({ main: keystore.addresses.main, test: addresses.slice(0, 3) });
  });

  it('continues one at a time while the last checked address was used, once per network', () => {
    const used = [...Array(9).fill(false), true, true, false];
    expect(scan('Bitcoin', 'password', used).addresses.test).toEqual(addresses.slice(0, 11));
    expect(scan('Bitcoin', 'password')).toBe(null); // already checked in this session
  });

  it('keeps the addresses when none beyond them was used', () => {
    expect(scan('Testnet4', 'password', unused)).toBe(null);
  });
});
