import React from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt.js';
import '../styles/InstallPrompt.css';

/**
 * One-tap install button — appears only on installable devices.
 * Tapping it triggers the native install flow (no menu hunting).
 */
export function InstallPrompt() {
  const { canInstall, promptInstall } = useInstallPrompt();

  if (!canInstall) return null;

  return (
    <button
      className="install-prompt"
      onClick={promptInstall}
      title="Install Bub Words as an app on your device"
      aria-label="Install app"
    >
      📱 Install App
    </button>
  );
}
