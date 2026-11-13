import { put } from 'redux-saga/effects';
import { parseTransaction, recoverTransactionAddress } from 'viem';
import { toUnits, loadNetwork, confirmSendTransaction, SendTransaction } from '../saga';
import { confirmSendTransactionError } from 'containers/SendToken/actions';
import { COMFIRM_SEND_TRANSACTION_SUCCESS } from 'containers/SendToken/constants';

// index 0 of the "abandon x11 about" mnemonic
const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const from = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';
const to = '0x000000000000000000000000000000000000dEaD';

describe('toUnits', () => {
  it('converts amounts exactly', () => {
    expect(toUnits('1.5', 18)).toBe(1500000000000000000n);
    expect(toUnits('0.123456789012345678', 18)).toBe(123456789012345678n);
    expect(toUnits('6.997705', 6)).toBe(6997705n);
    expect(toUnits('1.5000000', 6)).toBe(1500000n); // trailing zeros are fine
    expect(toUnits('12', 0)).toBe(12n);
    expect(toUnits(0.5, 6)).toBe(500000n);
    expect(toUnits('2')).toBe(2000000000000000000n); // ETH by default
  });

  it('refuses amounts the coin cannot hold, instead of rounding them', () => {
    expect(() => toUnits('0.0000005', 6)).toThrow('Amount can have at most 6 decimals'); // would round up
    expect(() => toUnits('0.0000001', 6)).toThrow('Amount can have at most 6 decimals'); // would round to 0
    expect(() => toUnits('0.1234567890123456789', 18)).toThrow('Amount can have at most 18 decimals');
    expect(() => toUnits('1.5', 0)).toThrow('Amount can have at most 0 decimals');
    expect(() => toUnits('1e-7', 18)).toThrow(); // not a decimal number
  });
});

// feeds a generator one value per yield (the first next() starts it); returns the last yielded effect
const run = (gen, ...values) => [undefined, ...values].map((v) => gen.next(v).value).pop();

const fee = { gas: '60000', maxFeePerGas: '2000000000', maxPriorityFeePerGas: '1000000000' };
const estimates = [60000n, { maxFeePerGas: 2000000000n, maxPriorityFeePerGas: 1000000000n }];

describe('confirmSendTransaction', () => {
  // feeds the selected from, amount and to; returns the resulting effect
  const confirm = (amount) => run(confirmSendTransaction(), from, amount, to.toLowerCase());

  it('rejects zero and too many decimals', () => {
    expect(confirm(null)).toEqual(put(confirmSendTransactionError('Amount must be possitive')));
    expect(confirm('0.0000000000000000001')).toEqual(put(confirmSendTransactionError('Amount can have at most 18 decimals')));
  });

  it('needs a network to estimate the fee', () => {
    expect(confirm('0.000001')).toEqual(put(confirmSendTransactionError('Not connected to a network')));
  });
});

describe('on Sepolia', () => {
  // connect: the test answers the chain ID and block number calls, so nothing goes to the RPC
  beforeAll(() => run(loadNetwork({ networkName: 'Sepolia Testnet' }), { addresses: [from] }, 11155111, 1n));

  it('confirms the full addresses, the network and the max gas fee', () => {
    const gen = confirmSendTransaction();
    const estimate = run(gen, from, '2', to.toLowerCase());
    expect(estimate.payload[0].payload.args[0]).toEqual({ account: from, to: to.toLowerCase(), value: 2000000000000000000n });
    gen.next(estimates); // select network name
    const { action } = gen.next('Sepolia Testnet').value.payload;
    expect(action.type).toBe(COMFIRM_SEND_TRANSACTION_SUCCESS);
    expect(action.msg).toBe(`Send 2 ETH on Sepolia Testnet\nFrom: ${from}\nTo: ${to}\nMax gas fee: 0.00012 ETH`);
    expect(action.fee).toEqual(fee);
  });

  it('signs exactly the confirmed transaction, for the chain ID it checked', async () => {
    const gen = SendTransaction();
    // keystore, from, amount, to, password, fee, mnemonic, nonce
    const sign = run(gen, { addresses: [from] }, from, '2', to, 'password', fee, mnemonic, 7);
    const serializedTransaction = await sign.payload.context.signTransaction(...sign.payload.args);

    const tx = parseTransaction(serializedTransaction);
    expect(tx).toMatchObject({ chainId: 11155111, nonce: 7, gas: 60000n, maxFeePerGas: 2000000000n, maxPriorityFeePerGas: 1000000000n });
    expect(tx).toMatchObject({ to: to.toLowerCase(), value: 2000000000000000000n });
    expect(await recoverTransactionAddress({ serializedTransaction })).toBe(from);

    expect(gen.next(serializedTransaction).value.payload.args[0]).toEqual({ serializedTransaction });
  });
});
