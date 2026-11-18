/**
*
* RestoreWalletModal
*
*/

import React, { useState } from 'react';
import styled from 'styled-components';
import { Modal, Button, Input, Tooltip, Checkbox } from 'antd';
import { CloseCircleOutlined, KeyOutlined, LockOutlined, WalletOutlined } from '@ant-design/icons';
import SeedPaths from 'components/SeedPaths';

const Div = styled.div`
  margin-top: 12px;
`;

const Span = styled.span`
  color: red;
  font-size: 21px;
  padding-right: 12px;
  vertical-align: sub;
`;

const Description = styled.div`
  margin-bottom: 10px;
`;

function RestoreWalletModal(props) {
  const { isShowRestoreWallet, userSeed, userPassword, restoreWalletError, onChangeUserSeed, onChangeUserPassword, onRestoreWalletCancel, onRestoreWalletFromSeed } = props;
  // BIP-39 passphrase (as set on a Ledger): kept here only, until the modal closes. Not trimmed: spaces count
  const [usePassphrase, setUsePassphrase] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const errorComponent =
    (<Span key="error">
      <Tooltip placement="bottom" title={restoreWalletError}>
        <CloseCircleOutlined style={{ color: 'red' }} />
      </Tooltip>
    </Span>);

  return (
    <Modal
      open={isShowRestoreWallet}
      title="Restore Wallet"
      onOk={onRestoreWalletCancel}
      onCancel={onRestoreWalletCancel}
      afterClose={() => { setUsePassphrase(false); setPassphrase(''); }}
      footer={[
        restoreWalletError ? errorComponent : null,
        <Button key="submit" type="primary" size="large" onClick={() => onRestoreWalletFromSeed(usePassphrase ? passphrase : '')} >
          Restore
        </Button >,
      ]}
    >
      <Description>12 or 24 words, from this wallet, Ledger Live or Sparrow <SeedPaths /></Description>
      <Input
        placeholder="Enter seed"
        prefix={<WalletOutlined />}
        value={userSeed}
        onChange={onChangeUserSeed}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      <Div>
        <Input
          placeholder="Enter password for keystore encryption"
          prefix={<KeyOutlined />}
          value={userPassword}
          onChange={onChangeUserPassword}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </Div>
      <Div>
        <Checkbox checked={usePassphrase} onChange={(evt) => setUsePassphrase(evt.target.checked)}>
          Use a passphrase (&quot;25th word&quot;)
        </Checkbox>
      </Div>
      {usePassphrase && (
        <Div>
          <Input.Password
            placeholder="Enter passphrase exactly: spaces and case count"
            prefix={<LockOutlined />}
            value={passphrase}
            onChange={(evt) => setPassphrase(evt.target.value)}
            autoComplete="off"
          />
        </Div>
      )}
    </Modal>
  );
}

export default RestoreWalletModal;
