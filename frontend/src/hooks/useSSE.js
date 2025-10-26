// src/hooks/useSSE.js
"use client";

import { useEffect, useRef } from "react";

/**
 * Robust useSSE hook
 * - callback: function(payload) — will be called for every message
 * - options:
 *    - useTokenQuery (default true) — append ?token=... for EventSource
 *    - onOpen, onError (optional callbacks)
 *
 * This implementation keeps the EventSource stable and avoids re-creating it
 * when the `callback` identity changes by storing callback in a ref.
 */
export function useSSE(callback, options = {}) {
  const { useTokenQuery = true, onOpen, onError } = options || {};
  const cbRef = useRef(callback);
  const esRef = useRef(null);
  const reconnectRef = useRef({ attempts: 0, timer: null, stopped: false });
  const optsRef = useRef({ useTokenQuery });

  // keep latest callback in a ref so EventSource handlers always call latest
  cbRef.current = callback;

  useEffect(() => {
    optsRef.current.useTokenQuery = useTokenQuery;
  }, [useTokenQuery]);

  useEffect(() => {
    reconnectRef.current.stopped = false;

    const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:4000/api/v1";
    const base = apiBase.replace(/\/$/, "");
    const token = typeof window !== "undefined" ? localStorage.getItem("dcfs_token") : null;
    let url = `${base}/streams/jobs`;
    if (optsRef.current.useTokenQuery && token) url += `?token=${encodeURIComponent(token)}`;

    let closedNormally = false;

    function connect() {
      // if already open, don't re-create
      if (esRef.current) return;

      try {
        const es = new EventSource(url);
        esRef.current = es;

        es.onopen = () => {
          reconnectRef.current.attempts = 0;
          onOpen && onOpen();
          // optionally notify caller
        };

        es.onmessage = (e) => {
          try {
            const payload = JSON.parse(e.data);
            if (cbRef.current) cbRef.current(payload);
          } catch (err) {
            // ignore parse errors
          }
        };

        // generic error handler
        es.onerror = (err) => {
          onError && onError(err);
          // close and schedule reconnect
          try { es.close(); } catch (e) {}
          esRef.current = null;
          if (!reconnectRef.current.stopped) scheduleReconnect();
        };

        // attach a set of named events as well (optional)
        const namedHandler = (e) => {
          try {
            const payload = JSON.parse(e.data);
            if (cbRef.current) cbRef.current(payload);
          } catch (err) {}
        };
        // safe to add these; they won't duplicate message handler
        es.addEventListener("pin:success", namedHandler);
        es.addEventListener("thumb:success", namedHandler);
        es.addEventListener("verify:success", namedHandler);
      } catch (err) {
        // if EventSource creation throws (rare), schedule reconnect
        esRef.current = null;
        scheduleReconnect();
      }
    }

    function scheduleReconnect() {
      const r = reconnectRef.current;
      r.attempts = Math.min(10, r.attempts + 1);
      const delay = Math.min(30000, 500 * Math.pow(2, r.attempts)); // exponential backoff cap 30s
      if (r.timer) clearTimeout(r.timer);
      r.timer = setTimeout(() => {
        if (!r.stopped) connect();
      }, delay);
    }

    // start initial connection
    connect();

    return () => {
      // stop reconnect attempts
      reconnectRef.current.stopped = true;
      if (reconnectRef.current.timer) clearTimeout(reconnectRef.current.timer);

      // close active connection cleanly
      try {
        if (esRef.current) {
          try { esRef.current.close(); } catch (e) {}
          esRef.current = null;
        }
      } catch (e) {}
    };
  }, [ /* intentionally empty: we don't re-create on callback change */ ]);
}
