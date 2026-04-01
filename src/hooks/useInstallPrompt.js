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
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Hide install button if app is already installed
    window.addEventListener('appinstalled', () => {
      setCanInstall(false);
      setDeferredPrompt(null);
    });

    // Cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for user response
    const choiceResult = await deferredPrompt.userChoice;
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
