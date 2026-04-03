import React from 'react';
import '../styles/UpdatePrompt.css';

export function UpdatePrompt({ show, onUpdate, isUpdating = false }) {
  if (!show) return null;

  return (
    <button
      className={`update-prompt${isUpdating ? ' update-prompt--updating' : ''}`}
      type="button"
      onClick={onUpdate}
      disabled={isUpdating}
      title="A new version is available"
      aria-label={isUpdating ? 'Updating app' : 'Update app'}
      aria-busy={isUpdating}
    >
      {isUpdating ? (
        <>
          <span className="update-prompt__spinner" aria-hidden="true" />
          Updating…
        </>
      ) : (
        <>🔄 Update Ready</>
      )}
    </button>
  );
}
