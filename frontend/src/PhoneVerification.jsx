import {useEffect,useState} from "react";
import {api} from "./api.js";
export function PhoneVerificationPanel({onVerified}){
 const [status,setStatus]=useState(null),[code,setCode]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 async function load(){try{setStatus(await api("/phone-verification/status"));}catch(e){setError(e.message);}}
 useEffect(()=>{load();},[]);
 async function act(path,body={}){setBusy(true);setError("");setMessage("");try{const r=await api("/phone-verification/"+path,{method:"POST",body});setMessage(r.message);await load();if(r.verified)onVerified?.();}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <div className="phone-verify-panel"><h3>Verificação do celular</h3>
 {status?.verified?<p className="phone-verify-success">✓ Celular verificado</p>:<>
 <p>Confirme o número {status?.phone||"cadastrado"} para solicitar fretes ou enviar propostas. O Master enviará um código pelo WhatsApp.</p>
 <button type="button" className="secondary" disabled={busy} onClick={()=>act("request")}>{busy?"Aguarde...":status?.status==="pending"?"Solicitação enviada · Solicitar novamente":"Solicitar código pelo WhatsApp"}</button>
 {status?.status==="issued"&&<p>Um código foi gerado pelo Master. Confira seu WhatsApp.</p>}
 <form onSubmit={e=>{e.preventDefault();act("confirm",{code});}} className="phone-verify-form">
 <label>Código de 6 dígitos<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))} placeholder="000000"/></label>
 <button type="submit" className="primary" disabled={busy||code.length!==6}>Confirmar telefone</button>
 </form></>}
 {message&&<p role="status" className="info">{message}</p>}{error&&<p role="alert" className="error">{error}</p>}
 </div>;
}
export function PhoneVerificationMaster(){
 const [items,setItems]=useState([]),[issued,setIssued]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function load(){try{const r=await api("/master/phone-verifications");setItems(r.items||[]);}catch(e){setError(e.message);}}
 useEffect(()=>{load();const id=setInterval(load,20000);return()=>clearInterval(id);},[]);
 async function act(item,action){setBusy(true);setError("");setIssued(null);try{const r=await api("/master/phone-verifications/"+item.id+"/"+action,{method:"POST",body:{}});if(action==="issue")setIssued(r);await load();}catch(e){setError(e.message);}finally{setBusy(false);}}
 const msg=issued?`Olá, ${issued.name}! Seu código de verificação do celular no FreteOn é *${issued.code}*. Válido por 10 minutos. Digite o código no seu perfil do FreteOn. Não compartilhe com terceiros.`:"";
 return <section className="panel"><h2>Verificações de telefone</h2><p>Gere códigos e envie manualmente pelo WhatsApp ao número cadastrado. Apenas o Master Principal pode autorizar.</p>
 <button type="button" className="secondary" onClick={load}>Atualizar</button>{error&&<p role="alert" className="error">{error}</p>}
 {issued&&<div className="info"><strong>Código gerado para {issued.name}</strong><p><strong>{issued.code}</strong> · expira em {new Date(issued.expiresAt).toLocaleTimeString("pt-BR")}</p><a className="secondary" target="_blank" rel="noopener noreferrer" href={`https://wa.me/55${issued.phone}?text=${encodeURIComponent(msg)}`}>Enviar pelo WhatsApp</a>{" "}<button className="secondary" onClick={()=>navigator.clipboard.writeText(msg)}>Copiar mensagem</button><p>O código não poderá ser consultado novamente após fechar esta tela.</p></div>}
 {items.length===0?<p>Nenhuma solicitação registrada.</p>:items.map(item=><div className="person-row" key={item.id}><div style={{flex:1,minWidth:150}}><strong>{item.name}</strong><p>{item.role==="cliente"?"Cliente":"Motorista"} · {item.phone}</p><small>{new Date(item.createdAt).toLocaleString("pt-BR")} · {{pending:"Aguardando",issued:"Código gerado",verified:"Verificado",cancelled:"Cancelado",expired:"Expirado"}[item.status]||item.status}</small></div>
 {["pending","issued"].includes(item.status)&&<><button type="button" className="primary" disabled={busy} onClick={()=>act(item,"issue")}>Gerar código</button><button type="button" className="secondary" disabled={busy} onClick={()=>act(item,"cancel")}>Cancelar</button></>}</div>)}
 </section>;
}
