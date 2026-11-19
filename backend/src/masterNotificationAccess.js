const permissions = {
  motoristas: "drivers.view", fretes: "freights.view", financeiro: "finance.view",
  denuncias: "support.view", recuperacao: null, "verificacao-telefone": null, "revisao-conta": null, geral: "dashboard.view"
};
export function masterCategories(user) {
  if (user.role === "master" && !user.staffAccountId) return Object.keys(permissions);
  const grants = user.staffPermissions || [];
  if (!grants.includes("notifications.view")) return [];
  return Object.keys(permissions).filter(key => permissions[key] && grants.includes(permissions[key]));
}
export function masterRecipientFilter(category = "geral") {
  const permission = permissions[category];
  return { $or: [ { role: "master" }, ...(permission ? [{
    role: "staff", staffEnabled: true, status: "approved", mustChangePassword: { $ne: true },
    staffPermissions: { $all: [...new Set(["notifications.view", permission])] }
  }] : []) ] };
}
