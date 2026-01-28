import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Suppress noisy ResizeObserver loop error that sometimes appears in Chrome dev tools
// when using scrollable containers on mobile sizes. This does not affect functionality,
// it only prevents the red error overlay in development.
if (typeof window !== 'undefined') {
  const resizeObserverErr = /ResizeObserver loop completed with undelivered notifications\./;
  window.addEventListener('error', (event) => {
    if (resizeObserverErr.test(event.message)) {
      event.stopImmediatePropagation();
    }
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
