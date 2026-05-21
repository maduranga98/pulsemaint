import { useCallback, useState } from 'react';

export function useGoogleSheetsAuth() {
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('pulsemaint_google_sheets_token'));

  const connect = useCallback(async () => {
    const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;
    if (!clientId) {
      throw new Error('Google OAuth client ID is not configured.');
    }
    const scope = encodeURIComponent('https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file');
    const redirectUri = encodeURIComponent(window.location.origin);
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}&prompt=consent`;
    const popup = window.open(url, 'pulsemaint_google_sheets', 'width=520,height=720');
    if (!popup) throw new Error('Popup blocked. Allow popups and try again.');
    await new Promise<void>((resolve, reject) => {
      const timer = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(timer);
          reject(new Error('Google connection was closed before authorization completed.'));
          return;
        }
        try {
          const hash = popup.location.hash;
          if (!hash.includes('access_token=')) return;
          const params = new URLSearchParams(hash.replace(/^#/, ''));
          const token = params.get('access_token');
          if (!token) return;
          localStorage.setItem('pulsemaint_google_sheets_token', token);
          setAccessToken(token);
          popup.close();
          window.clearInterval(timer);
          resolve();
        } catch {
          // Cross-origin until Google redirects back to this app.
        }
      }, 500);
    });
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem('pulsemaint_google_sheets_token');
    setAccessToken(null);
  }, []);

  return {
    accessToken,
    isConnected: Boolean(accessToken),
    connect,
    disconnect,
  };
}
