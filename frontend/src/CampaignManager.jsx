import { useEffect,useState } from "react";
import { Megaphone, Bell, RefreshCw, Send, CalendarClock, Trash2, RotateCw } from "lucide-react";
import { api } from "./api.js";
const audienceLabel={todos:"Todos os usuários",cliente:"Clientes",motorista:"Motoristas"};
export function CampaignViewer({role}) {
 const [item,setItem]=useState(null),[error,setError]=useState("");
 const close=()=>{setItem(null);const url=new URL(window.location.href);url.searchParams.delete("comunicado");window.history.replaceState(null,"",url.pathname+url.search+url.hash);};
 async function show(id){
  if(!/^[a-f0-9]{24}$/.test(String(id||"")))return;
  try{
   const data=await api("/campaigns/inbox");
   const found=(data.items||[]).find(x=>x.id===id);
   if(!found){setError("Comunicado indisponível ou expirado.");return;}
   setItem(found);setError("");
   if(!found.read)await api("/campaigns/"+id+"/read",{method:"POST",body:{}}).catch(()=>{});
  }catch(e){setError(e.message||"Não foi possível abrir o comunicado.");}
 }
 useEffect(()=>{
  const query=new URLSearchParams(window.location.search).get("comunicado");if(query)void show(query);
  const handler=e=>{if(e.data?.type==="FRETEON_PUSH_EVENT"&&e.data.campaignId)void show(e.data.campaignId);};
  navigator.serviceWorker?.addEventListener("message",handler);
  return()=>navigator.serviceWorker?.removeEventListener("message",handler);
 },[role]);
 useEffect(()=>{if(!item)return;const timer=setTimeout(close,15000);return()=>clearTimeout(timer);},[item?.id]);
 if(!item&&!error)return null;
 return <div className="campaign-viewer-overlay" role="dialog" aria-modal="true" aria-label="Comunicado FreteOn"><div className="campaign-viewer">
 <button type="button" className="campaign-viewer-close" onClick={close} aria-label="Fechar comunicado">×</button>
 {item?<><span className="campaign-viewer-brand">FreteOn · Comunicado</span>{item.imageUrl&&<img src={item.imageUrl} alt="Imagem do comunicado" className="campaign-viewer-image"/>}<h2>{item.title}</h2><p>{item.body}</p><small>Esta mensagem será fechada automaticamente.</small></>:<p>{error}</p>}
 <button type="button" className="secondary" onClick={close}>Voltar ao aplicativo</button>
 </div></div>;
}
export default function CampaignManager(){
 const [items,setItems]=useState([]),[enabled,setEnabled]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const [diagnostics,setDiagnostics]=useState(null);
 const [form,setForm]=useState({title:"",body:"",audience:"todos",scheduledAt:"",expiresAt:"",imageData:""});
 async function refresh(){try{const data=await api("/master/campaigns");setItems(data.items||[]);setEnabled(data.pushEnabled);setError("");}catch(e){setError(e.message);}}
 useEffect(()=>{refresh();api("/master/push/diagnostics").then(setDiagnostics).catch(()=>{});},[]);
 async function uploadImage(event){
 const file=event.target.files?.[0];if(!file)return;
 if(!["image/png","image/jpeg","image/webp"].includes(file.type)){setError("Escolha PNG, JPG ou WebP.");return;}
 if(file.size>350000){setError("Imagem acima de 350 KB. Comprima antes de enviar.");return;}
 const reader=new FileReader();reader.onload=()=>{setForm(v=>({...v,imageData:String(reader.result||"")}));setError("");};reader.onerror=()=>setError("Não foi possível ler a imagem.");reader.readAsDataURL(file);
 }
 async function submit(e){e.preventDefault();if(!window.confirm("Confirmar criação desta campanha para "+audienceLabel[form.audience]+"?"))return;setBusy(true);try{
  await api("/master/campaigns",{method:"POST",body:{...form,scheduledAt:form.scheduledAt?new Date(form.scheduledAt).toISOString():null,expiresAt:form.expiresAt?new Date(form.expiresAt).toISOString():null}});
  setNotice("Campanha registrada. O envio será processado pelo servidor na data programada.");setForm({title:"",body:"",audience:"todos",scheduledAt:"",expiresAt:""});await refresh();
 }catch(err){setError(err.message);}finally{setBusy(false);}}
 async function cancel(id){if(!window.confirm("Cancelar a campanha agendada?"))return;try{await api("/master/campaigns/"+id+"/cancel",{method:"POST",body:{}});await refresh();}catch(e){setError(e.message);}}
 async function resend(item){
  if(busy)return;
  if(!window.confirm("Reenviar \""+item.title+"\" para "+audienceLabel[item.audience]+"? Uma nova campanha será criada e enviada novamente, inclusive a quem já recebeu."))return;
  setBusy(true);setError("");setNotice("");
  try{
   await api("/master/campaigns/"+item.id+"/resend",{method:"POST",body:{}});
   setNotice("Reenvio solicitado. Uma nova campanha foi criada e será processada pelo servidor.");
   await refresh();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function remove(item){
  if(busy)return;
  if(!window.confirm("Excluir definitivamente \""+item.title+"\"? A campanha e sua imagem serão removidas do histórico e não poderão mais ser abertas pelos usuários."))return;
  setBusy(true);setError("");setNotice("");
  try{
   await api("/master/campaigns/"+item.id,{method:"DELETE"});
   setNotice("Campanha excluída.");
   await refresh();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <section className="panel campaign-manager"><h2><Megaphone size={23}/> Campanhas e comunicados</h2><p>Envie avisos aos clientes e motoristas. As mensagens também ficam disponíveis dentro do aplicativo.</p>
 {diagnostics&&<div className="campaign-push-diagnostics"><strong>Diagnóstico de notificações</strong><p>Servidor push: {diagnostics.configured?"Configurado":"Não configurado"} · Clientes: {diagnostics.users?.cliente||0} ({diagnostics.subscriptions?.cliente?.devices||0} dispositivos inscritos) · Motoristas: {diagnostics.users?.motorista||0} ({diagnostics.subscriptions?.motorista?.devices||0} dispositivos inscritos)</p><small>Inscrição não garante recebimento; teste em cada aparelho.</small></div>}
 {!enabled&&<p className="info">O Web Push não está configurado neste servidor. Os comunicados continuarão visíveis dentro do aplicativo, mas não chegarão como notificação externa.</p>}
 {error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status" className="info">{notice}</p>}
 <form className="campaign-form" onSubmit={submit}>
 <label>Destinatários<select value={form.audience} onChange={e=>setForm({...form,audience:e.target.value})}>{Object.entries(audienceLabel).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
 <label>Título<input required maxLength={90} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Black Friday FreteOn!"/></label>
 <label>Mensagem<textarea required rows={4} maxLength={180} value={form.body} onChange={e=>setForm({...form,body:e.target.value})} placeholder="Escreva seu comunicado..."/><small>{form.body.length}/180 caracteres</small></label>
 <label><CalendarClock size={16}/> Agendar envio (opcional)<input type="datetime-local" value={form.scheduledAt} onChange={e=>setForm({...form,scheduledAt:e.target.value})}/></label>
 <label>Validade do aviso (opcional)<input type="datetime-local" value={form.expiresAt} onChange={e=>setForm({...form,expiresAt:e.target.value})}/></label>
 <label>Imagem da campanha (PNG, JPG ou WebP, até 350 KB)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadImage}/></label>
 {form.imageData&&<button type="button" className="secondary" onClick={()=>setForm({...form,imageData:""})}>Remover imagem</button>}
 <div className="campaign-preview">{form.imageData&&<img className="campaign-preview-image" src={form.imageData} alt="Prévia da campanha"/>}<strong>{form.title||"Prévia do título"}</strong><p>{form.body||"Sua mensagem aparecerá aqui."}</p><small>FreteOn · {audienceLabel[form.audience]}</small></div>
 <button type="submit" disabled={busy}><Send size={17}/> {busy?"Salvando...":"Criar campanha"}</button>
 </form>
 <div className="campaign-history-head"><h3>Histórico de campanhas</h3><button type="button" className="secondary" onClick={refresh}><RefreshCw size={16}/> Atualizar</button></div>
 {items.length===0?<p>Nenhuma campanha cadastrada.</p>:items.map(item=><article className="campaign-notice" key={item.id}><strong>{item.title}</strong>{item.imageUrl&&<img className="campaign-preview-image" src={item.imageUrl} alt="Imagem da campanha"/>}<p>{item.body}</p><small>{audienceLabel[item.audience]} · {item.status==="sent"?"Enviada":item.status==="scheduled"?"Agendada":item.status==="sending"?"Processando":"Cancelada"} · {new Date(item.scheduledAt).toLocaleString("pt-BR")}</small>{item.status==="sent"&&<small>Contas selecionadas: {item.recipients} · Push tentados: {item.attempted} · Aceitos pelo serviço: {item.accepted} · Falhas: {item.failed}</small>}<div className="campaign-history-actions">
 {item.status!=="sending"&&<button type="button" className="secondary" disabled={busy} onClick={()=>resend(item)}><RotateCw size={16}/> Reenviar</button>}
 {item.status==="scheduled"&&<button type="button" className="secondary" disabled={busy} onClick={()=>cancel(item.id)}>Cancelar agendamento</button>}
 {item.status!=="sending"&&<button type="button" className="secondary campaign-delete" disabled={busy} onClick={()=>remove(item)}><Trash2 size={16}/> Excluir</button>}
 </div></article>)}
 <p className="campaign-disclaimer">Campanhas apenas comunicam ofertas. Não modificam automaticamente comissões ou preços. Aceitação pelo serviço push não garante visualização pelo destinatário.</p>
 </section>;
}
