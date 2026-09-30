"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";
import {
  mergeMovieCatalog,
  searchMovies,
  type ApiMovie
} from "@/lib/movies";

interface MovieSearchProps {
  initialQuery?: string;
  mobile?: boolean;
  onNavigate?: () => void;
}

const MAX_SUGGESTIONS = 6;

export default function MovieSearch({ initialQuery = "", mobile = false, onNavigate }: MovieSearchProps) {
  const router = useRouter();
  const listboxId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [databaseMovies, setDatabaseMovies] = useState<ApiMovie[]>([]);
  const [isFocused, setFocused] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `${API_URL}/movies?search=${encodeURIComponent(trimmedQuery)}&limit=${MAX_SUGGESTIONS}`,
          { signal: controller.signal }
        );
        if (!response.ok) return;
        const body = await response.json() as { data: ApiMovie[] };
        setDatabaseMovies(body.data);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setDatabaseMovies([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const suggestions = useMemo(
    () => searchMovies(mergeMovieCatalog(databaseMovies), query).slice(0, MAX_SUGGESTIONS),
    [databaseMovies, query]
  );
  const showSuggestions = isFocused && query.trim().length > 0;

  function navigate(value = query) {
    const nextQuery = value.trim();
    const destination = nextQuery
      ? `/movies?q=${encodeURIComponent(nextQuery)}`
      : "/movies";
    setFocused(false);
    setActiveIndex(-1);
    onNavigate?.();
    router.push(destination);
  }

  return (
    <div ref={wrapperRef} className={`relative ${mobile ? "w-full" : "w-[210px] xl:w-[240px]"}`}>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          navigate(activeIndex >= 0 ? suggestions[activeIndex]?.title : query);
        }}
      >
        <label htmlFor={`${listboxId}-input`} className="sr-only">Search movies</label>
        <div className="relative">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/45">
            <path d="m21 21-4.35-4.35m2.35-5.4A7.75 7.75 0 1 1 3.5 11.25a7.75 7.75 0 0 1 15.5 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            id={`${listboxId}-input`}
            type="search"
            value={query}
            placeholder="Search movies"
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={showSuggestions}
            aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
            onFocus={() => setFocused(true)}
            onBlur={(event) => {
              if (!wrapperRef.current?.contains(event.relatedTarget)) setFocused(false);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              if (!event.target.value.trim()) setLoading(false);
              setActiveIndex(-1);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && suggestions.length) {
                event.preventDefault();
                setActiveIndex((index) => (index + 1) % suggestions.length);
              } else if (event.key === "ArrowUp" && suggestions.length) {
                event.preventDefault();
                setActiveIndex((index) => index <= 0 ? suggestions.length - 1 : index - 1);
              } else if (event.key === "Escape") {
                setFocused(false);
                setActiveIndex(-1);
              }
            }}
            className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.055] py-2 pl-9 pr-9 text-xs text-white outline-none transition placeholder:text-white/35 hover:border-white/20 focus:border-[#ee0a70]/70 focus:bg-white/[0.08] focus:ring-2 focus:ring-[#ee0a70]/20"
          />
          {isLoading && (
            <span aria-label="Searching" className="absolute right-3 top-1/2 size-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-white/20 border-t-[#ff6cae]" />
          )}
        </div>
      </form>

      {showSuggestions && (
        <div id={listboxId} role="listbox" className="absolute inset-x-0 top-[calc(100%+8px)] z-[70] overflow-hidden rounded-2xl border border-white/10 bg-[#130d18]/98 p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.7)] backdrop-blur-xl">
          {suggestions.length ? suggestions.map((movie, index) => (
            <button
              id={`${listboxId}-${index}`}
              key={movie.title}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => navigate(movie.title)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition ${index === activeIndex ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/[0.07] hover:text-white"}`}
            >
              <span className="min-w-0 flex-1 truncate">{movie.title}</span>
              {movie.year && <span className="shrink-0 text-[10px] text-white/35">{movie.year}</span>}
            </button>
          )) : !isLoading ? (
            <p className="px-3 py-4 text-center text-xs text-white/40">No movies found</p>
          ) : null}
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => navigate()}
            className="mt-1 flex w-full items-center justify-between border-t border-white/[0.07] px-3 py-2.5 text-left text-[11px] font-medium text-[#ff6cae] transition hover:text-white"
          >
            <span>See all results</span>
            <span aria-hidden="true">↵</span>
          </button>
        </div>
      )}
    </div>
  );
}
