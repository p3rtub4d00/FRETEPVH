import { useEffect, useState } from "react";
import { Flag, CheckCircle2 } from "lucide-react";
import { api } from "./api.js";

const categories = {
  outside_deal: "Tentativa de negociação por fora",
  inappropriate: "Comportamento inadequado",
  other: "Outro problema",
  cancel_after_booking: "Cancelamento após contratação",
};
export function ReportFreightForm({ request, role, currentId, onDone }) {
  const [category, setCategory] = useState("outside_deal");
  const [description, setDescription] = useState("");
  const [reportedId, setReportedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const driverOptions = Array.from(new Set([
    ...(request.proposals || []).map(p => p.driverId), request.driverId,
  ].filter(Boolean)));
  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await api(`/requests/${request.id}/report`, {
        method: "POST", body: { category, description, reportedId },
      });
      onDone?.();
    } catch(e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="freight-report-form">
    <p>Relate a ocorrência para análise do Master. Nenhuma conta será suspensa automaticamente.</p>
    <label>Motivo
      <select value={category} onChange={e => setCategory(e.target.value)}>
        {Object.entries(categories).filter(([key]) => key !== "cancel_after_booking").map(([key,label]) =>
          <option key={key} value={key}>{label}</option>)}
      </select>
    </label>
    {role === "cliente" && driverOptions.length > 1 && <label>Motorista envolvido
      <select value={reportedId} onChange={e => setReportedId(e.target.value)}>
        <option value="">Não identificado</option>
        {driverOptions.map(id => <option key={id} value={id}>
          Motorista da proposta {driverOptions.indexOf(id) + 1}
        </option>)}
      </select>
    </label>}
    <label>Descreva o que aconteceu
      <textarea rows={4} minLength={10} maxLength={500} required
        placeholder="Descreva o convite para negociar fora do app ou o problema ocorrido"
        value={description} onChange={e => setDescription(e.target.value)} />
    </label>
    {error && <p className="error" role="alert">{error}</p>}
    <button className="primary full" disabled={busy || description.trim().length < 10}>
      <Flag size={16}/>{busy ? "Registrando..." : "Enviar denúncia"}
    </button>
  </form>;
}

export default function MasterFreightReports() {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  async function load() {
    try { const r = await api("/master/reports"); setReports(r.reports || []); }
    catch(e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);
  async function markReviewed(id) {
    setBusy(id); setError("");
    try { await api(`/master/reports/${id}`, { method: "PATCH", body: { status: "reviewed" } }); await load(); }
    catch(e) { setError(e.message); }
    finally { setBusy(""); }
  }
  return <section className="panel">
    <h2>Denúncias e cancelamentos para análise</h2>
    <p className="muted">Registros por ordem de chegada. Verifique as evidências antes de qualquer medida.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {!reports.length && <p>Nenhuma ocorrência registrada.</p>}
    {reports.map(item => <article className="freight-report-card" key={item.id}>
      <header><Flag size={17}/>
        <strong>{categories[item.category] || item.category}</strong>
        <small>{new Date(item.createdAt).toLocaleString("pt-BR")}</small>
      </header>
      <p>{item.description}</p>
      <small>Frete: {item.requestId}</small>
      <small>Denunciante: {item.reporterRole} · ID {item.reporterId}</small>
      {item.reportedId && <small>Conta mencionada: {item.reportedId}</small>}
      <div>{item.status === "pending" ?
        <button className="secondary" disabled={busy === item.id} onClick={() => markReviewed(item.id)}>
          <CheckCircle2 size={15}/> Marcar como analisada
        </button> : <span className="muted">Analisada</span>}</div>
    </article>)}
  </section>;
}
