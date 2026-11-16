import { useEffect, useState } from "react";
import { api } from "./api.js";
import { ShieldCheck, UserPlus, Users, KeyRound, Ban, CheckCircle2, History, Copy } from "lucide-react";

const roles = {
  operacional: "Administrador operacional",
  financeiro: "Financeiro",
  atendimento: "Atendimento",
  auditor: "Auditor (somente consulta)"
};
const formatTime = value => value ? new Date(value).toLocaleString("pt-BR") : "—";
const normalizePhone = text => text.replace(/\D/g,"");

function MemberCard({ item, presets, descriptions, onRefresh, onTemporary }) {
  const [expanded,setExpanded] = useState(false);
  const [teamRole,setTeamRole] = useState(item.teamRole);
  const [permissions,setPermissions] = useState(item.permissions || []);
  const [name,setName] = useState(item.name);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const changeRole = value => {
    setTeamRole(value);
    setPermissions([...(presets[value]?.permissions || [])]);
  };
  async function perform(path,method,body) {
    setBusy(true);setError("");
    try {
      const data = await api(path,{method,body});
      if(data.temporaryPassword) onTemporary(item.name,data.temporaryPassword,item.phone);
      await onRefresh();
      setExpanded(false);
    } catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const path = `/master/team/${item.id}`;
  return <article className="team-member-card">
    <div className="team-member-top">
      <div className="team-avatar"><Users size={21}/></div>
      <div className="team-member-name"><strong>{item.name}</strong>
        <small>{roles[item.teamRole] || item.teamRole} · {item.phone}</small>
      </div>
      <span className={item.enabled ? "team-member-active" : "team-member-blocked"}>
        {item.enabled ? "Ativo" : "Bloqueado"}
      </span>
    </div>
    <div className="team-member-operations">
      <button type="button" className="secondary" onClick={()=>setExpanded(!expanded)}>
        {expanded?"Fechar ajustes":"Editar permissões"}
      </button>
      <button type="button" className="secondary" disabled={busy}
        onClick={()=>{if(window.confirm("Gerar nova senha provisória e desconectar todos os dispositivos deste funcionário?"))
          perform(`${path}/reset-password`,"POST",{});}}>
        <KeyRound size={15}/> Redefinir senha
      </button>
      <button type="button" className="secondary" disabled={busy}
        onClick={()=>{if(window.confirm(item.enabled?
          "Bloquear esta conta e encerrar as sessões imediatamente?":
          "Reativar esta conta da equipe?"))perform(path,"PATCH",{enabled:!item.enabled});}}>
        {item.enabled?<Ban size={15}/>:<CheckCircle2 size={15}/>}
        {item.enabled?"Bloquear":"Reativar"}
      </button>
    </div>
    {expanded && <form className="team-member-edit" onSubmit={e=>{
      e.preventDefault();perform(path,"PATCH",{name,teamRole,permissions});
    }}>
      <label>Nome completo<input value={name} required minLength={3} maxLength={100}
        onChange={e=>setName(e.target.value)}/></label>
      <label>Nível de acesso<select value={teamRole} onChange={e=>changeRole(e.target.value)}>
        {Object.entries(roles).map(([id,label])=><option key={id} value={id}>{label}</option>)}
      </select></label>
      <div className="team-permission-list">
        <strong>Permissões individuais</strong>
        {Object.entries(descriptions).map(([id,label])=>(
          <label key={id}>
            <input type="checkbox" checked={permissions.includes(id)}
              disabled={id==="dashboard.view" || (teamRole==="auditor" && !id.endsWith(".view"))}
              onChange={e=>setPermissions(current=>
                e.target.checked?[...current,id]:current.filter(key=>key!==id))}/>
            {label}
          </label>
        ))}
      </div>
      <p className="muted">Salvar alterações encerra as sessões atuais deste funcionário.</p>
      <button className="primary" disabled={busy}>{busy?"Salvando...":"Salvar alterações"}</button>
    </form>}
    {error&&<p className="error" role="alert">{error}</p>}
  </article>;
}

export default function TeamManagement() {
  const [data,setData] = useState({items:[],presets:{},descriptions:{}});
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [tab,setTab] = useState("team");
  const [events,setEvents] = useState([]);
  const [form,setForm] = useState({name:"",phone:"",teamRole:"operacional",permissions:[]});
  const [secret,setSecret] = useState(null);
  async function load() {
    const result = await api("/master/team");
    setData(result);
    return result;
  }
  useEffect(()=>{let alive=true;load().catch(e=>{if(alive)setError(e.message)})
    .finally(()=>{if(alive)setLoading(false)});return ()=>{alive=false};},[]);
  async function create(e){
    e.preventDefault();setBusy(true);setError("");setSecret(null);
    try {
      const result=await api("/master/team",{method:"POST",body:{
        name:form.name,phone:normalizePhone(form.phone),
        teamRole:form.teamRole,permissions:form.permissions.length?
          form.permissions:data.presets[form.teamRole]?.permissions
      }});
      setSecret({name:result.item.name,phone:result.item.phone,password:result.temporaryPassword});
      setForm({name:"",phone:"",teamRole:"operacional",permissions:[]});
      await load();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function changeTab(next){
    setTab(next);setError("");
    if(next==="audit")try{const result=await api("/master/audit");setEvents(result.items);}
    catch(e){setError(e.message);}
  }
  return <section className="team-panel">
    <div className="team-heading"><div><h2>Gestão de equipe</h2>
      <p>Somente o Master Principal cadastra funcionários e define permissões.</p></div>
      <ShieldCheck size={29}/>
    </div>
    <div className="team-tabs" role="group" aria-label="Seção da equipe">
      <button type="button" className={tab==="team"?"active":""} onClick={()=>changeTab("team")}><Users size={17}/> Equipe ({data.items.length})</button>
      <button type="button" className={tab==="audit"?"active":""} onClick={()=>changeTab("audit")}><History size={17}/> Atividades</button>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {tab==="audit"?<div className="team-audit">
      {events.length ? events.map(entry=><div className="team-audit-row" key={entry.id}>
        <span><strong>{entry.name}</strong> · {entry.level}</span>
        <small>{entry.method} {entry.path} · {formatTime(entry.at)}</small>
      </div>):<p className="muted">Nenhuma atividade administrativa registrada nesta versão.</p>}
    </div>:<>
      {secret && <div className="team-temp-secret" role="status">
        <strong>Senha provisória de {secret.name}</strong>
        <p>Esta senha é mostrada apenas agora. Envie diretamente ao funcionário; no primeiro acesso ele deverá criar uma senha pessoal.</p>
        <div><code>{secret.password}</code>
          <button type="button" className="secondary" onClick={()=>navigator.clipboard?.writeText(secret.password)}>
            <Copy size={15}/> Copiar
          </button></div>
        <button type="button" className="text-button" onClick={()=>setSecret(null)}>Ocultar senha</button>
      </div>}
      <form className="team-create-form" onSubmit={create}>
        <div className="team-form-title"><UserPlus size={19}/><strong>Cadastrar funcionário</strong></div>
        <div className="team-form-grid">
          <label>Nome completo<input required minLength={3} maxLength={100}
            value={form.name} placeholder="Nome do funcionário"
            onChange={e=>setForm({...form,name:e.target.value})}/></label>
          <label>Celular com DDD<input required inputMode="tel"
            value={form.phone} placeholder="(69) 99999-9999"
            onChange={e=>setForm({...form,phone:e.target.value})}/></label>
          <label>Nível de acesso<select value={form.teamRole}
            onChange={e=>setForm({...form,teamRole:e.target.value,permissions:[]})}>
            {Object.entries(roles).map(([id,label])=><option key={id} value={id}>{label}</option>)}
          </select></label>
        </div>
        <p className="muted">As permissões padrão do nível serão aplicadas. Você poderá personalizá-las depois.</p>
        <button type="submit" className="primary" disabled={busy}>{busy?"Cadastrando...":"Criar acesso"}</button>
      </form>
      <div className="team-list">
        <h3>Funcionários cadastrados</h3>
        {loading?<p>Carregando equipe...</p>:
          data.items.length ? data.items.map(item=><MemberCard key={item.id} item={item}
            presets={data.presets} descriptions={data.descriptions} onRefresh={load}
            onTemporary={(name,password,phone)=>setSecret({name,password,phone})}/>):
          <p className="muted">Nenhum funcionário cadastrado. A conta Master Principal permanece exclusiva.</p>}
      </div>
    </>}
  </section>;
}
