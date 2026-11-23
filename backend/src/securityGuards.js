// Políticas de sessão e validação de mutações da API.
// Não confiar em cabeçalhos de papel/usuário enviados pelo navegador.
export const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;
export const USER_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
export function adminRole(role) {
  return role === "master" || role === "staff";
}
export function sessionPolicy(role) {
  return { adminSession: adminRole(role), maxAge: adminRole(role) ? ADMIN_SESSION_MS : USER_SESSION_MS };
}
export function validAdminSession(session, userRole) {
  return !adminRole(userRole) || session?.adminSession === true;
}
export function allowsApiMutation(method, requestFlag, isJson, fetchSite) {
  return ["GET", "HEAD", "OPTIONS"].includes(method) ||
    (requestFlag === "1" && isJson && fetchSite !== "cross-site");
}
