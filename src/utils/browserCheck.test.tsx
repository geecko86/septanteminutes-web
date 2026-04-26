// @vitest-environment jsdom
//
// We need a real DOM environment here because BrowserCheck is a React component
// that runs browser-specific logic inside useEffect (which only runs in a browser,
// not on a server). The jsdom directive above tells Vitest to simulate a browser
// for this file only — other test files keep running in the faster Node environment.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';

import BrowserCheck from './browserCheck';

// Helper to override navigator.userAgent for a test.
// navigator.userAgent is read-only in browsers, so we use Object.defineProperty
// to temporarily replace it — think of it as swapping out a name tag.
function setUserAgent(ua: string) {
  Object.defineProperty(navigator, 'userAgent', {
    value: ua,
    configurable: true,
  });
}

describe('BrowserCheck', () => {
  let alertSpy: ReturnType<typeof vi.spyOn>;
  let originalLocation: Location;

  beforeEach(() => {
    // Spy on window.alert so we can check if it was called without a dialog popping up.
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    // jsdom does not allow direct assignment to window.location.href, so we replace
    // the whole location object with a plain object we can write to freely.
    originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Put window.location back to avoid leaking state into other tests.
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it('shows an alert when Chromium is outdated (version < 120)', () => {
    // Pretend the browser is Chrome 80 — well below the minimum of 120.
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36');

    render(<BrowserCheck />);

    // The component should have warned the user via alert.
    expect(alertSpy).toHaveBeenCalledOnce();
    expect(alertSpy).toHaveBeenCalledWith(
      'Votre navigateur est obsolète. Veuillez le mettre à jour.'
    );
  });

  it('does nothing when Chromium is up to date (version >= 120)', () => {
    // Chrome 130 is fine — no warning should appear.
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36');

    render(<BrowserCheck />);

    expect(alertSpy).not.toHaveBeenCalled();
    expect(window.location.href).toBe('');
  });

  it('shows an alert when Safari is outdated (version < 16)', () => {
    // Safari 15 is below the minimum of 16. Real Safari UA has no "Chrome/" token.
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Safari/605.1.15');

    render(<BrowserCheck />);

    expect(alertSpy).toHaveBeenCalledOnce();
  });

  it('does nothing when Safari is up to date (version >= 16)', () => {
    // Safari 17 is modern enough — no nag.
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15');

    render(<BrowserCheck />);

    expect(alertSpy).not.toHaveBeenCalled();
    expect(window.location.href).toBe('');
  });

  it('redirects to the Android Chrome Play Store URL when outdated Chromium on Android', () => {
    // Simulate an Android phone running an old Chrome.
    setUserAgent('Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Mobile Safari/537.36');

    render(<BrowserCheck />);

    expect(alertSpy).toHaveBeenCalledOnce();
    // The component should try to send the user to the Play Store to update Chrome.
    expect(window.location.href).toBe(
      'https://play.google.com/store/apps/details?id=com.android.chrome'
    );
  });

  it('does not redirect when the browser is not Android or iOS (desktop outdated Chromium)', () => {
    // Desktop user with old Chromium: warn but no store redirect.
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36');

    render(<BrowserCheck />);

    expect(alertSpy).toHaveBeenCalledOnce();
    // No redirect — the href stays empty because there is no store link for desktops.
    expect(window.location.href).toBe('');
  });
});
