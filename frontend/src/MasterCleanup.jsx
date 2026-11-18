import { useEffect, useState } from "react";
import { api } from "./api.js";
const groups = [["clients", "Clientes"], ["drivers", "Motoristas"], ["freights", "Chamados"]];
export default function MasterCleanup() {
  const [data, setData] = useState({ clients: [], drivers: [], freights: [] });
  const [kind, setKind] = useState("clients");
  const [selected, setSelected] = useState(null);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    try { setData(await api("/master/cleanup")); }
    catch (error) { setMessage(error.message); }
  }
  useEffect(() => { load(); }, []);
  async function remove() {
    if (!selected || confirmation !== "EXCLUIR") return;
    setBusy(true);
    try {
      await api("/master/cleanup/" + kind + "/" + encodeURIComponent(selected.id), {
        method: "DELETE", body: { confirmation: "EXCLUIR" },
      });
      setSelected(null);
      setConfirmation("");
      setMessage("Registro excluído. A lista foi atualizada.");
      await load();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <section className="panel master-cleanup">
    <h2>Excluir registros</h2>
    <p className="muted">Gerencie clientes, motoristas e chamados separadamente. Exclusões são permanentes. Contas com histórico de fretes e chamados com propostas ou movimentação financeira ficam protegidos.</p>
    <div className="master-cleanup-tabs">
      {groups.map(([id, title]) => <button key={id} type="button"
        className={kind === id ? "primary" : "secondary"}
        onClick={() => { setKind(id); setSelected(null); setConfirmation(""); setMessage(""); }}>
        {title} ({data[id]?.length || 0})
      </button>)}
    </div>
    {message && <p role="status" className="muted">{message}</p>}
    {(data[kind] || []).map(item => <div className="person-row" key={item.id}>
      <div><strong>{item.name || item.title}</strong>
        <p>{item.phone || (item.status === "open" ? "Chamado aberto" : "Status: " + item.status)}</p>
      </div>
      <button type="button" className="secondary" disabled={kind === "freights" && !item.deletable}
        title={kind === "freights" && !item.deletable ? "Chamado protegido por histórico ou movimentação" : ""}
        onClick={() => { setSelected(item); setConfirmation(""); setMessage(""); }}>Excluir</button>
    </div>)}
    {!data[kind]?.length && <p className="muted">Nenhum registro nesta categoria.</p>}
    {selected && <div className="master-cleanup-confirm">
      <strong>Confirmar exclusão: {selected.name || selected.title}</strong>
      <p>Esta operação não pode ser desfeita. Digite EXCLUIR para confirmar.</p>
      <input aria-label="Confirmação de exclusão" value={confirmation}
        onChange={event => setConfirmation(event.target.value)} placeholder="EXCLUIR" autoComplete="off"/>
      <div className="master-cleanup-tabs">
        <button type="button" className="secondary" onClick={() => setSelected(null)}>Cancelar</button>
        <button type="button" className="primary" disabled={busy || confirmation !== "EXCLUIR"} onClick={remove}>
          {busy ? "Excluindo..." : "Excluir definitivamente"}
        </button>
      </div>
    </div>}
  </section>;
}
