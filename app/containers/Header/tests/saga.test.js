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

  it('confirms in the coin of the network, and refuses an address of another coin', () => {
    const [ltcFrom, ltcTo] = ['tltc1q6rz28mcfaxtmd6v789l9rrlrusdprr9pesrjxk', 'tltc1qd7spv5q28348xl4myc8zmh983w5jx32ctl5d4h'];
    const gen = confirmSendTransaction();
    run(gen, ltcFrom, '0.0012', ltcTo, 'normal', 'Litecoin Testnet');
    // the same keys as from and to: the coins of from are also those of ltcFrom
    expect(gen.next([coins, 2n]).value.payload.action.msg.split('\n')[0]).toBe('Send 0.0012 LTC on Litecoin Testnet');
    expect(run(confirmSendTransaction(), ltcFrom, '0.001', to, 'normal', 'Litecoin Testnet'))
      .toEqual(put(confirmSendTransactionError(`Not a Litecoin testnet address: ${to}`)));
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
  const addresses = deriveAddresses(mnemonic, 'test', 0, 60);
  // feeds the password and mnemonic, then the used ones (by index) of each block checked;
  // returns the result and the size of each block
  const scan = (networkName, password, used = []) => {
    const gen = findUsedAddresses(networkName, 'test', keystore);
    gen.next();
    let step = gen.next(password);
    if (step.done) return { result: step.value }; // locked, or this network was checked already
    step = gen.next(mnemonic);
    const blocks = [];
    for (let from = 0; !step.done; from += blocks.at(-1)) {
      const block = step.value.payload.args[0];
      expect(block).toEqual(addresses.slice(from, from + block.length)); // the next addresses, in order
      blocks.push(block.length);
      step = gen.next(new Set(used.map((i) => addresses[i])));
    }
    return { result: step.value, blocks };
  };

  it('does nothing while the wallet is locked', () => {
    expect(scan('Signet', false).result).toBe(null);
  });

  it('checks 20 addresses in one block, and keeps the addresses when none was used', () => {
    expect(scan('Testnet4', 'password')).toEqual({ result: null, blocks: [20] });
  });

  it('adds the addresses up to the last used one, checking until 20 unused ones follow it', () => {
    const { result, blocks } = scan('Signet', 'password', [2]);
    expect(result.addresses).toEqual({ main: keystore.addresses.main, test: addresses.slice(0, 3) });
    expect(blocks).toEqual([20, 3]);
  });

  it('continues past gaps shorter than 20, once per network', () => {
    const { result, blocks } = scan('Bitcoin', 'password', [0, 19, 38]);
    expect(result.addresses.test).toEqual(addresses.slice(0, 39));
    expect(blocks).toEqual([20, 20, 19]);
    expect(scan('Bitcoin', 'password').result).toBe(null); // already checked in this session
  });
});
