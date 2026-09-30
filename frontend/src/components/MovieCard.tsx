import Image from "next/image";
import type { Movie } from "@/data/movies";

interface MovieCardProps {
  movie: Movie;
  onSelect: (movie: Movie) => void;
}

export default function MovieCard({ movie, onSelect }: MovieCardProps) {
  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Choose how to watch ${movie.title}`}
      onClick={() => onSelect(movie)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(movie);
        }
      }}
      className="group min-w-0 cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[#ee0a70] focus-visible:ring-offset-4 focus-visible:ring-offset-black"
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.16)]">
        <Image
          src={movie.image}
          alt={movie.title}
          fill
          sizes="(max-width: 640px) 42vw, (max-width: 900px) 23vw, 160px"
          className="object-cover transition duration-500 group-hover:scale-[1.045] group-focus-within:scale-[1.045]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Choose how to watch ${movie.title}`}
          className="absolute left-1/2 top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 scale-75 place-items-center rounded-full bg-white text-black opacity-0 shadow-xl transition group-hover:scale-100 group-hover:opacity-100 focus:scale-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee0a70]"
        >
          <span className="ml-0.5 h-0 w-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-[#d10035]" />
        </button>
      </div>
      <h3 className="mt-3 truncate text-[13px] font-medium leading-tight text-white sm:text-[14px]" title={movie.title}>{movie.title}</h3>
      <p className="mt-2 flex items-center gap-2 text-[11px] text-white/55 sm:text-[12px]">
        <span>{movie.year}</span>
        <span className="size-1 rounded-full bg-[#ee0a70]" />
        <span>{movie.duration}</span>
      </p>
    </article>
  );
}
