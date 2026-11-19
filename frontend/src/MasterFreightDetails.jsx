import { useEffect, useState } from "react";
import { ArrowRight, MessageSquare, ShieldCheck, RefreshCw, History, MapPin } from "lucide-react";
import { api } from "./api.js";
import { money, statusLabels } from "./format.js";
import { mapsRouteUrl } from "./addressFormat.js";
import { FreightPhotoImage } from "./FreightPhotoPicker.jsx";
const methods = {pix_freteon:"Pix pelo FreteOn",card_driver:"Cartão na maquininha",cash_driver:"Dinheiro ao motorista"};
const dateTime = val => {
  if (!val) return "—";
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleString("pt-BR", {dateStyle:"short",timeStyle:"short"});
};
function Address({heading,place,details}){
  return <div className="master-freight-address"><strong>{heading}</strong><span>{place}</span>
    {details?.complement&&<small>Complemento: {details.complement}</small>}
    {details?.reference&&<small>Referência: {details.reference}</small>}
  </div>;
}
export default function MasterFreightDetails({request,users=[],drivers=[],canViewChat,canViewContacts,canViewFinance}){
  const [messages,setMessages]=useState([]),[hasMore,setHasMore]=useState(false),[before,setBefore]=useState(null);
  const [loading,setLoading]=useState(false),[olderBusy,setOlderBusy]=useState(false),[error,setError]=useState("");
  const [refresh,setRefresh]=useState(0);
  const person=id=>[...users,...drivers].find(x=>x.id===id);
  const client=person(request.clientId),driver=person(request.driverId);
  useEffect(()=>{
    if(!canViewChat)return;
    let active=true;setLoading(true);setError("");setMessages([]);
    api("/master/freights/"+request.id+"/chat").then(data=>{
      if(active){setMessages(data.messages||[]);setHasMore(Boolean(data.hasMore));setBefore(data.nextBefore||null)}
    }).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[request.id,canViewChat,refresh]);
  async function more(){
    if(!before||olderBusy)return;
    setOlderBusy(true);setError("");
    try{
      const d=await api("/master/freights/"+request.id+"/chat?before="+encodeURIComponent(before));
      setMessages(current=>[...(d.messages||[]),...current]);setHasMore(Boolean(d.hasMore));setBefore(d.nextBefore||null);
    }catch(e){setError(e.message)}finally{setOlderBusy(false)}
  }
  return <section className="master-freight-detail">
    <div className="master-freight-heading"><span className={"status "+request.status}>{statusLabels[request.status]||request.status}</span><small>Frete: {request.id}</small></div>
    <div className="master-freight-info-grid">
      <div><small>Cliente</small><strong>{client?.name||"Cliente do pedido"}</strong>{canViewContacts&&client?.phone&&<span>{client.phone}</span>}</div>
      <div><small>Motorista contratado</small><strong>{request.driverId?(driver?.name||"Motorista selecionado"):"Ainda não contratado"}</strong>{canViewContacts&&driver?.phone&&<span>{driver.phone}</span>}</div>
      <div><small>Solicitação criada</small><strong>{dateTime(request.createdAt)}</strong></div>
      <div><small>Última alteração</small><strong>{dateTime(request.updatedAt)}</strong></div>
    </div>
    <h3>Retirada e entrega</h3>
    <Address heading="Retirada" place={request.origin} details={request.originAddress}/>
    <Address heading="Entrega" place={request.destination} details={request.destinationAddress}/>
    <a className="master-freight-map" href={mapsRouteUrl(request.origin,request.destination)} target="_blank" rel="noopener noreferrer"><MapPin size={16}/> Abrir rota no Google Maps <ArrowRight size={15}/></a>
    <h3>Informações da carga</h3>
    <p className="master-freight-description">{request.description||"Sem descrição."}</p>
    <div className="master-freight-info-grid">
      <div><small>Data e hora</small><strong>{request.date||"—"} · {request.time||"—"}</strong></div>
      <div><small>Ajudante</small><strong>{request.helper?"Solicitado":"Não solicitado"}</strong></div>
      <div><small>Veículo</small><strong>{request.vehicle||"A combinar"}</strong></div>
      <div><small>Pagamento</small><strong>{methods[request.paymentMethod]||"Não informado"}</strong></div>
      <div><small>Estado do pagamento</small><strong>{request.paymentStatus||"—"}</strong></div>
      <div><small>Entrega confirmada</small><strong>{request.deliveryConfirmedAt?dateTime(request.deliveryConfirmedAt):"Pendente ou não aplicável"}</strong></div>
    </div>
    {canViewFinance&&request.agreedPriceCents!=null&&<div className="master-freight-financial">
      <h3>Resumo financeiro</h3><div className="master-freight-info-grid">
        <div><small>Frete contratado</small><strong>{money(request.agreedPriceCents/100)}</strong></div>
        <div><small>Comissão</small><strong>{Number.isFinite(request.commissionCents)?money(request.commissionCents/100):"—"}</strong></div>
        <div><small>Situação da comissão</small><strong>{request.commissionStatus||"—"}</strong></div>
        <div><small>Repasse ao motorista</small><strong>{request.payoutStatus||"—"}</strong></div>
      </div></div>}
    <h3>Fotos da carga ({request.photos?.length||0})</h3>
    {request.photos?.length?<div className="master-freight-photos">{request.photos.map((src,i)=><FreightPhotoImage key={i} src={src} alt={`Foto ${i+1} da carga`}/>)}</div>:<p className="muted">Nenhuma foto enviada.</p>}
    <h3>Propostas recebidas ({request.proposals?.length||0})</h3>
    {request.proposals?.length?request.proposals.map(item=><article className="master-freight-proposal" key={item.id}>
      <div><strong>{person(item.driverId)?.name||"Motorista"}</strong>{item.id===request.selectedId&&<span className="master-freight-chosen">Selecionado</span>}</div>
      <strong>{money(item.price)}</strong><small>Retirada: {item.time||"A combinar"}</small>
      {item.note&&<p>{item.note}</p>}
    </article>):<p className="muted">Nenhuma proposta enviada.</p>}
    {request.disputeStatus&&request.disputeStatus!=="none"&&<p className="info">Contestação: {request.disputeStatus}. O Master deve avaliar as evidências.</p>}
    <section className="master-freight-chat">
      <div className="master-freight-chat-heading"><h3><MessageSquare size={19}/> Histórico do chat</h3>
        {canViewChat&&<button className="secondary" type="button" disabled={loading} onClick={()=>setRefresh(v=>v+1)}><RefreshCw size={15}/> Atualizar</button>}
      </div>
      <p className="master-freight-chat-notice"><ShieldCheck size={17}/> Consulta para segurança e suporte, com acesso registrado na auditoria. O Master não pode editar ou enviar mensagens.</p>
      {!canViewChat?<p className="muted">Sua conta administrativa não possui permissão para consultar conversas.</p>:<>
        {loading&&<p role="status" className="muted">Carregando mensagens...</p>}
        {error&&<p role="alert" className="error">{error}</p>}
        {!loading&&hasMore&&<button type="button" className="secondary master-freight-older" disabled={olderBusy} onClick={more}>{olderBusy?"Carregando...":"Carregar mensagens anteriores"}</button>}
        {!loading&&!messages.length&&!error&&<p className="muted">Nenhuma conversa registrada. O chat é liberado após a contratação.</p>}
        {!!messages.length&&<div className="master-freight-chat-list" role="log" aria-label="Mensagens do frete">
          {messages.map(item=><div key={item.id} className={"master-freight-chat-item "+item.authorRole}>
            <div><strong>{item.authorRole==="cliente"?(client?.name||"Cliente"):(person(item.authorId)?.name||"Motorista")}</strong><small>{dateTime(item.createdAt)}</small></div>
            <p>{item.content}</p>
          </div>)}
        </div>}
      </>}
      <small className="muted"><History size={14}/> Mensagens barradas pelas regras automáticas não aparecem aqui. Qualquer suspeita exige análise humana.</small>
    </section>
  </section>;
}
