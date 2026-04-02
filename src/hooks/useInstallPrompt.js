import { useState, useEffect } from 'react';

/**
 * Manages PWA installation prompt.
 *
 * Returns:
 *  - canInstall: boolean — install button should be shown
 *  - promptInstall: () => void — call when user clicks install button
 *
 * Usage:
 *  const { canInstall, promptInstall } = useInstallPrompt();
 *  if (canInstall) return <button onClick={promptInstall}>Install App</button>;
 */
export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    console.log('[Bub Words] Install prompt: listening for beforeinstallprompt...');
    
    const handleBeforeInstallPrompt = (e) => {
      console.log('[Bub Words] Install prompt: beforeinstallprompt fired ✓');
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Hide install button if app is already installed
    window.addEventListener('appinstalled', () => {
      console.log('[Bub Words] App installed via prompt');
      setCanInstall(false);
      setDeferredPrompt(null);
    });

    // Check if app is already running standalone (installed)
    if (window.navigator.standalone === true) {
      console.log('[Bub Words] App running in standalone mode (already installed)');
      setCanInstall(false);
    }

    // Cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const promptInstall = async () => {
    console.log('[Bub Words] promptInstall called. deferredPrompt:', !!deferredPrompt);
    if (!deferredPrompt) {
      console.warn('[Bub Words] No install prompt available');
      return;
    }

    // Show the install prompt
    console.log('[Bub Words] Calling deferredPrompt.prompt()...');
    deferredPrompt.prompt();

    // Wait for user response
    const choiceResult = await deferredPrompt.userChoice;
    console.log('[Bub Words] User choice:', choiceResult.outcome);
    if (choiceResult.outcome === 'accepted') {
      console.log('[Bub Words] App installed successfully');
    } else {
      console.log('[Bub Words] App installation cancelled');
    }

    // Clear the deferred prompt for next time
    setDeferredPrompt(null);
    setCanInstall(false);
  };

  return { canInstall, promptInstall };
}
