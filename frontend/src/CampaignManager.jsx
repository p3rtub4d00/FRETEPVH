import { useEffect,useState } from "react";
import { Megaphone, Bell, RefreshCw, Send, CalendarClock } from "lucide-react";
import { api } from "./api.js";
const audienceLabel={todos:"Todos os usuários",cliente:"Clientes",motorista:"Motoristas"};
export function CampaignInbox(){
 const [items,setItems]=useState([]),[error,setError]=useState(""),[open,setOpen]=useState(false);
 async function refresh(){try{const data=await api("/campaigns/inbox");setItems(data.items||[]);setError("");}catch(e){setError(e.message);}}
 useEffect(()=>{refresh();const id=setInterval(refresh,60000);return()=>clearInterval(id);},[]);
 const unread=items.filter(x=>!x.read).length;
 async function read(item){try{await api("/campaigns/"+item.id+"/read",{method:"POST",body:{}});setItems(old=>old.map(x=>x.id===item.id?{...x,read:true}:x));}catch(e){setError(e.message);}}
 return <section className="campaign-inbox">
 <button type="button" className="campaign-inbox-toggle" onClick={()=>setOpen(v=>!v)}><Bell size={19}/> Comunicados FreteOn {unread>0&&<strong>{unread} novo(s)</strong>}</button>
 {open&&<div className="campaign-inbox-content">{error&&<p role="alert" className="error">{error}</p>}{items.length===0?<p>Nenhum comunicado no momento.</p>:items.map(item=><article key={item.id} className={"campaign-notice"+(!item.read?" unread":"")}><h3>{item.title}</h3><p>{item.body}</p><small>{new Date(item.sentAt||item.createdAt).toLocaleString("pt-BR")}</small>{!item.read&&<button type="button" className="secondary" onClick={()=>read(item)}>Marcar como lido</button>}</article>)}</div>}
 </section>;
}
export default function CampaignManager(){
 const [items,setItems]=useState([]),[enabled,setEnabled]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const [form,setForm]=useState({title:"",body:"",audience:"todos",scheduledAt:"",expiresAt:""});
 async function refresh(){try{const data=await api("/master/campaigns");setItems(data.items||[]);setEnabled(data.pushEnabled);setError("");}catch(e){setError(e.message);}}
 useEffect(()=>{refresh();},[]);
 async function submit(e){e.preventDefault();if(!window.confirm("Confirmar criação desta campanha para "+audienceLabel[form.audience]+"?"))return;setBusy(true);try{
  await api("/master/campaigns",{method:"POST",body:{...form,scheduledAt:form.scheduledAt?new Date(form.scheduledAt).toISOString():null,expiresAt:form.expiresAt?new Date(form.expiresAt).toISOString():null}});
  setNotice("Campanha registrada. O envio será processado pelo servidor na data programada.");setForm({title:"",body:"",audience:"todos",scheduledAt:"",expiresAt:""});await refresh();
 }catch(err){setError(err.message);}finally{setBusy(false);}}
 async function cancel(id){if(!window.confirm("Cancelar a campanha agendada?"))return;try{await api("/master/campaigns/"+id+"/cancel",{method:"POST",body:{}});await refresh();}catch(e){setError(e.message);}}
 return <section className="panel campaign-manager"><h2><Megaphone size={23}/> Campanhas e comunicados</h2><p>Envie avisos aos clientes e motoristas. As mensagens também ficam disponíveis dentro do aplicativo.</p>
 {!enabled&&<p className="info">O Web Push não está configurado neste servidor. Os comunicados continuarão visíveis dentro do aplicativo, mas não chegarão como notificação externa.</p>}
 {error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status" className="info">{notice}</p>}
 <form className="campaign-form" onSubmit={submit}>
 <label>Destinatários<select value={form.audience} onChange={e=>setForm({...form,audience:e.target.value})}>{Object.entries(audienceLabel).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
 <label>Título<input required maxLength={90} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Black Friday FreteOn!"/></label>
 <label>Mensagem<textarea required rows={4} maxLength={180} value={form.body} onChange={e=>setForm({...form,body:e.target.value})} placeholder="Escreva seu comunicado..."/><small>{form.body.length}/180 caracteres</small></label>
 <label><CalendarClock size={16}/> Agendar envio (opcional)<input type="datetime-local" value={form.scheduledAt} onChange={e=>setForm({...form,scheduledAt:e.target.value})}/></label>
 <label>Validade do aviso (opcional)<input type="datetime-local" value={form.expiresAt} onChange={e=>setForm({...form,expiresAt:e.target.value})}/></label>
 <div className="campaign-preview"><strong>{form.title||"Prévia do título"}</strong><p>{form.body||"Sua mensagem aparecerá aqui."}</p><small>FreteOn · {audienceLabel[form.audience]}</small></div>
 <button type="submit" disabled={busy}><Send size={17}/> {busy?"Salvando...":"Criar campanha"}</button>
 </form>
 <div className="campaign-history-head"><h3>Histórico de campanhas</h3><button type="button" className="secondary" onClick={refresh}><RefreshCw size={16}/> Atualizar</button></div>
 {items.length===0?<p>Nenhuma campanha cadastrada.</p>:items.map(item=><article className="campaign-notice" key={item.id}><strong>{item.title}</strong><p>{item.body}</p><small>{audienceLabel[item.audience]} · {item.status==="sent"?"Enviada":item.status==="scheduled"?"Agendada":item.status==="sending"?"Processando":"Cancelada"} · {new Date(item.scheduledAt).toLocaleString("pt-BR")}</small>{item.status==="sent"&&<small>Contas selecionadas: {item.recipients} · Push tentados: {item.attempted} · Aceitos pelo serviço: {item.accepted} · Falhas: {item.failed}</small>}{item.status==="scheduled"&&<button type="button" className="secondary" onClick={()=>cancel(item.id)}>Cancelar agendamento</button>}</article>)}
 <p className="campaign-disclaimer">Campanhas apenas comunicam ofertas. Não modificam automaticamente comissões ou preços. Aceitação pelo serviço push não garante visualização pelo destinatário.</p>
 </section>;
}
