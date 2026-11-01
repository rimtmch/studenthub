// PWA Service: Cross-Device Install Prompt & Standalone Mode Detection

export interface PWAState {
  isInstalled: boolean;
  isInstallable: boolean;
  isIOS: boolean;
  isStandalone: boolean;
}

// Check if running as installed standalone app on any device
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://') ||
    Boolean((window as any).__pwaInstalled)
  );
}

// Detect iOS / iPadOS
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return (
    /iphone|ipad|ipod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

// Trigger 1-click PWA Installation
export async function promptPWAInstall(): Promise<'accepted' | 'dismissed' | 'ios' | 'unsupported'> {
  if (isStandalone()) {
    return 'accepted';
  }

  if (isIOS()) {
    return 'ios';
  }

  const deferredPrompt = (window as any).__deferredPWAInstallPrompt;
  if (deferredPrompt) {
    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      (window as any).__deferredPWAInstallPrompt = null;
      if (choiceResult.outcome === 'accepted') {
        (window as any).__pwaInstalled = true;
        window.dispatchEvent(new Event('pwa-installed'));
      }
      return choiceResult.outcome;
    } catch (err) {
      console.warn('PWA install prompt error:', err);
    }
  }

  return 'unsupported';
}
