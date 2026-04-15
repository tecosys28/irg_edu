/**
 * IRG_FTR PLATFORM - Shared HEP Hooks (Human Error Prevention)
 * AUDIT FIX: Fixed stale closure bug in useDebounce
 * 
 * IPR Owner: Rohit Tidke | © 2026 Intech Research Group
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const DEBOUNCE_MS = 500;
export const SUBMIT_COOLDOWN_MS = 2000;
export const DOUBLE_ENTRY_TOLERANCE = 0.01;
export const FX_DOUBLE_ENTRY_TOLERANCE = 0.005;
export const AUTO_SAVE_INTERVAL_MS = 30000;
export const CONCURRENT_EDIT_LOCK_TIMEOUT_SECONDS = 300;
export const RATE_LIMIT_REQUESTS_PER_MINUTE = 60;
export const DUPLICATE_GUARD_TTL_MS = 5000;
export const CONFIRMATION_TIMEOUT_MS = 30000;

// ═══════════════════════════════════════════════════════════════════════════════
// 1. useDebounce - AUDIT FIX: Fixed stale closure bug
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * AUDIT FIX: This hook had a stale closure bug where the callback
 * depended on isDebouncing state, causing double submissions under rapid clicks.
 * 
 * The fix uses useRef to store the latest callback and avoids state dependencies.
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = DEBOUNCE_MS
): {
  debouncedCallback: (...args: Parameters<T>) => void;
  isDebouncing: boolean;
  cancel: () => void;
} {
  const [isDebouncing, setIsDebouncing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  // AUDIT FIX: Use ref to store latest callback to avoid stale closure
  const callbackRef = useRef<T>(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsDebouncing(false);
  }, []);

  // AUDIT FIX: debouncedCallback now uses callbackRef instead of callback directly
  // This prevents the stale closure bug where old callback values were used
  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      // Cancel any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setIsDebouncing(true);

      timeoutRef.current = setTimeout(() => {
        // AUDIT FIX: Use ref to get latest callback
        callbackRef.current(...args);
        setIsDebouncing(false);
        timeoutRef.current = null;
      }, delay);
    },
    [delay] // AUDIT FIX: Only depends on delay, not callback
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { debouncedCallback, isDebouncing, cancel };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. useAsyncDebounce - Async version with loading state
// ═══════════════════════════════════════════════════════════════════════════════

export function useAsyncDebounce<T extends (...args: any[]) => Promise<any>>(
  callback: T,
  delay: number = DEBOUNCE_MS
): {
  debouncedCallback: (...args: Parameters<T>) => void;
  isDebouncing: boolean;
  isLoading: boolean;
  cancel: () => void;
} {
  const [isDebouncing, setIsDebouncing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef<T>(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsDebouncing(false);
  }, []);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setIsDebouncing(true);

      timeoutRef.current = setTimeout(async () => {
        setIsDebouncing(false);
        setIsLoading(true);
        try {
          await callbackRef.current(...args);
        } finally {
          setIsLoading(false);
          timeoutRef.current = null;
        }
      }, delay);
    },
    [delay]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { debouncedCallback, isDebouncing, isLoading, cancel };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. useDoubleEntry - Financial value verification
// ═══════════════════════════════════════════════════════════════════════════════

export function useDoubleEntry(options?: {
  tolerance?: number;
  fxTolerance?: number;
}): {
  verifyMatch: (value1: number, value2: number, isFx?: boolean) => boolean;
  isValid: boolean;
  mismatchError: string | null;
  reset: () => void;
} {
  const tolerance = options?.tolerance ?? DOUBLE_ENTRY_TOLERANCE;
  const fxTolerance = options?.fxTolerance ?? FX_DOUBLE_ENTRY_TOLERANCE;
  const [isValid, setIsValid] = useState(false);
  const [mismatchError, setMismatchError] = useState<string | null>(null);

  const verifyMatch = useCallback(
    (value1: number, value2: number, isFx = false) => {
      const currentTolerance = isFx ? fxTolerance : tolerance;
      const diff = Math.abs(value1 - value2);
      const maxDiff = Math.max(Math.abs(value1), Math.abs(value2)) * currentTolerance;
      
      const matches = diff <= maxDiff;
      
      setIsValid(matches);
      if (!matches) {
        const tolerancePercent = (currentTolerance * 100).toFixed(1);
        setMismatchError(
          `Values do not match within ${tolerancePercent}% tolerance: ${value1} vs ${value2}`
        );
      } else {
        setMismatchError(null);
      }
      
      return matches;
    },
    [tolerance, fxTolerance]
  );

  const reset = useCallback(() => {
    setIsValid(false);
    setMismatchError(null);
  }, []);

  return { verifyMatch, isValid, mismatchError, reset };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. useConfirmation - Two-step critical actions
// ═══════════════════════════════════════════════════════════════════════════════

export function useConfirmation(options?: {
  message?: string;
  timeout?: number;
}): {
  confirm: () => Promise<boolean>;
  isPending: boolean;
  cancel: () => void;
} {
  const timeout = options?.timeout ?? CONFIRMATION_TIMEOUT_MS;
  const [isPending, setIsPending] = useState(false);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cancel = useCallback(() => {
    if (resolveRef.current) {
      resolveRef.current(false);
      resolveRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsPending(false);
  }, []);

  const confirm = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      setIsPending(true);
      resolveRef.current = resolve;

      timeoutRef.current = setTimeout(() => {
        resolve(false);
        resolveRef.current = null;
        setIsPending(false);
      }, timeout);

      // In a real implementation, this would show a modal
      // For now, auto-confirm for testing
      setTimeout(() => {
        if (resolveRef.current) {
          resolveRef.current(true);
          resolveRef.current = null;
          setIsPending(false);
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
        }
      }, 100);
    });
  }, [timeout]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { confirm, isPending, cancel };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. useDuplicateGuard - Prevent duplicate submissions
// ═══════════════════════════════════════════════════════════════════════════════

export function useDuplicateGuard(options?: {
  key?: string;
  ttl?: number;
}): {
  isDuplicate: () => boolean;
  markSubmitted: () => void;
  reset: () => void;
} {
  const ttl = options?.ttl ?? DUPLICATE_GUARD_TTL_MS;
  const lastSubmitRef = useRef<number>(0);

  const isDuplicate = useCallback(() => {
    const now = Date.now();
    return now - lastSubmitRef.current < ttl;
  }, [ttl]);

  const markSubmitted = useCallback(() => {
    lastSubmitRef.current = Date.now();
  }, []);

  const reset = useCallback(() => {
    lastSubmitRef.current = 0;
  }, []);

  return { isDuplicate, markSubmitted, reset };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. useConcurrentEditLock - Prevent simultaneous edits
// ═══════════════════════════════════════════════════════════════════════════════

export function useConcurrentEditLock(options?: {
  resourceId?: string;
  timeout?: number;
}): {
  acquireLock: (resourceId: string) => Promise<boolean>;
  releaseLock: (resourceId: string) => void;
  isLocked: (resourceId: string) => boolean;
  hasLock: boolean;
} {
  const timeout = options?.timeout ?? CONCURRENT_EDIT_LOCK_TIMEOUT_SECONDS * 1000;
  const [hasLock, setHasLock] = useState(false);
  const locksRef = useRef<Map<string, number>>(new Map());

  const acquireLock = useCallback(
    async (resourceId: string) => {
      const existingLock = locksRef.current.get(resourceId);
      const now = Date.now();

      if (existingLock && now - existingLock < timeout) {
        return false; // Lock still held
      }

      locksRef.current.set(resourceId, now);
      setHasLock(true);
      return true;
    },
    [timeout]
  );

  const releaseLock = useCallback((resourceId: string) => {
    locksRef.current.delete(resourceId);
    setHasLock(false);
  }, []);

  const isLocked = useCallback(
    (resourceId: string) => {
      const lockTime = locksRef.current.get(resourceId);
      if (!lockTime) return false;
      return Date.now() - lockTime < timeout;
    },
    [timeout]
  );

  return { acquireLock, releaseLock, isLocked, hasLock };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. useAutoSave - Interval auto-save with dirty tracking
// ═══════════════════════════════════════════════════════════════════════════════

export function useAutoSave<T>(options: {
  data: T;
  onSave: (data: T) => Promise<void>;
  interval?: number;
  enabled?: boolean;
}): {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  lastSaved: Date | null;
  saveNow: () => Promise<void>;
} {
  const { data, onSave, interval = AUTO_SAVE_INTERVAL_MS, enabled = true } = options;
  const [isDirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const dataRef = useRef<T>(data);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    dataRef.current = data;
    onSaveRef.current = onSave;
  }, [data, onSave]);

  const saveNow = useCallback(async () => {
    if (!isDirty) return;
    try {
      await onSaveRef.current(dataRef.current);
      setLastSaved(new Date());
      setDirty(false);
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [isDirty]);

  useEffect(() => {
    if (!enabled || !isDirty) return;

    const intervalId = setInterval(saveNow, interval);
    return () => clearInterval(intervalId);
  }, [enabled, isDirty, interval, saveNow]);

  return { isDirty, setDirty, lastSaved, saveNow };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. useRateLimit - Client-side rate limiting
// ═══════════════════════════════════════════════════════════════════════════════

export function useRateLimit(options?: {
  maxRequests?: number;
  windowMs?: number;
}): {
  checkLimit: () => boolean;
  recordRequest: () => void;
  remainingRequests: number;
  resetTime: number | null;
} {
  const maxRequests = options?.maxRequests ?? RATE_LIMIT_REQUESTS_PER_MINUTE;
  const windowMs = options?.windowMs ?? 60000;
  
  const requestsRef = useRef<number[]>([]);
  const [remainingRequests, setRemainingRequests] = useState(maxRequests);
  const [resetTime, setResetTime] = useState<number | null>(null);

  const cleanOldRequests = useCallback(() => {
    const now = Date.now();
    requestsRef.current = requestsRef.current.filter(
      (timestamp) => now - timestamp < windowMs
    );
  }, [windowMs]);

  const checkLimit = useCallback(() => {
    cleanOldRequests();
    const withinLimit = requestsRef.current.length < maxRequests;
    setRemainingRequests(maxRequests - requestsRef.current.length);
    
    if (!withinLimit && requestsRef.current.length > 0) {
      setResetTime(requestsRef.current[0] + windowMs);
    }
    
    return withinLimit;
  }, [cleanOldRequests, maxRequests, windowMs]);

  const recordRequest = useCallback(() => {
    requestsRef.current.push(Date.now());
    cleanOldRequests();
    setRemainingRequests(maxRequests - requestsRef.current.length);
  }, [cleanOldRequests, maxRequests]);

  return { checkLimit, recordRequest, remainingRequests, resetTime };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Export all hooks for easy import
// ═══════════════════════════════════════════════════════════════════════════════

export const HEPHooks = {
  useDebounce,
  useAsyncDebounce,
  useDoubleEntry,
  useConfirmation,
  useDuplicateGuard,
  useConcurrentEditLock,
  useAutoSave,
  useRateLimit,
};

export default HEPHooks;
