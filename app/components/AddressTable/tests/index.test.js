/**
 * Balance and conversion columns of the address table.
 */
import { formatBalance, convertBalance } from '../index';

const rates = { usd: 94000.5, eur: 81000.25 };

describe('AddressTable balance column', () => {
  it('formats sats as BTC with every digit, n/a until checked', () => {
    expect(formatBalance('150000000')).toBe('1.5');
    expect(formatBalance('0')).toBe('0');
    expect(formatBalance('1')).toBe('0.00000001');
    expect(formatBalance('2100000000000000')).toBe('21000000');
    expect(formatBalance('-80000')).toBe('-0.0008'); // unconfirmed change of a pending send
    expect(formatBalance(false)).toBe('n/a');
  });
});

describe('AddressTable conversion', () => {
  it('converts to the chosen currency, rounded to 5 decimals', () => {
    expect(convertBalance('150000000', rates, 'usd')).toBe('141000.75');
    expect(convertBalance('150000000', rates, 'eur')).toBe('121500.375');
    expect(convertBalance('1', rates, 'usd')).toBe('0.00094');
  });

  it('shows nothing without a rate or a balance', () => {
    expect(convertBalance('150000000', rates, 'none')).toBe('');
    expect(convertBalance('150000000', {}, 'usd')).toBe('');
    expect(convertBalance(false, rates, 'usd')).toBe('');
  });
});
