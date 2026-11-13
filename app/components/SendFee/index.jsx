/**
*
* SendFee
*
*/

import React from 'react';
import { Radio } from 'antd';

// fee rates by confirmation target, see utils/esplora.js
const speeds = [
  { value: 'slow', label: 'Slow (~1 hour)' },
  { value: 'normal', label: 'Normal (~30 min)' },
  { value: 'fast', label: 'Fast (next block)' },
];

function SendFee({ feeSpeed, onChangeFeeSpeed, locked }) {
  return (
    <div>
      Fee:<br />
      <Radio.Group options={speeds} value={feeSpeed} onChange={onChangeFeeSpeed} disabled={locked} optionType="button" />
    </div>
  );
}

export default SendFee;
