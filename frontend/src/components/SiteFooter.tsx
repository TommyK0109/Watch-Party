import Logo from "./Logo";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <Logo small />
        <p>&copy; 2026 WatchParty. Built for movie nights that shouldn&apos;t need everyone in the same room.</p>
      </div>
    </footer>
  );
}
