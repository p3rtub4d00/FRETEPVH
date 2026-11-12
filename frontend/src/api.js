export async function api(path, options = {}) {
  let response;
  const role = window.location.pathname.split("/")[1];
  const roleHeader = ["cliente", "motorista", "master"].includes(role)
    ? { "X-FreteOn-Role": role }
    : {};
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-FreteOn-Request": "1",
        ...roleHeader,
        ...options.headers,
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new Error("Sem conexão. Confira sua internet e tente novamente.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      data.error || "Não foi possível concluir. Tente novamente.",
    );
    error.status = response.status;
    throw error;
  }
  return data;
}
