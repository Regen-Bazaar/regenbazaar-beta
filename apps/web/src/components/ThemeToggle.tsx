"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/** Light/dark switch. The theme itself is applied before paint by the script in layout.tsx; this only flips and saves it. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    // Follow the system setting live until the visitor picks a theme themselves.
    const mq = matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem("rb-theme");
      } catch {}
      if (saved) return;
      const t: Theme = mq.matches ? "light" : "dark";
      document.documentElement.dataset.theme = t;
      setTheme(t);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const flip = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("rb-theme", next);
    } catch {}
    setTheme(next);
  };

  const label = theme === "light" ? "Switch to dark theme" : "Switch to light theme";
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={label}
      title={label}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line-strong bg-surface text-fg transition-colors hover:border-accent"
    >
      {theme === "light" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[18px] w-[18px]" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[18px] w-[18px]" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )}
    </button>
  );
}
