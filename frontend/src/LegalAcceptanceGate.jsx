import { useState } from "react";
import { ArrowRight, FileCheck2, ShieldCheck } from "lucide-react";
import { api } from "./api.js";

export default function LegalAcceptanceGate({ account, onAccepted, onLogout }) {
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acknowledgePrivacy, setAcknowledgePrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (!acceptTerms || !acknowledgePrivacy || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api("/auth/accept-legal", {
        method: "POST",
        body: { termsAccepted: true, privacyAcknowledged: true },
      });
      onAccepted(result.user);
    } catch (err) {
      setError(err.message || "Não foi possível registrar a aceitação.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="legal-gate">
      <section className="legal-gate-card">
        <div className="legal-icon"><ShieldCheck size={27}/></div>
        <p className="eyebrow">SEGURANÇA E TRANSPARÊNCIA</p>
        <h1>Atualização dos termos do FreteOn</h1>
        <p>Antes de continuar na conta de {account.role === "motorista" ? "Motorista" : "Cliente"}, leia as regras de uso e as informações sobre seus dados.</p>
        <div className="legal-gate-summary">
          <FileCheck2 size={22}/>
          <span>O FreteOn intermedeia contratações de frete. O transporte é realizado pelo motorista escolhido. Consulte as condições de responsabilidade, pagamento e comissão.</span>
        </div>
        <form onSubmit={submit}>
          <label className="legal-check">
            <input type="checkbox" checked={acceptTerms}
              onChange={event => setAcceptTerms(event.target.checked)} required/>
            <span>Li e concordo com os <a href="/termos" target="_blank" rel="noopener noreferrer">Termos de Uso</a>.</span>
          </label>
          <label className="legal-check">
            <input type="checkbox" checked={acknowledgePrivacy}
              onChange={event => setAcknowledgePrivacy(event.target.checked)} required/>
            <span>Li e tomei ciência da <a href="/privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>.</span>
          </label>
          <p className="legal-gate-small">O aceite dos Termos e a ciência da Política não equivalem a consentimento geral para todo tratamento de dados pessoais.</p>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary full" type="submit"
            disabled={busy || !acceptTerms || !acknowledgePrivacy}>
            {busy ? "Registrando..." : "Aceitar e continuar"} <ArrowRight size={18}/>
          </button>
        </form>
        <button type="button" className="text-button"
          onClick={onLogout}>Sair desta conta</button>
      </section>
    </main>
  );
}
