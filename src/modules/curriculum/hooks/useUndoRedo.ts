import { useState, useCallback } from 'react';

export function useUndoRedo<T>(initial: T | null) {
  const [state, setState] = useState<T | null>(initial);
  const [past, setPast] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);

  const set = useCallback((next: T | null | ((prev: T | null) => T | null)) => {
    setState(prev => {
      const resolved = typeof next === 'function' ? (next as (p: T | null) => T | null)(prev) : next;
      if (prev != null) {
        setPast(p => [...p, prev]);
        setFuture([]);
      }
      return resolved;
    });
  }, []);

  const undo = useCallback(() => {
    setPast(p => {
      if (p.length === 0) return p;
      const previous = p[p.length - 1];
      const newPast = p.slice(0, -1);
      setState(cur => {
        if (cur != null) setFuture(f => [cur, ...f]);
        return previous;
      });
      return newPast;
    });
  }, []);

  const redo = useCallback(() => {
    setFuture(f => {
      if (f.length === 0) return f;
      const next = f[0];
      const newFuture = f.slice(1);
      setState(cur => {
        if (cur != null) setPast(p => [...p, cur]);
        return next;
      });
      return newFuture;
    });
  }, []);

  const reset = useCallback((value: T | null) => {
    setPast([]);
    setFuture([]);
    setState(value);
  }, []);

  return {
    state,
    set,
    undo,
    redo,
    reset,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
