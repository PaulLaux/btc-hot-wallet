/**
*
* CurrencyDropdown
*
*/

import React from 'react';
import { Dropdown } from 'antd';
import { DownOutlined } from '@ant-design/icons';

function CurrencyDropdown(props) {
  const { exchangeRates = {}, onSelectCurrency, convertTo } = props;

  const menu = {
    items: [
      { key: 'none', label: 'None' },
      ...Object.keys(exchangeRates).map((currency) => ({ key: currency, label: currency.toUpperCase() })),
    ],
    onClick: ({ key }) => onSelectCurrency(key),
  };

  return (
    <Dropdown menu={menu}>
      <span>
        {convertTo === 'none' ? 'Convert' : convertTo.toUpperCase()}<DownOutlined />
      </span>
    </Dropdown>
  );
}

export default CurrencyDropdown;
