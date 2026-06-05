import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';
import './lib/i18n';

// Register service worker for PWA offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        // Check for an updated worker on every load so new deploys are
        // picked up instead of being served from a stale cache.
        reg.update();
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            // A new worker has installed while an old one is controlling the
            // page — activate it immediately.
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              installing.postMessage?.({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch((err) => console.error('SW registration failed:', err));

    // When the active service worker changes, reload once to load the
    // freshly cached app shell.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
