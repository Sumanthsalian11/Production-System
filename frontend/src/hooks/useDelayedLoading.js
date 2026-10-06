import { useEffect, useRef, useState } from "react";

/**
 * Shows loading state only if `isLoading` stays true past `delay` ms.
 * Once shown, stays visible for at least `minVisible` ms to avoid flicker.
 */
export default function useDelayedLoading(isLoading, delay = 400, minVisible = 500) {
  const [showLoader, setShowLoader] = useState(false);
  const showTimerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const shownAtRef = useRef(null);

  useEffect(() => {
    if (isLoading) {
      clearTimeout(hideTimerRef.current);
      showTimerRef.current = setTimeout(() => {
        shownAtRef.current = Date.now();
        setShowLoader(true);
      }, delay);
    } else {
      clearTimeout(showTimerRef.current);

      if (shownAtRef.current) {
        const elapsed = Date.now() - shownAtRef.current;
        const remaining = Math.max(minVisible - elapsed, 0);
        hideTimerRef.current = setTimeout(() => {
          setShowLoader(false);
          shownAtRef.current = null;
        }, remaining);
      } else {
        setShowLoader(false);
      }
    }

    return () => {
      clearTimeout(showTimerRef.current);
      clearTimeout(hideTimerRef.current);
    };
  }, [isLoading, delay, minVisible]);

  return showLoader;
}