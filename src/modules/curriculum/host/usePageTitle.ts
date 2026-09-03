import { useEffect } from "react";

export function usePageTitle(title: string, suffix = "Canvas Mastery") {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const previous = document.title;
    document.title = title ? `${title} · ${suffix}` : suffix;
    return () => {
      document.title = previous;
    };
  }, [title, suffix]);
}
