const STORAGE_KEY = "watchparty:tab-session-id";
const TAB_SESSION_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const CHANNEL_NAME = "watchparty:tab-sessions";

type ChannelMessage = {
  type: "probe" | "occupied";
  id: string;
  instance: string;
  startedAt: number;
  target?: string;
};

let tabId: string | null = null;
let channel: BroadcastChannel | null = null;
let ready: Promise<void> | null = null;
let readyResolved = false;
const instance = globalThis.crypto?.randomUUID?.() ?? "";
const startedAt = Date.now();

function isOlder(message: ChannelMessage) {
  return message.startedAt < startedAt
    || (message.startedAt === startedAt && message.instance < instance);
}

function announce() {
  if (!tabId) return;
  channel?.postMessage({ type: "probe", id: tabId, instance, startedAt } satisfies ChannelMessage);
}

function openChannel() {
  if (channel || !window.BroadcastChannel) return;
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<ChannelMessage>) => {
    const message = event.data;
    if (!message || message.id !== tabId || message.instance === instance) return;
    if (message.type === "probe") {
      channel?.postMessage({
        type: "occupied", id: tabId, instance, startedAt, target: message.instance
      } satisfies ChannelMessage);
    } else if (message.type === "occupied" && message.target === instance && isOlder(message)) {
      tabId = window.crypto.randomUUID();
      window.sessionStorage.setItem(STORAGE_KEY, tabId);
      announce();
      if (readyResolved) window.location.reload();
    }
  };
  announce();
}

export function getTabSessionId() {
  if (!tabId) {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    tabId = stored && TAB_SESSION_PATTERN.test(stored) ? stored : window.crypto.randomUUID();
    window.sessionStorage.setItem(STORAGE_KEY, tabId);
    openChannel();
    window.addEventListener("pagehide", () => {
      channel?.close();
      channel = null;
    });
    window.addEventListener("pageshow", () => openChannel());
  }
  return tabId;
}

async function readyTabSessionId() {
  getTabSessionId();
  if (!ready) {
    ready = new Promise((resolve) => window.setTimeout(() => {
      readyResolved = true;
      resolve();
    }, 100));
  }
  await ready;
  return getTabSessionId();
}

export async function fetchWithTabSession(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("X-Tab-Session", await readyTabSessionId());
  return fetch(url, { ...init, credentials: "include", headers });
}
