"use client";

import { useCallback, useRef } from "react";
import { apiFetch } from "./api";

interface ViewSession {
  movieId: number;
  scope: string;
  sessionId: string;
  pending: boolean;
  recorded: boolean;
}

export function useRecordMovieView(movieId: number | null, scope = "") {
  const sessionRef = useRef<ViewSession | null>(null);

  return useCallback(() => {
    if (movieId == null) return;
    if (sessionRef.current?.movieId !== movieId || sessionRef.current.scope !== scope) {
      sessionRef.current = {
        movieId,
        scope,
        sessionId: crypto.randomUUID(),
        pending: false,
        recorded: false
      };
    }

    const session = sessionRef.current;
    if (session.pending || session.recorded) return;
    session.pending = true;

    void apiFetch(`/movies/${movieId}/views`, {
      method: "POST",
      keepalive: true,
      body: JSON.stringify({ sessionId: session.sessionId })
    }, false)
      .then((response) => {
        session.pending = false;
        if (response.ok) session.recorded = true;
      })
      .catch(() => { session.pending = false; });
  }, [movieId, scope]);
}
