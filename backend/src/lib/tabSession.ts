const TAB_SESSION_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

export function sessionCookieNames(tabSessionId: unknown) {
  if (tabSessionId == null) {
    return { access: "accessToken", refresh: "refreshToken" };
  }
  if (typeof tabSessionId !== "string" || !TAB_SESSION_PATTERN.test(tabSessionId)) {
    throw new Error("Invalid tab session");
  }
  return {
    access: `accessToken_${tabSessionId}`,
    refresh: `refreshToken_${tabSessionId}`
  };
}
