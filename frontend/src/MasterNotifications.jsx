import { useEffect, useState } from "react";
import { BellRing, CheckCheck, RefreshCw } from "lucide-react";
import { api } from "./api.js";
import PushNotificationsPanel from "./PushNotificationsPanel.jsx";

const labels = { motoristas:"Motoristas",fretes:"Fretes",financeiro:"Financeiro",recuperacao:"Recuperar senhas",denuncias:"Denúncias",geral:"Visão geral" };
export function useMasterNotifications(active) {
 const [items,setItems]=useState([]);const [error,setError]=useState("");
 async function refresh(){if(!active)return;try{const data=await api("/master/notifications");setItems(data.items||[]);setError("");}catch(e){setError(e.message||"Falha ao consultar notificações");}}
 useEffect(()=>{if(!active)return;refresh();const interval=setInterval(refresh,12000);const visible=()=>{if(!document.hidden)refresh();};document.addEventListener("visibilitychange",visible);return()=>{clearInterval(interval);document.removeEventListener("visibilitychange",visible);};},[active]);
 async function markRead(id){try{await api(`/master/notifications/${id}/read`,{method:"POST",body:{}});setItems(old=>old.map(item=>item.id===id?{...item,read:true}:item));}catch(e){setError(e.message);}}
 async function markAll(){try{await api("/master/notifications/read-all",{method:"POST",body:{}});setItems(old=>old.map(item=>({...item,read:true})));}catch(e){setError(e.message);}}
 return {items,error,refresh,markRead,markAll,unread:items.filter(item=>!item.read).length};
}
export default function MasterNotifications({notifications,onNavigate,accountId}) {
 const {items,error,refresh,markRead,markAll,unread}=notifications;
 const [category,setCategory]=useState("todas");
 const filtered=category==="todas"?items:items.filter(item=>item.category===category);
 return <section className="panel"><h2>Central de notificações Master</h2><p>Os avisos ficam registrados aqui mesmo quando o celular não recebe push.</p>
 <div className="master-notification-actions"><button type="button" className="secondary" onClick={refresh}><RefreshCw size={17}/> Atualizar</button><button type="button" className="secondary" disabled={!unread} onClick={markAll}><CheckCheck size={17}/> Marcar todas como lidas ({unread})</button></div>
 <label>Filtrar avisos<select value={category} onChange={e=>setCategory(e.target.value)}><option value="todas">Todas as categorias</option>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
 {error&&<p className="error" role="alert">{error}</p>}
 {filtered.length===0?<p>Nenhum aviso registrado nesta categoria.</p>:filtered.map(item=><button type="button" className={"notification-row"+(!item.read?" master-unread":"")} key={item.id} onClick={async()=>{await markRead(item.id);onNavigate(item.category==="geral"?"inicio":item.category);}}><BellRing size={20}/><span><strong>{item.title}</strong><small>{item.body}</small><small>{labels[item.category]||"Geral"} · {new Date(item.createdAt).toLocaleString("pt-BR")}</small></span>{!item.read&&<span className="master-notification-dot" aria-label="Não lida"/>}</button>)}
 <details className="profile-push-settings"><summary><BellRing size={18}/> Configurar push neste aparelho</summary><PushNotificationsPanel role="master" accountId={accountId}/></details>
 </section>;
}
