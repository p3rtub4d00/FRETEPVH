export const INSTALL_REMINDER_MS = 7 * 24 * 60 * 60 * 1000;

export function isInstallEligiblePath(pathname) {
  return /^\/(cliente|motorista)(?:\/|$)/.test(pathname || "");
}

export function isMobileForInstall(userAgent, maxTouchPoints = 0) {
  const agent = String(userAgent || "");
  return /Android|iPhone|iPad|iPod|Mobile/i.test(agent) ||
    (/Macintosh/i.test(agent) && maxTouchPoints > 1);
}

export function shouldShowInstallInvite({
  pathname,
  mobile,
  standalone,
  installed,
  dismissedAt,
  now,
}) {
  if (!isInstallEligiblePath(pathname) || !mobile || standalone || installed)
    return false;
  return !Number.isFinite(dismissedAt) ||
    dismissedAt <= 0 ||
    now - dismissedAt >= INSTALL_REMINDER_MS;
}
