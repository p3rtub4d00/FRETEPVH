export const PUSH_REMINDER_MS = 7 * 24 * 60 * 60 * 1000;

export function shouldOfferPush({
  role,
  canDisplay,
  loaded,
  serverEnabled,
  supported,
  permission,
  active,
  dismissedAt,
  now,
}) {
  if (!["cliente", "motorista"].includes(role) || !canDisplay || !loaded ||
      !serverEnabled || !supported || active || permission === "denied")
    return false;
  return !(Number.isFinite(dismissedAt) && dismissedAt > 0 &&
    now - dismissedAt < PUSH_REMINDER_MS);
}
