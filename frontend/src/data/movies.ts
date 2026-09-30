export interface Movie {
  id?: number;
  title: string;
  image: string;
  year?: string;
  duration?: string;
}

export const TRENDING_MOVIES: Movie[] = [
  { title: "Guardians of the Galaxy Vol. 3", image: "/movies/poster-15.png", year: "2023", duration: "104m" },
  { title: "Shazam! Fury of the Gods", image: "/movies/poster-08.png", year: "2023", duration: "104m" },
  { title: "Dungeons & Dragons: Honor Among Thieves", image: "/movies/poster-18.png", year: "2023", duration: "104m" },
  { title: "Medellin", image: "/movies/poster-13.png", year: "2023", duration: "104m" },
  { title: "John Wick: Chapter 4", image: "/movies/poster-01.png", year: "2023", duration: "104m" },
  { title: "Spider-Man: Across the Spider-Verse", image: "/movies/hero-spiderverse.png", year: "2023", duration: "104m" },
  { title: "Tyler Perry's Sistas", image: "/movies/poster-05.png", year: "2023", duration: "104m" },
  { title: "The Cube", image: "/movies/poster-04.png", year: "2023", duration: "104m" },
  { title: "Nancy Drew", image: "/movies/poster-20.png", year: "2023", duration: "104m" },
  { title: "Rich in Love 2", image: "/movies/poster-11.png", year: "2023", duration: "104m" },
  { title: "The Black Demon", image: "/movies/poster-03.png", year: "2023", duration: "104m" },
  { title: "The Prank Panel", image: "/movies/frank-panel.png", year: "2023", duration: "104m" },
];

export const RECOMMENDED_MOVIES: Movie[] = [
  { title: "Hypnotic", image: "/movies/poster-19.png", year: "2023", duration: "104m" },
  { title: "Mojave Diamonds", image: "/movies/mojave-diamonds.png", year: "2023", duration: "104m" },
  { title: "Mojave", image: "/movies/poster-17.png", year: "2023", duration: "104m" },
  { title: "Crossfire", image: "/movies/poster-10.png", year: "2023", duration: "104m" },
  { title: "Fast X", image: "/movies/poster-02.png", year: "2023", duration: "104m" },
  { title: "The Pregnancy Promise", image: "/movies/pregnancy-promise.png", year: "2023", duration: "104m" },
  { title: "The Days", image: "/movies/poster-14.png", year: "2023", duration: "104m" },
  { title: "Days of Daisy", image: "/movies/days-of-daisy.png", year: "2023", duration: "104m" },
  { title: "Turn of the Tide", image: "/movies/poster-06.png", year: "2023", duration: "104m" },
  { title: "The Prank Panel", image: "/movies/frank-panel-alt.png", year: "2023", duration: "104m" },
  { title: "The Idol", image: "/movies/the-idol.png", year: "2023", duration: "104m" },
  { title: "The Gryphon", image: "/movies/poster-09.png", year: "2023", duration: "104m" },
];
