import { useEffect, useState } from "react";
import { BellRing, BellOff, CheckCircle2, CircleAlert, Smartphone, TestTube2 } from "lucide-react";
import { api } from "./api.js";

function decodeBase64Url(input) {
  const normalized = String(input).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function isPushCapable() {
  return Boolean(window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window);
}

export default function PushNotificationsPanel({ role, compact = false }) {
  const [config, setConfig] = useState({ enabled: false, publicKey: null });
  const [supported] = useState(isPushCapable);
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );
  const [active, setActive] = useState(false);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [settings, status] = await Promise.all([
          api("/push/config"),
          api("/push/status"),
        ]);
        if (!live) return;
        setConfig(settings);
        setCount(status.deviceCount || 0);
        if (supported) {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          if (live && subscription) {
            // Uma única inscrição de navegador pode ser transferida entre
            // Cliente e Motorista. Compare o endpoint da conta atual.
            const digest = await crypto.subtle.digest(
              "SHA-256", new TextEncoder().encode(subscription.endpoint),
            );
            const hex = Array.from(new Uint8Array(digest))
              .map((v) => v.toString(16).padStart(2, "0")).join("");
            setActive(Boolean(status.endpointHashes?.includes(hex)));
          } else if (live) setActive(false);
        }
      } catch (e) {
        if (live) setError(e.message || "Não foi possível verificar as notificações.");
      } finally {
        if (live) setLoaded(true);
      }
    })();
    return () => { live = false; };
  }, [role, supported]);

  async function enable() {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!supported) throw new Error("Este navegador ainda não oferece notificações Web Push.");
      if (!config.enabled || !config.publicKey)
        throw new Error("As chaves push não estão configuradas no servidor.");
      if (Notification.permission === "denied")
        throw new Error("Permissão bloqueada. Libere as notificações nas configurações do navegador.");
      // Permissão solicitada SOMENTE após o usuário tocar em Ativar.
      if (Notification.permission === "default") {
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result !== "granted")
          throw new Error("Permissão não concedida. Você pode ativar os avisos depois.");
      }
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (subscription?.options?.applicationServerKey) {
        const current = new Uint8Array(subscription.options.applicationServerKey);
        const expected = decodeBase64Url(config.publicKey);
        if (current.length !== expected.length || current.some((v, i) => v !== expected[i])) {
          await subscription.unsubscribe();
          subscription = null;
        }
      }
      if (!subscription) subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeBase64Url(config.publicKey),
      });
      await api("/push/subscribe", {
        method: "POST",
        body: { subscription: subscription.toJSON() },
      });
      setActive(true);
      setCount((value) => Math.max(1, value));
      setNotice("Avisos ativados neste dispositivo. Use Testar notificação para conferir.");
    } catch (e) {
      setError(e.message || "Não foi possível ativar os avisos.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await api("/push/unsubscribe", {
          method: "POST",
          body: { subscription: subscription.toJSON() },
        });
        await subscription.unsubscribe();
      }
      setActive(false);
      setCount((value) => Math.max(0, value - 1));
      setNotice("Avisos desativados neste dispositivo.");
    } catch (e) {
      setError(e.message || "Não foi possível desativar as notificações.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/push/test", { method: "POST", body: {} });
      setNotice("Notificação de teste enviada ao serviço push. Confira o aviso no celular.");
    } catch (e) {
      setError(e.message || "Não foi possível testar o envio.");
    } finally {
      setBusy(false);
    }
  }

  const isIos = /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone ||
    window.matchMedia?.("(display-mode: standalone)").matches;
  return (
    <section className={`push-panel${compact ? " compact" : ""}`}>
      <div className="push-panel-heading">
        <div className="push-panel-symbol"><BellRing size={22} /></div>
        <div>
          <h2>{compact ? "Não perca os avisos do FreteOn" : "Notificações push"}</h2>
          <p>
            {role === "motorista"
              ? "Saiba quando surgirem fretes e quando um cliente escolher sua proposta."
              : "Receba avisos sobre propostas, confirmação do frete e conclusão da entrega."}
          </p>
        </div>
      </div>
      {!loaded && <p className="muted">Verificando notificações...</p>}
      {loaded && !config.enabled && (
        <p className="push-warning"><CircleAlert size={16}/> A configuração push do servidor ainda não está ativa.</p>
      )}
      {loaded && config.enabled && !supported && (
        <p className="push-warning"><Smartphone size={16}/> Este navegador não suporta notificações push.
          {isIos && " No iPhone, adicione o FreteOn à Tela de Início e abra pelo ícone."}
        </p>
      )}
      {loaded && supported && config.enabled && permission === "denied" && (
        <p className="push-warning">Notificações bloqueadas neste navegador. Abra as configurações do aparelho e libere os avisos do FreteOn.</p>
      )}
      {loaded && supported && config.enabled && isIos && !standalone && (
        <p className="push-warning">No iPhone, instale o FreteOn na Tela de Início e abra pelo ícone para usar notificações.</p>
      )}
      {loaded && supported && config.enabled && (
        <div className="push-panel-status">
          {active ? <CheckCircle2 size={17}/> : <BellOff size={17}/>}
          <strong>{active ? "Ativado neste aparelho" : "Ainda não ativado neste aparelho"}</strong>
          {count > 0 && <span>· {count} dispositivo(s) cadastrado(s)</span>}
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="photo-success" role="status">{notice}</p>}
      {loaded && config.enabled && supported && (
        <div className="push-panel-actions">
          {active ? (
            <>
              <button className="secondary" type="button" onClick={test} disabled={busy}>
                <TestTube2 size={17}/> Testar notificação
              </button>
              <button className="secondary" type="button" onClick={disable} disabled={busy}>
                <BellOff size={17}/> Desativar neste aparelho
              </button>
            </>
          ) : (
            <button className="primary" type="button" onClick={enable}
              disabled={busy || permission === "denied"}>
              <BellRing size={18}/> {busy ? "Ativando..." : "Ativar notificações"}
            </button>
          )}
        </div>
      )}
      {!compact && (
        <p className="push-help">Os avisos dependem das permissões do aparelho, do sistema operacional e da conexão.
          Você pode desativá-los quando desejar. Sair da conta revoga suas assinaturas de notificação.</p>
      )}
    </section>
  );
}
