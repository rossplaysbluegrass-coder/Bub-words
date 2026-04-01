import { useState, useEffect } from 'react';

/**
 * Loads vocabulary.json from /config/vocabulary.json.
 * Returns { vocabulary, loading, error }
 *
 * vocabulary shape:
 *  {
 *    keyWords: string[],
 *    categories: { id, name, color, accentColor, items: string[] }[],
 *    items: { [id]: { label, image, audio } }
 *  }
 */
export function useVocabulary() {
  const [vocabulary, setVocabulary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/config/vocabulary.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load vocabulary: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setVocabulary(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { vocabulary, loading, error };
}
