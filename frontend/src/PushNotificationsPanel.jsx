import { useEffect, useRef, useState } from "react";
import { BellRing, BellOff, CheckCircle2, CircleAlert, Smartphone, TestTube2 } from "lucide-react";
import { api } from "./api.js";
import { recoverPush } from "./pushRecovery.js";
import { shouldOfferPush } from "./pushInvitationRules.js";

const storageKey = (role, accountId) =>
  `freteon:push-invite-dismissed:v1:${role}:${accountId}`;
function readDismissedAt(role, accountId) {
  try {
    const value = Number(localStorage.getItem(storageKey(role, accountId)));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch { return 0; }
}


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

export default function PushNotificationsPanel({
  role,
  accountId = "",
  autoInvite = false,
  canDisplay = true,
}) {
  const dialogRef = useRef(null);
  const [dismissedAt, setDismissedAt] = useState(() => readDismissedAt(role, accountId));
  const [attemptedPermission, setAttemptedPermission] = useState(false);
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

  function dismissInvitation() {
    const now = Date.now();
    setDismissedAt(now);
    try { localStorage.setItem(storageKey(role, accountId), String(now)); }
    catch { /* Navegador sem armazenamento: o app continua funcionando */ }
  }

  useEffect(() => {
    const sync = (event) => {
      const data = event.detail;
      if (data?.role !== role || data?.accountId !== accountId) return;
      if (data.enabled) {
        setActive(true);
      } else {
        setActive(false);
        setDismissedAt(readDismissedAt(role, accountId));
      }
    };
    window.addEventListener("freteon:push-setting", sync);
    return () => window.removeEventListener("freteon:push-setting", sync);
  }, [role, accountId]);

  function broadcast(enabled) {
    window.dispatchEvent(new CustomEvent("freteon:push-setting", {
      detail: { role, accountId, enabled },
    }));
  }

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
          if (live) {
            const currentPermission = Notification.permission;
            setPermission(currentPermission);
            const restored = settings.enabled && await recoverPush({
              subscription, publicKey: settings.publicKey,
              permission: currentPermission, endpointHashes: status.endpointHashes || [],
              digest: async endpoint => {
                const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
                return Array.from(new Uint8Array(digest)).map(v => v.toString(16).padStart(2, "0")).join("");
              },
              save: subscription => {
                if (!live) throw new Error("Verificação cancelada.");
                return api("/push/subscribe", {
                method: "POST", headers: { "X-FreteOn-Role": role }, body: { subscription },
                });
              },
            });
            if (live) {
              setActive(Boolean(restored));
              if (restored) setCount(Math.max(1, status.deviceCount || 0));
            }
          }
        }
      } catch (e) {
        if (live) setError(e.message || "Não foi possível verificar as notificações.");
      } finally {
        if (live) setLoaded(true);
      }
    })();
    return () => { live = false; };
  }, [role, accountId, supported]);

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
        setAttemptedPermission(true);
        // A chamada nativa acontece diretamente após o clique do usuário.
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
      broadcast(true);
      setNotice("Avisos ativados neste dispositivo. Você receberá atualizações de fretes e mensagens do chat.");
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
      dismissInvitation();
      broadcast(false);
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
      await api("/push/test", { method: "POST", body: { subscription: (await (await navigator.serviceWorker.ready).pushManager.getSubscription())?.toJSON() } });
      setNotice("O serviço push aceitou a notificação de teste. Confira se ela apareceu no celular. Se não apareceu, revise as permissões do aparelho.");
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
  const offer = shouldOfferPush({
    role,
    canDisplay,
    loaded,
    serverEnabled: config.enabled,
    supported: supported && (!isIos || standalone),
    permission: attemptedPermission ? "default" : permission,
    active,
    dismissedAt,
    now: Date.now(),
  });

  useEffect(() => {
    if (!autoInvite || !offer || !dialogRef.current) return;
    const element = dialogRef.current;
    // Preserve first-priority dialogs such as the install invitation and
    // the customer's delivery confirmation. Open after they are closed.
    const tryOpen = () => {
      if (!element.isConnected || element.open) return;
      const blocker = Array.from(document.querySelectorAll("dialog[open]"))
        .some((dialog) => dialog !== element);
      if (!blocker) {
        try { element.showModal(); } catch { /* another dialog took priority */ }
      }
    };
    tryOpen();
    const observer = new MutationObserver(tryOpen);
    observer.observe(document.body, {
      subtree: true, childList: true, attributes: true, attributeFilter: ["open"],
    });
    return () => {
      observer.disconnect();
      if (element.open) element.close();
    };
  }, [autoInvite, offer]);

  if (autoInvite) {
    if (!offer) return null;
    return (
      <dialog ref={dialogRef} className="push-invite-dialog"
        aria-labelledby="push-invite-title"
        onCancel={(event) => {
          event.preventDefault();
          if (!busy) dismissInvitation();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget && !busy) dismissInvitation();
        }}>
        <div className="push-invite-body">
          <div className="push-invite-icon"><BellRing size={32}/></div>
          <span className="push-invite-eyebrow">FRETEON · AVISOS IMPORTANTES</span>
          <h2 id="push-invite-title">Ative as notificações</h2>
          <p>
            {role === "motorista"
              ? "Receba avisos de novos fretes e saiba quando sua proposta for aceita, mesmo fora do painel."
              : "Saiba quando chegar uma proposta, um motorista for contratado ou seu frete for concluído."}
          </p>
          <div className="push-invite-benefits">
            <span><CheckCircle2 size={17}/> Você escolhe se deseja autorizar.</span>
            <span><CheckCircle2 size={17}/> Controle os avisos pelo seu perfil.</span>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          {busy && <p className="muted" role="status">Configurando notificações...</p>}
          <button className="primary push-invite-primary" type="button"
            disabled={busy || permission === "denied"}
            onClick={enable}>
            <BellRing size={19}/> {busy ? "Ativando..." : permission === "denied"
              ? "Permissão bloqueada" : "Ativar notificações"}
          </button>
          {permission === "denied" && (
            <p className="push-warning">
              O navegador bloqueou os avisos. Você pode liberá-los nas configurações do aparelho.
            </p>
          )}
          <button className="push-invite-later" type="button"
            disabled={busy} onClick={dismissInvitation}>Agora não, continuar</button>
          <small>Não é obrigatório. Sua conta funciona normalmente sem notificações.</small>
        </div>
      </dialog>
    );
  }
  return (
    <section className="push-panel">
      <div className="push-panel-heading">
        <div className="push-panel-symbol"><BellRing size={22} /></div>
        <div>
          <h2>Notificações push</h2>
          <p>
            {role === "motorista"
              ? "Saiba quando surgirem fretes e quando um cliente escolher sua proposta."
              : "Receba avisos de propostas, etapas da entrega e mensagens do chat."}
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
      <p className="push-help">Os avisos dependem das permissões do aparelho, do sistema operacional e da conexão.
        Você pode desativá-los quando desejar. Sair da conta revoga suas assinaturas de notificação.</p>
    </section>
  );
}
