import { createHash } from "node:crypto";

/**
 * Revoga somente a inscrição do navegador que encerrou esta sessão.
 * Nunca remova assinaturas de outros dispositivos no logout.
 */
export function pushLogoutFilter(user, role, endpoint) {
  if (!user || user.role !== role || !user._id ||
      typeof endpoint !== "string" || endpoint.length < 30 ||
      endpoint.length > 2200 || !endpoint.startsWith("https://")) return null;
  return {
    userId: String(user._id),
    endpointHash: createHash("sha256").update(endpoint).digest("hex"),
  };
}
