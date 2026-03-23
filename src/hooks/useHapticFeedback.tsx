import { useCallback } from "react";

export function useHapticFeedback() {
  const vibrate = useCallback((pattern: number | number[] = 50) => {
    if ("vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  const successVibrate = useCallback(() => vibrate([50, 30, 100]), [vibrate]);
  const tapVibrate = useCallback(() => vibrate(30), [vibrate]);
  const errorVibrate = useCallback(() => vibrate([100, 50, 100, 50, 100]), [vibrate]);

  return { vibrate, successVibrate, tapVibrate, errorVibrate };
}
