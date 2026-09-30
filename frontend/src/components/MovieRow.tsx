import Image from "next/image";
import Link from "next/link";
import type { Movie } from "@/data/movies";
import MovieCard from "./MovieCard";

interface MovieRowProps {
  id: string;
  title: string;
  movies: Movie[];
  showFlame?: boolean;
  onSelectMovie: (movie: Movie) => void;
}

export default function MovieRow({ id, title, movies, showFlame = false, onSelectMovie }: MovieRowProps) {
  return (
    <section id={id} className="mx-auto max-w-[1120px] scroll-mt-20 px-5 pb-20 sm:px-8 lg:px-12">
      <div className="mb-8 flex items-center gap-3">
        {showFlame && <Image src="/flame.png" alt="" width={24} height={24} className="size-6 object-contain" />}
        <h2 className="shrink-0 font-heading text-[29px] leading-none tracking-[0.015em] text-white sm:text-[34px]">{title}</h2>
        <span className="h-px flex-1 bg-[#3a3347]" />
        <Link href="/movies" className="shrink-0 text-[11px] text-white/75 transition hover:text-[#ee0a70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee0a70] sm:text-[12px]">See More</Link>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-6 lg:gap-x-7">
        {movies.map((movie, index) => <MovieCard key={`${movie.title}-${index}`} movie={movie} onSelect={onSelectMovie} />)}
      </div>
    </section>
  );
}
