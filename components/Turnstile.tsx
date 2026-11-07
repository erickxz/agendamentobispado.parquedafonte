"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

interface TurnstileApi {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export interface TurnstileHandle {
  reset(): void;
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error("turnstile"));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

interface Props {
  siteKey: string;
  onToken: (token: string) => void;
  onError?: () => void;
  ref?: Ref<TurnstileHandle>;
}

export function Turnstile({ siteKey, onToken, onError, ref }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const callbacks = useRef({ onToken, onError });
  callbacks.current = { onToken, onError };

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
      callbacks.current.onToken("");
    },
  }));

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          language: "pt-br",
          theme: "light",
          size: "flexible",
          callback: (token: string) => callbacks.current.onToken(token),
          "expired-callback": () => callbacks.current.onToken(""),
          "error-callback": () => {
            callbacks.current.onToken("");
            callbacks.current.onError?.();
          },
        });
      })
      .catch(() => callbacks.current.onError?.());

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey]);

  return <div ref={containerRef} style={{ minHeight: 65 }} />;
}
