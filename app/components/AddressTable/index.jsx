/**
*
* AddressTable
*
*/

import React from 'react';
import styled from 'styled-components';
import { Table, Grid, Typography } from 'antd';
import CurrencyDropdown from 'components/CurrencyDropdown';
import { fromSats } from 'utils/bitcoin';

const { Column } = Table;
const { Text } = Typography;

const shortAddress = (address) => `${address.slice(0, 6)}…${address.slice(-4)}`;

const AddrTable = styled(Table)`
  max-width: 860px;
  margin-left: auto;
  margin-right: auto;
  tbody{
    background: white;
  }
  .ant-table{
    font-size: 13px !important;
  }
`;

/** Balance in sats (decimal string) in coins, every digit kept; n/a until checked */
export const formatBalance = (balance) => (balance === false ? 'n/a' : fromSats(balance));

/** Value of the balance in the chosen currency, rounded to 5 decimals; empty without a rate */
export const convertBalance = (balance, exchangeRates, convertTo) => {
  const value = balance === false ? NaN : fromSats(balance) * exchangeRates[convertTo];
  return Number.isFinite(value) ? String(+value.toFixed(5)) : '';
};

function AddressTable(props) {
  const {
    addressMap,
    coin,
    onShowSendToken,
    exchangeRates,
    onSelectCurrency,
    convertTo,
  } = props;

  const currencyDropdownProps = { exchangeRates, onSelectCurrency, convertTo };
  const narrow = !Grid.useBreakpoint().md; // phones: compact cells, short addresses

  const rows = Object.entries(addressMap).map(([address, { balance, unconfirmed }]) => ({
    key: address,
    address,
    balance: formatBalance(balance),
    // part of the balance: incoming payments (+) or sends (-) not in a block yet
    unconfirmed: unconfirmed && unconfirmed !== '0' ? `${formatBalance(unconfirmed)} unconfirmed` : '',
    convert: convertBalance(balance, exchangeRates, convertTo),
  }));

  return (
    <AddrTable
      dataSource={rows}
      bordered
      size={narrow ? 'small' : undefined}
      scroll={{ x: 'max-content' }}
      pagination={false}
      locale={{ emptyText: 'No Data' }}
    >
      <Column
        title="Address"
        dataIndex="address"
        key="address"
        align="center"
        render={(address) => <Text copyable={{ text: address }}>{narrow ? shortAddress(address) : address}</Text>}
      />
      <Column
        title={<>Balance ({coin})<br /><CurrencyDropdown {...currencyDropdownProps} /></>}
        dataIndex="balance"
        key="balance"
        align="center"
        render={(balance, record) => (
          <>
            {balance}<br />
            {record.unconfirmed && <><Text type="secondary" italic>{record.unconfirmed}</Text><br /></>}
            <Text type="secondary">{record.convert}</Text>
          </>
        )}
      />
      <Column
        key="action"
        render={(text, record) => (
          <a onClick={() => onShowSendToken(record.address)}>Send</a>
        )}
      />
    </AddrTable >
  );
}

export default AddressTable;
