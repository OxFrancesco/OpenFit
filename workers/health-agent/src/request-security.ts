export function isWebSocketUpgrade(request: Request): boolean {
  return (
    request.headers
      .get("Upgrade")
      ?.split(",")
      .some((value) => value.trim().toLowerCase() === "websocket") ?? false
  );
}
