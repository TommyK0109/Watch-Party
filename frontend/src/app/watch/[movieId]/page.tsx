import WatchAlone from "@/components/watch-party/WatchAlone";

export default async function WatchAlonePage({ params }: { params: Promise<{ movieId: string }> }) {
  const { movieId } = await params;
  return <WatchAlone movieId={movieId} />;
}
