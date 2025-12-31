import { useEffect, useCallback } from 'react';

export interface ShortcutMap {
  [key: string]: () => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if user is typing in input/textarea
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      return;
    }

    const key = e.key.toLowerCase();
    if (e.metaKey || e.ctrlKey) {
      const combo = `${e.metaKey ? 'cmd' : 'ctrl'}+${key}`;
      if (shortcuts[combo]) {
        e.preventDefault();
        shortcuts[combo]();
      }
    } else if (shortcuts[key]) {
      e.preventDefault();
      shortcuts[key]();
    }
  }, [shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
