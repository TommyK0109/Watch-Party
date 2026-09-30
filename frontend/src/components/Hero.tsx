import Image from "next/image";

export default function Hero() {
  return (
    <section className="relative mx-auto grid min-h-[610px] max-w-[1120px] items-center gap-10 overflow-hidden px-5 pb-20 pt-8 sm:px-8 md:grid-cols-[0.85fr_1.15fr] md:pb-24 md:pt-10 lg:px-12">
      <div className="relative z-20 max-w-[450px] md:-translate-y-2">
        <p className="font-heading text-[30px] leading-none tracking-[0.01em] text-white sm:text-[36px]">Find movies</p>
        <h1 className="mt-1 font-heading text-[48px] leading-[0.92] tracking-[0.01em] sm:text-[64px] lg:text-[70px]">
          <span className="bg-gradient-to-r from-[#3218ff] via-[#8611d0] to-[#ee0a70] bg-clip-text text-transparent">
            TV shows and more
          </span>
        </h1>
        <p className="mt-5 max-w-[420px] text-[13px] leading-[1.55] text-white/70 sm:text-[14px]">
          Lorem Ipsum has been the industry&apos;s standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book.
        </p>
        <a
          href="#trending"
          className="mt-7 inline-flex h-11 items-center gap-2.5 rounded-[4px] border border-white px-4 text-[13px] font-semibold text-white transition hover:border-[#ee0a70] hover:bg-[#ee0a70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ee0a70] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <span className="grid size-[22px] place-items-center rounded-full bg-white shadow-[0_0_18px_rgba(238,10,112,0.8)]">
            <span className="ml-0.5 h-0 w-0 border-y-[4px] border-l-[7px] border-y-transparent border-l-black" />
          </span>
          Watch Now
        </a>
      </div>

      <div className="relative mx-auto h-[420px] w-full max-w-[560px] sm:h-[500px] md:h-[540px]">
        <div className="absolute left-[4%] top-[21%] h-[73%] w-[74%] border-l border-t border-[#6c5b9e]/55" />
        <div className="absolute bottom-[5%] left-[4%] h-px w-[91%] bg-[#6c5b9e]/55 after:absolute after:-right-1 after:-top-[3px] after:size-[7px] after:rounded-full after:bg-[#8170d4]" />
        <div className="absolute right-0 top-[3%] h-[74%] w-[55%] overflow-hidden shadow-[0_12px_34px_rgba(0,0,0,0.28)]">
          <Image src="/movies/hero-guardians.png" alt="Guardians of the Galaxy Vol. 3" fill priority sizes="(max-width: 768px) 48vw, 310px" className="object-cover" />
        </div>
        <div className="absolute bottom-[10%] left-[8%] h-[74%] w-[62%] overflow-hidden shadow-[0_18px_38px_rgba(0,0,0,0.48)]">
          <Image src="/movies/hero-spiderverse.png" alt="Spider-Man: Across the Spider-Verse" fill priority sizes="(max-width: 768px) 58vw, 350px" className="object-cover" />
          <span className="absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white shadow-[0_0_30px_rgba(238,10,112,0.38)] sm:size-16">
            <span className="ml-1 h-0 w-0 border-y-[9px] border-l-[15px] border-y-transparent border-l-[#d10035]" />
          </span>
        </div>
      </div>
    </section>
  );
}
