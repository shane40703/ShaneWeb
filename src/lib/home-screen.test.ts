import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deviceHomeScreenMode } from './home-screen';

const iPhone =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)';
const mac =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)';
const iPhoneSafari = `${iPhone} Version/26.0 Mobile/15E148 Safari/604.1`;
const iPhoneWebApp = `${iPhone} Mobile/15E148`;
const macSafari = `${mac} Version/26.0 Safari/605.1.15`;
const windowsChrome =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
const androidPhone = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36';
const androidWebView = 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36';
const androidChrome = `${androidPhone} (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36`;

describe('deviceHomeScreenMode', () => {
  it.each([
    ['iPhone Safari', iPhoneSafari, 5, 'ios'],
    ['Chrome on iOS', `${iPhone} CriOS/142.0.0.0 Mobile/15E148 Safari/604.1`, 5, 'ios'],
    ['Firefox on iOS', `${iPhone} FxiOS/145.0 Mobile/15E148 Safari/605.1.15`, 5, 'ios'],
    ['iPad desktop-class Safari', macSafari, 5, 'ios'],
    ['Mac Safari', macSafari, 0, null],
    ['Windows Chrome', windowsChrome, 0, null],
    [
      'Facebook on iOS',
      `${iPhone} Mobile/15E148 [FBAN/FBIOS;FBAV/520.0;FBDV/iPhone15,2;FBSV/18.0]`,
      5,
      'ios-in-app',
    ],
    ['LINE on iOS', `${iPhone} Mobile/15E148 Safari Line/13.0.0`, 5, 'ios-in-app'],
    [
      'Instagram on iOS',
      `${iPhone} Mobile/15E148 Instagram 380.0.0 (iPhone15,2; iOS 18_0; zh_TW)`,
      5,
      'ios-in-app',
    ],
    ['Android Chrome', androidChrome, 5, 'android'],
    [
      'Threads on Android',
      `${androidWebView} (KHTML, like Gecko) Version/4.0 Chrome/142.0.0.0 Mobile Safari/537.36 Barcelona 400.0.0.0`,
      5,
      'android-in-app',
    ],
    [
      'Facebook on Android',
      `${androidWebView} (KHTML, like Gecko) Version/4.0 Chrome/142.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/520.0;]`,
      5,
      'android-in-app',
    ],
  ])('%s', (_name, userAgent, maxTouchPoints, mode) => {
    expect(deviceHomeScreenMode(userAgent, maxTouchPoints)).toBe(mode);
  });
});

describe('home screen state', () => {
  // The module keeps the held prompt, so each test imports a fresh copy.
  async function load({
    userAgent = androidChrome,
    maxTouchPoints = 5,
    hasMatchMedia = true,
    displayModeStandalone = false,
    standalone = undefined as boolean | undefined,
  } = {}) {
    vi.resetModules();
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      value: maxTouchPoints,
    });
    vi.stubGlobal(
      'matchMedia',
      hasMatchMedia &&
        ((query: string) => ({
          matches: displayModeStandalone && query === '(display-mode: standalone)',
        })),
    );
    if (standalone !== undefined)
      Object.defineProperty(navigator, 'standalone', {
        configurable: true,
        value: standalone,
      });
    const homeScreen = await import('./home-screen');
    return { ...homeScreen, mode: renderHook(homeScreen.useHomeScreenMode).result };
  }

  function firePrompt(prompt: () => Promise<unknown> = async () => {}) {
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: vi.fn(prompt),
    });
    act(() => {
      window.dispatchEvent(event);
    });
    return event;
  }

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete (navigator as Navigator & { standalone?: boolean }).standalone;
    delete (navigator as { maxTouchPoints?: number }).maxTouchPoints;
  });

  it('holds the browser prompt and keeps Chrome from showing its own bar', async () => {
    const { mode } = await load();
    expect(mode.current).toBe('android');
    const event = firePrompt();
    expect(event.defaultPrevented).toBe(true);
    expect(mode.current).toBe('prompt');
  });

  it('shows the prompt once, then falls back to the written steps', async () => {
    const { mode, showInstallPrompt } = await load();
    const event = firePrompt();
    act(() => {
      showInstallPrompt();
      showInstallPrompt();
    });
    expect(event.prompt).toHaveBeenCalledOnce();
    expect(mode.current).toBe('android');
  });

  it('swallows a rejected prompt', async () => {
    const { mode, showInstallPrompt } = await load();
    firePrompt(() => Promise.reject(new Error('already shown')));
    await act(async () => showInstallPrompt());
    expect(mode.current).toBe('android');
  });

  it('hides the button after the app is installed', async () => {
    const { mode } = await load();
    firePrompt();
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(mode.current).toBeNull();
  });

  it('hides the button inside the installed app', async () => {
    const android = await load({ displayModeStandalone: true });
    expect(android.mode.current).toBeNull();
    const iOS = await load({ userAgent: iPhoneWebApp, standalone: true });
    expect(iOS.mode.current).toBeNull();
  });

  it('offers nothing on a computer, and asks the device before matchMedia', async () => {
    const { mode } = await load({
      userAgent: windowsChrome,
      maxTouchPoints: 0,
      hasMatchMedia: false,
    });
    expect(mode.current).toBeNull();
  });

  it.each([
    ['a web app on an iPhone', { userAgent: iPhoneWebApp, standalone: true }, true],
    ['Safari on an iPhone', { userAgent: iPhoneSafari, standalone: false }, false],
    ['a web app on an iPad', { userAgent: macSafari, standalone: true }, true],
    [
      'a Mac Dock web app, where popups work',
      { userAgent: macSafari, maxTouchPoints: 0, standalone: true },
      false,
    ],
    ['Android', {}, false],
  ])('isIosWebApp in %s', async (_name, device, expected) => {
    const { isIosWebApp } = await load(device);
    expect(isIosWebApp()).toBe(expected);
  });
});
