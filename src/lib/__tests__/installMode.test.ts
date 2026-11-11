import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { installMode, isIosDevice } from '../pwa/installMode';

const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const SAFARI_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const FIREFOX_DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0';

describe('isIosDevice', () => {
  it('knows iPhone and iPad', () => {
    expect(isIosDevice(SAFARI_IPHONE)).toBe(true);
    expect(isIosDevice('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe(true);
  });
  it('treats a Mac with a touch screen as an iPad (iPadOS desktop mode)', () => {
    expect(isIosDevice(SAFARI_MAC, 'MacIntel', 5)).toBe(true);
  });
  it('does not treat a real Mac, Android or Windows as iOS', () => {
    expect(isIosDevice(SAFARI_MAC, 'MacIntel', 0)).toBe(false);
    expect(isIosDevice(CHROME_ANDROID, 'Linux armv81', 5)).toBe(false);
    expect(isIosDevice(CHROME_WINDOWS, 'Win32', 10)).toBe(false);
  });
});

describe('installMode', () => {
  it('offers the one-click install when the browser handed us its prompt', () => {
    expect(installMode({ standalone: false, hasPrompt: true, userAgent: CHROME_ANDROID })).toBe('prompt');
    expect(installMode({ standalone: false, hasPrompt: true, userAgent: CHROME_WINDOWS })).toBe('prompt');
  });
  it('shows the Share-menu steps on iPhone / iPad', () => {
    expect(installMode({ standalone: false, hasPrompt: false, userAgent: SAFARI_IPHONE })).toBe('ios');
    expect(
      installMode({ standalone: false, hasPrompt: false, userAgent: SAFARI_MAC, platform: 'MacIntel', maxTouchPoints: 5 }),
    ).toBe('ios');
  });
  it('is hidden once the app runs installed', () => {
    expect(installMode({ standalone: true, hasPrompt: true, userAgent: CHROME_ANDROID })).toBe('hidden');
    expect(installMode({ standalone: true, hasPrompt: false, userAgent: SAFARI_IPHONE })).toBe('hidden');
  });
  it('is hidden where the browser cannot install', () => {
    expect(installMode({ standalone: false, hasPrompt: false, userAgent: FIREFOX_DESKTOP })).toBe('hidden');
    expect(installMode({ standalone: false, hasPrompt: false, userAgent: CHROME_WINDOWS })).toBe('hidden');
  });
});

// Chrome only offers "Install" when the page links a manifest that has a
// name, a start URL, a standalone display and 192 + 512 px PNG icons.
describe('web app manifest', () => {
  const root = path.resolve(__dirname, '../../..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.json'), 'utf8'));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  it('is linked from index.html', () => {
    expect(html).toMatch(/<link rel="manifest" href="\/manifest\.json"/);
  });
  it('meets the install requirements', () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    const sizes = manifest.icons.filter((i: { type: string }) => i.type === 'image/png').map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });
  it('points only at icon files that exist', () => {
    const files = [...manifest.icons, ...(manifest.shortcuts ?? []).flatMap((s: { icons?: unknown[] }) => s.icons ?? [])];
    for (const icon of files as { src: string }[]) {
      expect(fs.existsSync(path.join(root, 'public', icon.src)), icon.src).toBe(true);
    }
  });
});
