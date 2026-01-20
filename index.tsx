import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Suppress benign ResizeObserver errors commonly triggered by virtualization libraries
const suppressResizeObserverErrors = () => {
  // 1. Trap global errors (Standard)
  const errorHandler = (e: ErrorEvent) => {
    // Chrome sometimes puts the message in e.message, sometimes in e.error.message
    const msg = e.message || (e.error ? e.error.message : '');
    
    if (
      msg.includes('ResizeObserver loop completed with undelivered notifications') ||
      msg.includes('ResizeObserver loop limit exceeded')
    ) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  };
  window.addEventListener('error', errorHandler);

  // 2. Trap window.onerror (Legacy/Overlay handlers)
  // This is often required for webpack-dev-server overlays
  window.onerror = (msg, url, lineNo, columnNo, error) => {
    const stringMsg = typeof msg === 'string' ? msg : (error?.message || '');
    if (
      stringMsg.includes('ResizeObserver loop completed with undelivered notifications') ||
      stringMsg.includes('ResizeObserver loop limit exceeded')
    ) {
      return true; // Return true to suppress the error
    }
    return false;
  };

  // 3. Patch console.error (For libraries or frameworks that catch and log)
  const originalError = console.error;
  console.error = (...args) => {
    if (args.length > 0) {
      const firstArg = args[0];
      // Check string arguments
      if (typeof firstArg === 'string' && (
        firstArg.includes('ResizeObserver loop completed with undelivered notifications') ||
        firstArg.includes('ResizeObserver loop limit exceeded')
      )) {
        return;
      }
      // Check Error object arguments
      if (firstArg instanceof Error && (
        firstArg.message.includes('ResizeObserver loop completed with undelivered notifications') ||
        firstArg.message.includes('ResizeObserver loop limit exceeded')
      )) {
        return;
      }
    }
    originalError.apply(console, args);
  };
};

suppressResizeObserverErrors();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);