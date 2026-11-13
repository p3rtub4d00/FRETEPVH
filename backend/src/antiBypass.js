/** Regras antidesvio aplicadas no servidor a propostas e chat. */
export const PROPOSAL_OPTIONS = Object.freeze({
  helper: "Ajudante incluso",
  blanket: "Proteção com mantas",
  disassembly: "Desmontagem e montagem",
  stairs: "Retirada/entrega em escadas",
  loading: "Carregamento e descarregamento",
  tieDown: "Amarração e fixação da carga",
});

export function validProposalOptions(value) {
  if (!Array.isArray(value) || value.length > 6 ||
      value.some((key) => typeof key !== "string" || !(key in PROPOSAL_OPTIONS)) ||
      new Set(value).size !== value.length) {
    throw Object.assign(new Error("Selecione apenas os serviços disponíveis na lista."), { status: 400 });
  }
  return value;
}

export function proposalDescription(options) {
  return validProposalOptions(options).map((option) => PROPOSAL_OPTIONS[option]).join(" · ") ||
    "Transporte conforme descrição do pedido";
}

export function hasExternalContact(text) {
  const source = String(text || "").normalize("NFKC");
  const digits = source.replace(/\D/g, "");
  const phone = /(?:\+?55[\s().-]*)?(?:\(?\d{2}\)?[\s().-]*)?9?\d{4}[\s().-]*\d{4}/.test(source);
  const links = /(?:https?:\/\/|www\.|(?:wa\.me|api\.whatsapp\.com|t\.me|bit\.ly|linktr\.ee)\b|\b[a-z0-9-]+\.(?:com|com\.br|net|org|br|io|app)\b)/i.test(source);
  const handles = /(?:@\s*[a-z][a-z\d._-]{2,}|\b(?:whats?app|zap|telegram|instagram|insta|direct|telefone|celular|me\s+liga|me\s+chama|me\s+manda\s+msg|contato)\b)/i.test(source);
  const bypass = /(?:\b(?:por\s+fora|sem\s+(?:taxa|comiss[aã]o)|cancela(?:r)?\s+(?:o\s+)?(?:frete|pedido|chamado)|mais\s+barato\s+(?:fora|direto))\b)/i.test(source);
  return phone || links || handles || bypass ||
    // Números puros de telefone escritos sem separadores.
    /(?:^|\D)(?:55)?[1-9]\d{10}(?:\D|$)/.test(digits);
}

export function safeChatMessage(value) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 500)
    throw Object.assign(new Error("Escreva uma mensagem de até 500 caracteres."), { status: 400 });
  const message = value.trim();
  if (hasExternalContact(message))
    throw Object.assign(new Error("Por segurança, não compartilhe contatos, links nem propostas de negociação fora do FreteOn."), { status: 400 });
  return message;
}

export function canChat(request, userId, role) {
  if (!request || !["booked", "transit", "completed"].includes(request.status)) return false;
  return role === "cliente" && request.clientId === userId ||
    role === "motorista" && request.driverId === userId;
}
