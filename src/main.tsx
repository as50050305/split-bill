import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import './index.css';
import App from './App.tsx';

// Android 實體返回鍵：App 內有上一頁就返回，否則離開 App
if (Capacitor.isNativePlatform()) {
  CapApp.addListener('backButton', ({ canGoBack }) => {
    const idx = (history.state as { idx?: number } | null)?.idx ?? 0;
    if (canGoBack && idx > 0) history.back();
    else CapApp.exitApp();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
