import Link from "next/link";

interface LogoProps {
  small?: boolean;
}

export default function Logo({ small = false }: LogoProps) {
  return (
    <Link
      href="/#home"
      className={`shrink-0 font-brand font-bold tracking-[-0.045em] text-white ${small ? "text-xl" : "text-[25px] sm:text-[29px]"}`}
      aria-label="WatchParty home"
    >
      Watch<span className="text-[#ee0a70]">Party</span>
    </Link>
  );
}
