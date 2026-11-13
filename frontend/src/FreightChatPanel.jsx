import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, ShieldCheck, Flag } from "lucide-react";
import { api } from "./api.js";

export default function FreightChatPanel({ requestId, currentUserId, onReport }) {
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const active = useRef(true);

  async function load() {
    try {
      const result = await api(`/requests/${requestId}/chat`);
      if (active.current) setMessages(result.messages || []);
    } catch (e) {
      if (active.current) setError(e.message);
    }
  }

  useEffect(() => {
    active.current = true;
    load();
    const id = setInterval(() => {
      if (!document.hidden) load();
    }, 7000);
    return () => { active.current = false; clearInterval(id); };
  }, [requestId]);

  async function send(event) {
    event.preventDefault();
    if (sending || !content.trim()) return;
    setSending(true);
    setError("");
    setNotice("");
    try {
      await api(`/requests/${requestId}/chat`, { method: "POST", body: { content: content.trim() } });
      setContent("");
      await load();
      setNotice("Mensagem enviada.");
    } catch (e) {
      setError(e.message);
    } finally { setSending(false); }
  }

  return (
    <section className="freight-chat-panel">
      <div className="freight-chat-heading">
        <h3><MessageSquare size={19}/> Conversa do frete</h3>
        <button className="secondary" type="button" onClick={onReport}><Flag size={15}/> Denunciar</button>
      </div>
      <p className="freight-chat-safety"><ShieldCheck size={16}/>
        Conversa liberada após a contratação. Evite contatos, links e negociações fora do FreteOn. Mensagens podem ser analisadas em caso de denúncia, conforme nossa Política de Privacidade.
      </p>
      <div className="freight-chat-messages" role="log" aria-label="Histórico das mensagens">
        {messages.length ? messages.map((item) => (
          <div key={item.id} className={`freight-chat-bubble ${item.authorId === currentUserId ? "mine" : "theirs"}`}>
            <small>{item.authorId === currentUserId ? "Você" : item.authorRole === "cliente" ? "Cliente" : "Motorista"}</small>
            <p>{item.content}</p>
            <time>{new Date(item.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</time>
          </div>
        )) : <p className="muted">Nenhuma mensagem ainda. Use este espaço para combinar os detalhes do transporte.</p>}
      </div>
      <form onSubmit={send} className="freight-chat-form">
        <label htmlFor="freight-chat-text">Mensagem
          <textarea id="freight-chat-text" value={content} rows={2} maxLength={500}
            placeholder="Combine a retirada, orientações e detalhes da entrega"
            disabled={sending} onChange={e => setContent(e.target.value)} required/>
        </label>
        <button className="primary" type="submit" disabled={sending || !content.trim()}>
          <Send size={16}/> {sending ? "Enviando..." : "Enviar mensagem"}
        </button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="photo-success" role="status">{notice}</p>}
    </section>
  );
}
