import { Router } from "express";
import mongoose from "mongoose";
import { fail } from "./auth.js";

const schema = new mongoose.Schema({
  question: { type: String, required: true, maxlength: 180 },
  answer: { type: String, required: true, maxlength: 2500 },
  category: { type: String, required: true, maxlength: 70 },
  audience: { type: String, enum: ["cliente", "motorista", "ambos"], default: "ambos" },
  active: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  helpful: { type: Number, default: 0 },
  unhelpful: { type: Number, default: 0 },
}, { timestamps: true });
const Article = mongoose.models.HelpArticle || mongoose.model("HelpArticle", schema);
export const helpRouter = Router();
const seed = [
["Como solicitar um frete?","Na área do cliente, informe retirada, destino, descrição e fotos da carga. Publique e aguarde propostas dos motoristas.","Pedidos","cliente"],
["Como escolher um motorista?","Compare as propostas recebidas e confira os detalhes antes de confirmar. O valor apresentado é o preço total da proposta.","Pedidos","cliente"],
["Posso cancelar um pedido?","Consulte o pedido em Meus fretes. Se já houver pagamento, verifique a opção de cancelamento ou reembolso disponível no próprio pedido.","Pedidos","cliente"],
["Como acompanhar meu frete?","Abra Meus fretes e selecione o pedido para conferir o andamento e as atualizações.","Pedidos","cliente"],
["O motorista pediu para negociar fora do aplicativo. O que faço?","Mantenha a contratação e a comunicação pelo FreteOn. Não envie pagamentos externos; registre uma denúncia no pedido se necessário.","Segurança","cliente"],
["Como pagar por Pix?","Ao confirmar a contratação, siga as instruções de pagamento exibidas no pedido. A liberação depende da confirmação do pagamento pelo sistema.","Pagamentos","cliente"],
["Meu Pix foi pago, mas não foi confirmado. E agora?","Confira o status no pedido e aguarde a confirmação bancária. Não faça outro pagamento sem verificar. Se persistir, procure o suporte com o identificador do frete.","Pagamentos","cliente"],
["Como pedir reembolso?","Abra o frete correspondente e consulte as opções de cancelamento ou reembolso. A análise depende do estágio do serviço e das regras aplicáveis.","Pagamentos","cliente"],
["Como recuperar minha senha?","Na tela de acesso, solicite recuperação de senha. A equipe gera um link de recuperação e envia pelo WhatsApp cadastrado.","Conta","ambos"],
["Como alterar meus dados?","Abra Meu perfil e utilize a edição dos dados disponíveis. Algumas informações podem exigir nova verificação.","Conta","ambos"],
["Como funciona a avaliação?","Após a conclusão do frete, o cliente poderá registrar sua avaliação pelo aplicativo.","Fretes","ambos"],
["Como entrar em contato com o suporte?","Se as respostas não resolverem, utilize a área de denúncias ou ajuda do frete, quando disponível. Nunca compartilhe senhas ou códigos.","Suporte","ambos"],
["Como recebo solicitações de frete?","Os chamados disponíveis aparecem em Pedidos. Analise origem, destino, carga e detalhes antes de enviar uma proposta.","Pedidos","motorista"],
["Como enviar uma proposta?","Abra um chamado disponível, consulte os detalhes e informe o valor que deseja cobrar.","Propostas","motorista"],
["Quando posso iniciar o transporte?","Aguarde a contratação e, quando aplicável, a confirmação do pagamento. O botão para iniciar é liberado conforme o status do pedido.","Fretes","motorista"],
["Por que não aparecem pedidos?","Pode não haver solicitações abertas no momento. Confira se seu cadastro e sua documentação estão aprovados.","Pedidos","motorista"],
["Como enviar CNH e documentos?","Acesse Meu perfil, abra Documentos e verificação e envie os arquivos solicitados. A aprovação é feita pela equipe.","Cadastro","motorista"],
["Como consultar minhas propostas?","Abra Propostas para acompanhar as ofertas enviadas e a situação de cada uma.","Propostas","motorista"],
["Onde vejo minha carteira?","Acesse Minha carteira para consultar os lançamentos e valores associados aos fretes.","Pagamentos","motorista"],
["Como funciona a comissão do FreteOn?","A plataforma cobra comissão sobre os fretes conforme a taxa vigente apresentada ao motorista. Consulte os valores na carteira antes de pagar.","Pagamentos","motorista"],
["Como pagar uma comissão pendente?","Abra Minha carteira e siga as instruções da cobrança. Aguarde a confirmação bancária antes de tentar novamente.","Pagamentos","motorista"],
["Quando recebo o repasse?","Consulte Minha carteira e o status do frete. Os repasses podem exigir solicitação e processamento manual pela equipe.","Pagamentos","motorista"],
["O cliente quer negociar pelo WhatsApp. Posso aceitar?","Não desvie contratações para fora da plataforma. Isso pode violar as regras de uso e resultar em medidas na conta.","Segurança","motorista"],
["Como atualizar a validade da CNH?","Em Meu perfil, abra Documentos e verificação e atualize os dados e documentos solicitados.","Cadastro","motorista"],
["Como denunciar um problema com um frete?","Abra o frete e utilize a opção de denúncia ou contestação disponível. Descreva o ocorrido de forma objetiva.","Suporte","ambos"],
["O que fazer se o endereço estiver incorreto?","Confirme os dados do pedido antes de iniciar. Se houver divergência, registre o problema no próprio frete para análise.","Fretes","ambos"],
["O aplicativo precisa ser instalado?","Não. Você pode acessar o FreteOn pelo navegador do celular. A instalação como aplicativo é opcional.","Conta","ambos"],
["Como ativar notificações?","Abra Meu perfil e procure Notificações do aparelho. Autorize as notificações nas configurações do navegador, quando disponível.","Conta","ambos"],
["O que é o Grupo Rubli?","O FreteOn é uma plataforma do Grupo Rubli, voltada à intermediação de fretes entre clientes e motoristas parceiros.","Sobre","ambos"],
["Onde encontro os Termos de Uso e a Privacidade?","Na Central de Ajuda, consulte os links de Termos de Uso e Política de Privacidade.","Sobre","ambos"]
];
let seeding;
async function ensureSeed() {
  if (!seeding) seeding = (async () => {
    if (await Article.countDocuments() === 0) {
      for (let i = 0; i < seed.length; i++) {
        const [question,answer,category,audience] = seed[i];
        await Article.updateOne({ question }, { $setOnInsert: {question,answer,category,audience,order:i} }, {upsert:true});
      }
    }
  })().catch(e => {seeding=null; throw e;});
  return seeding;
}
helpRouter.get("/help/articles", async (req,res,next)=>{try{
  await ensureSeed();
  const master = req.user.role === "master";
  const audience = req.user.role === "motorista" ? "motorista" : "cliente";
  const query = master ? {} : { active:true, audience:{$in:["ambos",audience]} };
  res.json({ articles: await Article.find(query).sort({order:1,createdAt:1}).lean() });
}catch(e){next(e)}});
function masterOnly(req) { if(req.user.role!=="master") fail(403,"Apenas o Master pode gerenciar as respostas."); }
function fields(body) {
 const question=String(body.question||"").trim(),answer=String(body.answer||"").trim(),category=String(body.category||"").trim();
 if(!question||question.length>180||!answer||answer.length>2500||!category||category.length>70)fail(400,"Preencha pergunta, resposta e categoria dentro dos limites.");
 if(!["ambos","cliente","motorista"].includes(body.audience))fail(400,"Público inválido.");
 return {question,answer,category,audience:body.audience,active:body.active!==false,order:Number.isFinite(Number(body.order))?Number(body.order):0};
}
helpRouter.post("/help/articles",async(req,res,next)=>{try{masterOnly(req);await ensureSeed();res.status(201).json({article:await Article.create(fields(req.body))});}catch(e){next(e)}});
helpRouter.put("/help/articles/:id",async(req,res,next)=>{try{masterOnly(req);if(!mongoose.isValidObjectId(req.params.id))fail(400,"ID inválido.");const article=await Article.findByIdAndUpdate(req.params.id,fields(req.body),{new:true,runValidators:true});if(!article)fail(404,"Pergunta não encontrada.");res.json({article});}catch(e){next(e)}});
helpRouter.delete("/help/articles/:id",async(req,res,next)=>{try{masterOnly(req);if(!mongoose.isValidObjectId(req.params.id))fail(400,"ID inválido.");await Article.findByIdAndDelete(req.params.id);res.json({ok:true});}catch(e){next(e)}});
helpRouter.post("/help/articles/:id/feedback",async(req,res,next)=>{try{if(!mongoose.isValidObjectId(req.params.id))fail(400,"ID inválido.");const field=req.body.helpful===true?"helpful":req.body.helpful===false?"unhelpful":null;if(!field)fail(400,"Avaliação inválida.");await Article.updateOne({_id:req.params.id,active:true},{$inc:{[field]:1}});res.json({ok:true});}catch(e){next(e)}});
