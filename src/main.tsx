import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';
import './lib/i18n';
import { registerSW } from 'virtual:pwa-register';

// Register the generated service worker (vite-plugin-pwa). autoUpdate fetches
// and activates new deploys automatically; the page reloads once it takes over.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    // Periodically check for an updated worker so long-lived tabs refresh.
    if (registration) {
      setInterval(() => registration.update(), 60 * 60 * 1000);
    }
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
