import React from 'react';
import ReactDOM from 'react-dom/client';
import Root from './Root.js';
import { ReloadPrompt } from './pwa/ReloadPrompt.js';
import './index.css';
import { installScrollbarAutoHide } from './scrollbar-auto-hide.js';

installScrollbarAutoHide();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
    <ReloadPrompt />
  </React.StrictMode>
);
