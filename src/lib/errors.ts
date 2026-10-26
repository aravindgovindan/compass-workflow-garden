/** Keep recoverable errors readable without exposing database or transport internals. */
export function friendlyError(error: unknown, fallback = "Could not complete that action. Please try again."): string {
  if (!(error instanceof Error)) return fallback;
  const message = error.message;
  if (/fetch|network|offline|load failed/i.test(message)) return "Connection interrupted. Check your connection and try again.";
  if (/Unauthorized|401/i.test(message)) return "Your session has expired. Sign in again to continue.";
  if (/^[\[{]|Postgres|PostgREST|SQLSTATE|permission denied|constraint|stack|[a-z_]+\.[a-z_]+/.test(message)) return fallback;
  return message.length > 240 || !message.trim() ? fallback : message;
}