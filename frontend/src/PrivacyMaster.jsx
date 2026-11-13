import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, LockKeyhole, RefreshCw } from "lucide-react";
import { api } from "./api.js";

const categoryNames = {
  acesso: "Acesso aos dados",
  correcao: "Correção",
  eliminacao: "Eliminação ou anonimização",
  oposicao: "Oposição ou revisão",
  outros: "Outros",
};

export default function PrivacyMaster() {
  const [requests, setRequests] = useState([]);
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function refresh() {
    setError("");
    try {
      const result = await api("/legal/privacy-requests");
      setRequests(result.requests || []);
    } catch (err) {
      setError(err.message || "Não foi possível carregar as solicitações.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function changeStatus(item, status) {
    setBusyId(item.id);
    setInfo("");
    setError("");
    try {
      await api("/legal/privacy-requests/" + item.id, {
        method: "PATCH",
        body: { status },
      });
      setInfo(status === "atendido" ? "Solicitação marcada como atendida." : "Solicitação reaberta.");
      await refresh();
    } catch (err) {
      setError(err.message || "Não foi possível atualizar a solicitação.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="privacy-master">
      <div className="section-heading">
        <div>
          <p className="eyebrow">LGPD · ACESSO RESTRITO AO MASTER</p>
          <h2>Solicitações de privacidade</h2>
        </div>
        <button className="secondary" type="button" onClick={refresh}>
          <RefreshCw size={16}/> Atualizar
        </button>
      </div>
      <div className="privacy-master-summary">
        <LockKeyhole size={21}/>
        <div>
          <strong>Canal de direitos dos titulares</strong>
          <p>Os pedidos feitos na Política de Privacidade aparecem aqui. Confirme a identidade antes de fornecer dados pessoais, comunique a resposta pelo contato informado e só marque como atendido depois de realmente tratar a solicitação.</p>
        </div>
      </div>
      {loading && <p role="status">Carregando solicitações...</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {info && <p className="notice" role="status">{info}</p>}
      <div className="privacy-master-list">
        {requests.map(item => (
          <article className="privacy-master-item" key={item.id}>
            <div className="privacy-master-item-title">
              <strong>{item.name}</strong>
              <span className={"wallet-status" + (item.status === "atendido" ? " success" : " warning")}>
                {item.status === "atendido" ? "Atendido" : "Pendente"}
              </span>
            </div>
            <p className="privacy-master-contact">{item.contact}</p>
            <p className="privacy-master-meta">
              {categoryNames[item.category] || item.category}
              {" · "}
              {new Date(item.createdAt).toLocaleString("pt-BR", { timeZone: "America/Porto_Velho" })}
            </p>
            <p className="privacy-master-message">{item.message}</p>
            <small>Protocolo: {item.id}</small>
            <div className="privacy-master-actions">
              {item.status === "pendente" ? (
                <button className="secondary" disabled={Boolean(busyId)}
                  onClick={() => changeStatus(item, "atendido")}>
                  <CheckCircle2 size={16}/> Marcar como atendido
                </button>
              ) : (
                <button className="secondary" disabled={Boolean(busyId)}
                  onClick={() => changeStatus(item, "pendente")}>
                  <CircleAlert size={16}/> Reabrir solicitação
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!loading && !requests.length && (
        <p className="panel muted">Nenhuma solicitação de privacidade registrada até o momento.</p>
      )}
    </section>
  );
}
