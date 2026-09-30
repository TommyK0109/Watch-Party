import { io } from "socket.io-client";
import { getTabSessionId } from "./tabSession";

function socketUrl() {
  const explicit = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (explicit) return explicit;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl?.startsWith("http")) return apiUrl.replace(/\/api\/?$/, "");
  return undefined;
}

export function createWatchPartySocket() {
  return io(socketUrl(), {
    auth: (callback) => callback({ tabSessionId: getTabSessionId() }),
    withCredentials: true,
    autoConnect: false,
    transports: ["websocket", "polling"]
  });
}
