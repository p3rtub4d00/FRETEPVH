import { useEffect, useMemo, useState } from "react";
import { Ban, CheckCircle2, Search, Trash2, ShieldCheck, History, Users, Truck, AlertTriangle } from "lucide-react";
import { api } from "./api.js";

const tabs = [
  { id: "cliente", title: "Clientes", Icon: Users },
  { id: "motorista", title: "Motoristas", Icon: Truck },
  { id: "master", title: "Administração", Icon: ShieldCheck },
];
const adminLabel = item => item.adminRole === "owner" ? "Master Principal"
  : "Equipe · " + ({ operacional:"Operacional",financeiro:"Financeiro",atendimento:"Atendimento",auditor:"Auditor" }[item.adminRole] || "Administrador");

export default function MasterUsers({ users = [], canManage, onRefresh, onNavigate }) {
  const [tab, setTab] = useState("cliente");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [details, setDetails] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const visibleTabs = canManage ? tabs : tabs.filter(item => item.id !== "master");
  const matching = useMemo(() => users.filter(item => {
    if (item.role !== tab) return false;
    const searchText = (item.name + " " + (item.phone || "") + " " +
      (item.vehicle || "")).toLocaleLowerCase("pt-BR");
    return searchText.includes(search.trim().toLocaleLowerCase("pt-BR"));
  }), [users, tab, search]);
  useEffect(() => { if (!canManage && tab === "master") setTab("cliente"); }, [canManage, tab]);
  const counts = useMemo(() => Object.fromEntries(tabs.map(item =>
    [item.id, users.filter(person => person.role === item.id).length])), [users]);

  function resetAction() {
    setSelected(null); setAction(""); setDetails(null); setReason("");
    setConfirmation(""); setError("");
  }
  function changeTab(next) {
    setTab(next); setSearch(""); setMessage(""); resetAction();
  }
  async function inspect(person) {
    resetAction(); setSelected(person); setAction("history"); setBusy(true);
    try { setDetails(await api("/master/accounts/" + person.id + "/moderation")); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function perform() {
    if (!canManage || !selected || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      if (action === "delete") {
        if (confirmation !== "EXCLUIR") return;
        await api("/master/cleanup/" + (selected.role === "cliente" ? "clients" : "drivers")
          + "/" + selected.id, { method:"DELETE", body:{ confirmation:"EXCLUIR" }});
        setMessage("Conta excluída definitivamente. Registros financeiros vinculados não podem ser apagados.");
      } else {
        if (reason.trim().length < 10) return;
        await api("/master/accounts/" + selected.id + "/moderation", {
          method:"POST",
          body:{ action, reason:reason.trim() }
        });
        setMessage(action === "block" ? "Conta bloqueada e sessões encerradas." :
          "Conta desbloqueada. O titular já pode entrar novamente.");
      }
      resetAction();
      await onRefresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <section className="panel master-users">
    <div className="master-users-heading">
      <div><h2>Gerenciamento de usuários</h2>
        <p className="muted">Cadastros separados por perfil, com ferramentas de segurança para o Master Principal.</p>
      </div>
    </div>
    <div className="master-users-tabs" role="tablist" aria-label="Perfis de usuário">
      {visibleTabs.map(({ id, title, Icon }) =>
        <button key={id} type="button" role="tab" aria-selected={tab === id}
          className={tab === id ? "active" : ""} onClick={() => changeTab(id)}>
          <Icon size={17}/>{title}<span>{counts[id] || 0}</span>
        </button>
      )}
    </div>
    {tab === "master" ? <>
      <p className="muted">A conta Master Principal não pode ser bloqueada ou excluída por esta tela. As contas da equipe são gerenciadas em Gestão de equipe.</p>
      <button type="button" className="secondary" onClick={() => onNavigate("equipe")}>
        <ShieldCheck size={16}/> Gerenciar equipe
      </button>
    </> : <label className="master-users-search">
      <span><Search size={17}/> Buscar {tab === "cliente" ? "cliente" : "motorista"} por nome ou telefone</span>
      <input type="search" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Digite o nome ou celular" autoComplete="off"/>
    </label>}
    {message && <p role="status" className="info">{message}</p>}
    <div className="master-users-list">
      {matching.map(person => <div className="master-users-person" key={person.id}>
        <div className="master-users-avatar" aria-hidden="true">
          {person.initials || (person.name || "?").slice(0,2).toUpperCase()}
        </div>
        <div className="master-users-person-info">
          <strong>{person.name}</strong>
          <small>{tab === "master" ? adminLabel(person) : (person.vehicle || (tab === "cliente" ? "Cliente" : "Motorista"))}{person.phone ? " · " + person.phone : ""}</small>
          {tab !== "master" && <span className={person.blocked ? "master-users-badge blocked" : "master-users-badge"}>
            {person.blocked ? "Conta bloqueada" : "Conta ativa"}
          </span>}
        </div>
        {canManage && tab !== "master" && <div className="master-users-actions">
          <button type="button" className="secondary" onClick={() => inspect(person)}>
            <History size={15}/> Histórico
          </button>
          <button type="button" className="secondary"
            onClick={() => { resetAction(); setSelected(person); setAction(person.blocked ? "unblock" : "block"); }}>
            {person.blocked ? <CheckCircle2 size={15}/> : <Ban size={15}/>}
            {person.blocked ? "Desbloquear" : "Bloquear"}
          </button>
          <button type="button" className="secondary master-users-delete"
            onClick={() => { resetAction(); setSelected(person); setAction("delete"); }}>
            <Trash2 size={15}/> Excluir
          </button>
        </div>}
      </div>)}
      {!matching.length && <p className="muted">Nenhum cadastro encontrado nesta categoria.</p>}
    </div>
    {selected && canManage && tab !== "master" && <div className="master-users-dialog" role="region"
      aria-label="Ação administrativa selecionada">
      <div className="master-users-dialog-title"><strong>
        {action === "history" ? "Histórico de moderação" :
          action === "block" ? "Bloquear usuário" :
          action === "unblock" ? "Desbloquear usuário" : "Excluir usuário"}
        {" · "}{selected.name}
      </strong>
        <button className="secondary" type="button" onClick={resetAction}>Fechar</button>
      </div>
      {action === "history" ? <>
        {busy && <p className="muted">Carregando registros…</p>}
        {details?.blocked && <p className="info">Bloqueio atual: {details.blockedReason || "Sem justificativa disponível"}</p>}
        {details && !details.events?.length && <p className="muted">Nenhuma ocorrência de moderação registrada.</p>}
        {details?.events?.map(event => <div key={event.id} className="master-users-event">
          <strong>{event.action === "block" ? "Bloqueado" : "Desbloqueado"}</strong>
          <small>{new Date(event.createdAt).toLocaleString("pt-BR")}</small>
          <p>{event.reason}</p>
        </div>)}
      </> : action === "delete" ? <>
        <p><AlertTriangle size={17} inline/> Exclusão definitiva. Contas com chamados ou propostas vinculados são protegidas pelo sistema.</p>
        <label>Digite EXCLUIR para confirmar
          <input value={confirmation} autoComplete="off" placeholder="EXCLUIR"
            onChange={e => setConfirmation(e.target.value)}/>
        </label>
        <button type="button" className="primary" disabled={busy || confirmation !== "EXCLUIR"} onClick={perform}>
          {busy ? "Processando..." : "Excluir definitivamente"}
        </button>
      </> : <>
        <p className="muted">{action === "block"
          ? "O acesso será suspenso em todos os dispositivos. Pedidos abertos de clientes serão cancelados. Chamados já contratados ou em andamento precisam ser resolvidos primeiro. Histórico e registros financeiros serão preservados."
          : "O usuário voltará a acessar sua conta. A reativação não substitui a aprovação documental do motorista."}</p>
        <label>Justificativa obrigatória
          <textarea rows={3} maxLength={500} minLength={10} value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Informe o motivo da decisão para o histórico administrativo"/>
        </label>
        <button type="button" className="primary" disabled={busy || reason.trim().length < 10} onClick={perform}>
          {busy ? "Processando..." : action === "block" ? "Confirmar bloqueio" : "Confirmar desbloqueio"}
        </button>
      </>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>}
  </section>;
}
