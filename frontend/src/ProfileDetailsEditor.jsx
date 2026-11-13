import { useEffect, useState } from "react";
import { Check, Pencil, ShieldCheck, X } from "lucide-react";
import { api } from "./api.js";

const normalizePhone = (value) => String(value || "").replace(/\D/g, "");
const phonePattern = /^[1-9]{2}9\d{8}$/;

export default function ProfileDetailsEditor({ account, busy, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account.name || "");
  const [phone, setPhone] = useState(account.phone || "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!editing) {
      setName(account.name || "");
      setPhone(account.phone || "");
    }
  }, [account.id, account.name, account.phone, editing]);

  function cancel() {
    setEditing(false);
    setName(account.name || "");
    setPhone(account.phone || "");
    setPassword("");
    setError("");
    setSuccess("");
  }

  const normalized = normalizePhone(phone);
  const phoneChanged = normalized !== normalizePhone(account.phone);
  const nameChanged = name.trim() !== (account.name || "");
  const canSave = !saving && !busy && (nameChanged || phoneChanged) &&
    name.trim().length >= 3 && name.trim().length <= 100 &&
    phonePattern.test(normalized) && (!phoneChanged || password.length > 0);

  async function submit(event) {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await api("/auth/profile", {
        method: "PATCH",
        body: { name: name.trim(), phone: normalized, ...(phoneChanged ? { password } : {}) },
      });
      await onSaved?.(result.user);
      setEditing(false);
      setPassword("");
      setSuccess(phoneChanged
        ? "Dados atualizados. Use o novo celular no próximo login."
        : "Nome atualizado com sucesso.");
    } catch (err) {
      setError(err.message || "Não foi possível salvar seus dados.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-details-editor">
      {!editing ? (
        <>
          <h2>{account.name}</h2>
          <p>{account.phone} · Porto Velho, RO</p>
          <button className="secondary profile-edit-start" type="button"
            onClick={() => { setEditing(true); setError(""); setSuccess(""); }}>
            <Pencil size={16} /> Editar nome e celular
          </button>
        </>
      ) : (
        <form className="profile-details-form" onSubmit={submit}>
          <h2>Editar meus dados</h2>
          <label htmlFor="edit-profile-name">Nome completo
            <input id="edit-profile-name" type="text" autoComplete="name"
              required minLength={3} maxLength={100} disabled={saving}
              value={name} onChange={(event) => setName(event.target.value)}
              placeholder="Seu nome completo" />
          </label>
          <label htmlFor="edit-profile-phone">Celular com DDD
            <input id="edit-profile-phone" type="tel" inputMode="numeric"
              autoComplete="tel" required disabled={saving} maxLength={18}
              value={phone} onChange={(event) => setPhone(event.target.value)}
              placeholder="(69) 99999-9999" />
          </label>
          {phoneChanged && (
            <div className="profile-phone-verification">
              <p><ShieldCheck size={17}/> Para proteger sua conta, confirme a senha atual antes de trocar o número usado no login.</p>
              <label htmlFor="edit-profile-password">Senha atual
                <input id="edit-profile-password" type="password"
                  autoComplete="current-password" value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required minLength={8} disabled={saving} placeholder="Sua senha de acesso" />
              </label>
              <small>O novo número será usado no próximo login. Confira o DDD e todos os dígitos.</small>
            </div>
          )}
          {error && <p className="error" role="alert">{error}</p>}
          <div className="profile-edit-actions">
            <button type="button" className="secondary" onClick={cancel} disabled={saving}>
              <X size={16} /> Cancelar
            </button>
            <button type="submit" className="primary" disabled={!canSave}>
              <Check size={16} /> {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      )}
      {success && !editing && <p className="photo-success" role="status">{success}</p>}
      {error && !editing && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
