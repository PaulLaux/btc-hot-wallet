/**
 * SeedPaths: an info icon whose tooltip lists the addresses a seed gives in this wallet (chains in utils/bitcoin.js)
 */
import React from 'react';
import { Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { chains } from 'utils/bitcoin';

const paths = (
  <>
    Native SegWit (BIP-84) addresses:
    {Object.values(chains).map(({ name, coinType }) => <div key={name}>{`${name}: m/84'/${coinType}'/0'/0/n`}</div>)}
    Change from coins sent with other wallets (…/1/n) doesn&apos;t show here.
  </>
);

export default function SeedPaths() {
  return (
    <Tooltip title={paths} trigger={['hover', 'click']}>
      <InfoCircleOutlined aria-label="Derivation paths" style={{ cursor: 'help' }} />
    </Tooltip>
  );
}
