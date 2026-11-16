import { useState } from "react";
import { api } from "./api.js";
import { ShieldCheck, KeyRound } from "lucide-react";

export default function StaffPasswordChange({ account, onComplete, onLogout }) {
  const [currentPassword,setCurrentPassword] = useState("");
  const [newPassword,setNewPassword] = useState("");
  const [confirmPassword,setConfirmPassword] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  async function submit(event){
    event.preventDefault();setError("");
    if(newPassword!==confirmPassword) return setError("As senhas não coincidem.");
    if(newPassword.length<8 || newPassword.length>128) return setError("A senha deve ter de 8 a 128 caracteres.");
    setBusy(true);
    try {
      await api("/auth/staff/password",{method:"POST",body:{currentPassword,newPassword}});
      onComplete();
    } catch(e){setError(e.message);} finally{setBusy(false);}
  }
  return <main className="staff-password-shell">
    <section className="staff-password-card">
      <div className="staff-password-icon"><ShieldCheck size={30}/></div>
      <h1>Primeiro acesso à equipe FreteOn</h1>
      <p>Olá, {account.name}. Por segurança, substitua a senha provisória antes de entrar no painel administrativo.</p>
      <form onSubmit={submit}>
        <label>Senha provisória<input type="password" required autoComplete="current-password"
          value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label>
        <label>Nova senha<input type="password" required minLength={8} maxLength={128} autoComplete="new-password"
          value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></label>
        <label>Confirmar nova senha<input type="password" required minLength={8} maxLength={128} autoComplete="new-password"
          value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label>
        {error&&<p role="alert" className="error">{error}</p>}
        <button type="submit" disabled={busy} className="primary full">
          <KeyRound size={18}/>{busy?"Atualizando...":"Salvar senha e entrar novamente"}
        </button>
      </form>
      <button type="button" className="text-button" onClick={onLogout}>Sair</button>
    </section>
  </main>;
}
