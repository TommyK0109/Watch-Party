import WatchPartyRoom from "@/components/watch-party/WatchPartyRoom";

export default async function WatchPartyRoomPage({
  params
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode } = await params;
  return <WatchPartyRoom roomCode={roomCode.toUpperCase()} />;
}
