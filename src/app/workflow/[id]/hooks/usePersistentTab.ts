"use client";

import { useEffect, useState } from "react";

export default function usePersistentTab<T extends string>(
  storageKey: string,
  initialValue: T,
) {
  const [value, setValue] = useState<T>(initialValue);

  // Load saved value on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setValue(saved as T);
      }
    } catch {
      // ignore read errors
    }
  }, [storageKey]);

  // Persist on change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, value);
    } catch {
      // ignore write errors
    }
  }, [storageKey, value]);

  return [value, setValue] as const;
}
