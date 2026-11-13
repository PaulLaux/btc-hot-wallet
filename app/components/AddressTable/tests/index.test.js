/**
 * Balance and conversion columns of the address table.
 * Expected values were computed independently with exact decimal math.
 */
import { formatBalance, convertBalance } from '../index';

const rates = { usd: 2238.55, eur: 2007.67, btc: 0.02945029 };

describe('AddressTable balance column', () => {
  it('formats wei with every digit, n/a until checked', () => {
    expect(formatBalance('1500000000000000000')).toBe('1.5');
    expect(formatBalance('0')).toBe('0');
    expect(formatBalance('1')).toBe('0.000000000000000001');
    expect(formatBalance('123456789012345678901234567890')).toBe('123456789012.34567890123456789');
    expect(formatBalance(false)).toBe('n/a');
  });
});

describe('AddressTable conversion', () => {
  it('converts to the chosen currency, rounded to 5 decimals', () => {
    expect(convertBalance('1500000000000000000', rates, 'usd')).toBe('3357.825');
    expect(convertBalance('1500000000000000000', rates, 'eur')).toBe('3011.505');
    expect(convertBalance('1500000000000000000', rates, 'btc')).toBe('0.04418');
  });

  it('shows nothing without a rate or a balance', () => {
    expect(convertBalance('1500000000000000000', rates, 'none')).toBe('');
    expect(convertBalance('1500000000000000000', {}, 'usd')).toBe('');
    expect(convertBalance(false, rates, 'usd')).toBe('');
  });
});
