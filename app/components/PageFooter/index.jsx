/**
*
* PageFooter
*
*/

import React from 'react';
import { github } from 'utils/constants';
import { Row, Col } from 'antd';
import styled from 'styled-components';

import { StickyFooter } from './sticky';


const Footer = styled(StickyFooter)`
  text-align: center;
  background: #efeeee;
  color: #5a5a5a;
  padding: 10px;
  font-size: 14px;
`;

const GreyCol = styled(Col)`
  color: #b9b9b9;
`;

// Set by GitHub Actions (see vite.config.js), empty in local builds
const sha = process.env.GITHUB_SHA;

function PageFooter() {
  return (
    <Footer>
      <Row>
        <Col sm={12} xs={24}>
          {'BTC Hot Wallet - '}
          <a href={github} target="_blank" rel="noopener noreferrer">
            Bitcoin web wallet (GitHub)
          </a><br />
          Created using: @scure/btc-signer, React, Ant Design...
        </Col>

        <GreyCol sm={12} xs={24}>
          <a href="https://medium.freecodecamp.org/how-to-build-an-ethereum-wallet-web-app-ac77dcaac573" target="_blank" rel="noopener noreferrer">
          How the Ethereum version was built (guide)
          </a><br />
          {sha ? (
            <>
              {'Build '}
              <a href={`${github}/commit/${sha}`} target="_blank" rel="noopener noreferrer">{sha.slice(0, 7)}</a>
              {' ('}
              <a href={`${github}/actions/runs/${process.env.GITHUB_RUN_ID}`} target="_blank" rel="noopener noreferrer">CI log</a>)
            </>
          ) : 'Local build'}
        </GreyCol>

      </Row>
    </Footer>
  );
}

PageFooter.propTypes = {

};

export default PageFooter;
