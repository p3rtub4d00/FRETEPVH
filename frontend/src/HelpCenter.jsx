import { useEffect, useMemo, useState } from "react";
import { Search, ChevronDown, CircleHelp, Plus, Pencil, Trash2 } from "lucide-react";
import { api } from "./api.js";

const empty = {question:"",answer:"",category:"Geral",audience:"ambos",active:true,order:0};
const normalize = value => String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export default function HelpCenter({ role, onClose, onSupport }) {
 const [articles,setArticles]=useState([]),[query,setQuery]=useState(""),[category,setCategory]=useState("Todos"),[open,setOpen]=useState(null),[editing,setEditing]=useState(null),[form,setForm]=useState(empty),[error,setError]=useState(""),[busy,setBusy]=useState(false),[rated,setRated]=useState({});
 const master=role==="master";
 async function load(){try{const r=await api("/help/articles");setArticles(r.articles||[]);setError("");}catch(e){setError(e.message||"Não foi possível carregar as perguntas.");}}
 useEffect(()=>{load();},[]);
 const categories=useMemo(()=>["Todos",...new Set(articles.filter(a=>master||a.active).map(a=>a.category))], [articles,master]);
 const filtered=useMemo(()=>articles.filter(a=>(category==="Todos"||a.category===category)&&(!query||normalize([a.question,a.answer,a.category].join(" ")).includes(normalize(query)))),[articles,category,query]);
 async function save(e){e.preventDefault();setBusy(true);try{await api(editing?"/help/articles/"+editing:"/help/articles",{method:editing?"PUT":"POST",body:form});setEditing(null);setForm(empty);await load();}catch(err){setError(err.message||"Erro ao salvar.");}finally{setBusy(false);}}
 async function remove(a){if(!window.confirm("Excluir esta pergunta?"))return;try{await api("/help/articles/"+a._id,{method:"DELETE"});await load();}catch(err){setError(err.message||"Erro ao excluir.");}}
 async function vote(a,helpful){if(rated[a._id])return;setRated(v=>({...v,[a._id]:true}));try{await api("/help/articles/"+a._id+"/feedback",{method:"POST",body:{helpful}});}catch{setRated(v=>({...v,[a._id]:false}));}}
 return <div className="help-center">
   <div className="help-center-heading"><CircleHelp size={23}/><div><h2>Central de Ajuda</h2><p>Encontre respostas sem precisar esperar atendimento.</p></div></div>
   <label className="help-search"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pesquise: Pix, cadastro, frete..." aria-label="Pesquisar dúvidas"/></label>
   <div className="help-categories">{categories.map(c=><button key={c} type="button" className={category===c?"selected":""} onClick={()=>setCategory(c)}>{c}</button>)}</div>
   {error&&<p role="alert" className="info">{error}</p>}
   {master&&<button type="button" className="secondary" onClick={()=>{setEditing("new");setForm(empty);}}> <Plus size={16}/> Nova pergunta</button>}
   {master&&editing&&<form className="help-editor" onSubmit={save}>
     <h3>{editing==="new"?"Nova pergunta":"Editar pergunta"}</h3>
     <label>Pergunta<input required maxLength={180} value={form.question} onChange={e=>setForm({...form,question:e.target.value})}/></label>
     <label>Resposta<textarea required maxLength={2500} rows={5} value={form.answer} onChange={e=>setForm({...form,answer:e.target.value})}/></label>
     <label>Categoria<input required maxLength={70} value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></label>
     <label>Público<select value={form.audience} onChange={e=>setForm({...form,audience:e.target.value})}><option value="ambos">Todos</option><option value="cliente">Clientes</option><option value="motorista">Motoristas</option></select></label>
     <label>Ordem<input type="number" value={form.order} onChange={e=>setForm({...form,order:Number(e.target.value)})}/></label>
     <label><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/> Publicada</label>
     <div className="help-editor-actions"><button type="submit" className="primary" disabled={busy}>Salvar</button><button type="button" className="secondary" onClick={()=>setEditing(null)}>Cancelar</button></div>
   </form>}
   <div className="help-results">{filtered.length===0?<p>Nenhuma resposta encontrada. Tente outra palavra.</p>:filtered.map(a=><article key={a._id} className="help-article">
     <button type="button" className="help-question" aria-expanded={open===a._id} onClick={()=>setOpen(open===a._id?null:a._id)}><span>{a.question}{master&&!a.active&&<small> · Oculta</small>}</span><ChevronDown size={18}/></button>
     {open===a._id&&<div className="help-answer"><p>{a.answer}</p>{master?<div className="help-editor-actions"><button type="button" onClick={()=>{setEditing(a._id);setForm({question:a.question,answer:a.answer,category:a.category,audience:a.audience,active:a.active,order:a.order});}}><Pencil size={15}/> Editar</button><button type="button" onClick={()=>remove(a)}><Trash2 size={15}/> Excluir</button><small>Útil: {a.helpful||0} · Não útil: {a.unhelpful||0}</small></div>:<div className="help-feedback"><span>{rated[a._id]?"Obrigado pela avaliação!":"Isso resolveu sua dúvida?"}</span>{!rated[a._id]&&<><button type="button" onClick={()=>vote(a,true)}>Sim</button><button type="button" onClick={()=>vote(a,false)}>Não</button></>}</div>}</div>}
   </article>)}</div>
   <section className="help-about-rubli"><h3>Sobre o FreteOn</h3><p>O FreteOn é uma plataforma do <strong>Grupo Rubli</strong>, que intermedeia fretes entre clientes e motoristas parceiros.</p><div className="help-about-links"><a href="/termos" target="_blank" rel="noopener noreferrer">Termos de Uso</a><a href="/privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</a></div></section>
   {!master&&<p className="help-contact">Não encontrou o que precisa? Utilize a opção de denúncia ou contestação no frete relacionado para solicitar análise da equipe.</p>}
   {onClose&&<button type="button" className="secondary" onClick={onClose}>Voltar ao perfil</button>}
 </div>;
}
