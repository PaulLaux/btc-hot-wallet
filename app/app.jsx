/**
 * app.js
 *
 * Entry file for the application: setup and boilerplate code only.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import 'antd/dist/reset.css';

import App from 'containers/App';
import createStore from './store';

// No UI inside a frame, so another site can't overlay it and steer clicks (clickjacking): the CSP
// meta tag can't set frame-ancestors and GitHub Pages can't send headers
const root = document.getElementById('app');
if (window.top !== window.self) {
  root.textContent = 'This wallet does not run inside a frame. Open it in its own tab.';
} else {
  createRoot(root).render(
    <Provider store={createStore()}>
      <App />
    </Provider>
  );
}
