"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void; "expired-callback": () => void; language: string }) => string;
      remove: (id: string) => void;
    };
  }
}

/** Widget de Cloudflare Turnstile. No muestra nada si no hay NEXT_PUBLIC_TURNSTILE_SITE_KEY. */
export function Turnstile({ onToken }: { onToken: (token: string | null) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!siteKey || !box.current) return;
    let id: string | undefined;
    const mount = () => {
      if (window.turnstile && box.current && !id)
        id = window.turnstile.render(box.current, {
          sitekey: siteKey,
          callback: (t) => onToken(t),
          "expired-callback": () => onToken(null),
          language: "es",
        });
    };
    if (window.turnstile) mount();
    else {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = mount;
      document.head.appendChild(s);
    }
    return () => {
      if (id) window.turnstile?.remove(id);
    };
  }, [siteKey, onToken]);
  if (!siteKey) return null;
  return <div ref={box} className="min-h-16" />;
}
