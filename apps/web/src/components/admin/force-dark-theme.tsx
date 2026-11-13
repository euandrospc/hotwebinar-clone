"use client";

import { useEffect } from "react";

/** Keeps the document dark while mounted, so portaled popovers match a dark-only screen. */
export function ForceDarkTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    const previousScheme = root.style.colorScheme;
    const apply = () => {
      if (!root.classList.contains("dark")) root.classList.add("dark");
      if (root.style.colorScheme !== "dark") root.style.colorScheme = "dark";
    };
    apply();
    // next-themes re-applies the user's theme after mount; put dark back whenever it does.
    const observer = new MutationObserver(apply);
    observer.observe(root, { attributes: true, attributeFilter: ["class", "style"] });
    return () => {
      observer.disconnect();
      if (!wasDark) root.classList.remove("dark");
      root.style.colorScheme = previousScheme;
    };
  }, []);
  return null;
}
