import { useEffect, useRef } from 'react';

export function useKeyboardShortcut(
  key: string,
  handler: () => void,
  ctrl = false,
  shift = false,
  alt = false,
): void {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === key.toLowerCase() &&
        (ctrl ? e.ctrlKey || e.metaKey : !e.ctrlKey && !e.metaKey) &&
        shift === e.shiftKey &&
        alt === e.altKey
      ) {
        e.preventDefault();
        ref.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [key, ctrl, shift, alt]);
}
