import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, CheckCheck, RefreshCw } from "lucide-react";
import { api } from "./api.js";
import PushNotificationsPanel from "./PushNotificationsPanel.jsx";

const labels = { motoristas:"Motoristas",fretes:"Fretes",financeiro:"Financeiro",recuperacao:"Recuperar senhas",denuncias:"Denúncias","verificacao-telefone":"Verificar telefones","revisao-conta":"Revisões de bloqueio",geral:"Visão geral" };
export function useMasterNotifications(active, accountId) {
 const [data,setData]=useState({items:[],unread:0,unreadByCategory:{}});
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const sequence=useRef(0);
 const refresh=useCallback(async()=>{
   if(!active)return;
   const version=++sequence.current;
   try {
     const next=await api("/master/notifications",{headers:{"X-FreteOn-Role":"master"}});
     if(version!==sequence.current)return;
     setData(next);setError("");
   }catch(e){if(version===sequence.current)setError(e.message||"Falha ao consultar notificações");}
   finally{if(version===sequence.current)setLoading(false);}
 },[active,accountId]);
 useEffect(()=>{
   setData({items:[],unread:0,unreadByCategory:{}});setError("");setLoading(active);
   if(!active)return;
   refresh();
   const visible=()=>{if(!document.hidden)refresh();};
   const pushed=event=>{if(event.data?.type==="FRETEON_PUSH_EVENT"&&(!event.data.role||event.data.role==="master"))refresh();};
   const interval=setInterval(visible,12000);
   document.addEventListener("visibilitychange",visible);
   window.addEventListener("focus",visible);window.addEventListener("online",visible);
   navigator.serviceWorker?.addEventListener("message",pushed);
   return()=>{++sequence.current;clearInterval(interval);
     document.removeEventListener("visibilitychange",visible);
     window.removeEventListener("focus",visible);window.removeEventListener("online",visible);
     navigator.serviceWorker?.removeEventListener("message",pushed);
   };
 },[refresh]);
 async function markRead(id){
   ++sequence.current;
   try{await api(`/master/notifications/${id}/read`,{method:"POST",body:{},headers:{"X-FreteOn-Role":"master"}});await refresh();return true;}
   catch(e){setError(e.message);return false;}
 }
 async function markAll(){
   const before=data.items.map(item=>item.id).sort().at(-1);
   if(!before)return;
   ++sequence.current;
   try{await api("/master/notifications/read-all",{method:"POST",body:{before},headers:{"X-FreteOn-Role":"master"}});await refresh();}
   catch(e){setError(e.message);}
 }
 return {...data,error,loading,refresh,markRead,markAll};
}
export default function MasterNotifications({notifications,onNavigate,accountId}) {
 const {items,error,refresh,markRead,markAll,unread,loading}=notifications;
 const [category,setCategory]=useState("todas");
 const filtered=category==="todas"?items:items.filter(item=>item.category===category);
 return <section className="panel"><h2>Central de notificações Master</h2><p>Os avisos ficam registrados aqui mesmo quando o celular não recebe push.</p>
 <div className="master-notification-actions"><button type="button" className="secondary" onClick={refresh}><RefreshCw size={17}/> Atualizar</button><button type="button" className="secondary" disabled={!unread} onClick={markAll}><CheckCheck size={17}/> Marcar todas como lidas ({unread})</button></div>
 <p className="muted">Exibindo os 100 avisos mais recentes. Os contadores incluem todos os avisos não lidos.</p>
 <label>Filtrar avisos<select value={category} onChange={e=>setCategory(e.target.value)}><option value="todas">Todas as categorias</option>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
 {error&&<p className="error" role="alert">{error}</p>}
 {loading?<p role="status">Carregando avisos...</p>:filtered.length===0?<p>Nenhum aviso registrado nesta categoria.</p>:filtered.map(item=><button type="button" className={"notification-row"+(!item.read?" master-unread":"")} key={item.id} onClick={async()=>{if(await markRead(item.id))onNavigate(item.category==="revisao-conta" ? "usuarios" : item.category==="verificacao-telefone" || item.title==="Verificação de celular solicitada" ? "verificacao-telefone" : item.category==="geral"?"inicio":item.category);}}><BellRing size={20}/><span><strong>{item.title}</strong><small>{item.body}</small><small>{labels[item.category]||"Geral"} · {new Date(item.createdAt).toLocaleString("pt-BR")}</small></span>{!item.read&&<span className="master-notification-dot" aria-label="Não lida"/>}</button>)}
 <details className="profile-push-settings"><summary><BellRing size={18}/> Configurar push neste aparelho</summary><PushNotificationsPanel role="master" accountId={accountId}/></details>
 </section>;
}
