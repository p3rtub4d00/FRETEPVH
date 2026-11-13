import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { PushSubscription } from "./models.js";
import { authorize, fail } from "./auth.js";
import { checkSubscription, pushEnabled, notifyAccounts } from "./webPush.js";

export const pushRouter = Router();
const roles = authorize("cliente", "motorista");
const limit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Muitas tentativas de configuração de notificações." },
});
const own = (req) => String(req.user._id);

pushRouter.get("/push/config", roles, (req, res) => {
  res.json({
    enabled: pushEnabled(),
    publicKey: pushEnabled() ? process.env.VAPID_PUBLIC_KEY : null,
    // Não afirmamos push fora do navegador: dependente de instalação e permissão.
    requiresPermission: true,
  });
});

pushRouter.get("/push/status", roles, async (req, res) => {
  const subscriptions = await PushSubscription.countDocuments({ userId: own(req) });
  res.json({ enabled: pushEnabled(), deviceCount: subscriptions });
});

pushRouter.post("/push/subscribe", roles, limit, async (req, res) => {
  if (!pushEnabled()) fail(503, "Notificações ainda não configuradas no servidor.");
  const data = checkSubscription(req.body?.subscription);
  const userId = own(req);
  const currentCount = await PushSubscription.countDocuments({ userId });
  const existing = await PushSubscription.findOne({ endpointHash: data.endpointHash });
  if (currentCount >= 5 && existing?.userId !== userId)
    fail(409, "Limite de cinco dispositivos por conta. Desative os avisos em outro aparelho.");
  // Um endpoint do navegador só pode pertencer à conta ativa: evita divulgar
  // propostas de um perfil a outro quando Cliente/Motorista alternam no PWA.
  await PushSubscription.findOneAndUpdate(
    { endpointHash: data.endpointHash },
    { $set: { ...data, userId, role: req.user.role } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  res.json({ ok: true, message: "Notificações ativadas neste dispositivo." });
});

pushRouter.post("/push/unsubscribe", roles, limit, async (req, res) => {
  const data = checkSubscription(req.body?.subscription);
  await PushSubscription.deleteOne({ userId: own(req), endpointHash: data.endpointHash });
  res.json({ ok: true });
});

pushRouter.post("/push/test", roles, limit, async (req, res) => {
  if (!pushEnabled()) fail(503, "Notificações ainda não configuradas.");
  const total = await PushSubscription.countDocuments({ userId: own(req) });
  if (total === 0) fail(409, "Ative as notificações neste dispositivo primeiro.");
  const result = await notifyAccounts([own(req)], {
    title: "Teste de notificação FreteOn",
    body: "Os avisos estão configurados. Você poderá receber atualizações dos fretes.",
    role: req.user.role,
    id: "test",
  });
  if (result.ok === 0)
    return res.status(502).json({ error: "Serviço push não confirmou a entrega. Verifique as permissões e tente novamente." });
  res.json({ ok: true, deliveredTo: result.ok });
});
