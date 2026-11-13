import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Download, Share2, Smartphone, X } from "lucide-react";
import {
  isMobileForInstall,
  shouldShowInstallInvite,
} from "./installInvitationRules.js";

const STORAGE_KEY = "freteon:install-invitation-dismissed-v1";

function readDismissedAt() {
  try {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  } catch {
    return 0;
  }
}

function installedStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches === true ||
    navigator.standalone === true ||
    window.matchMedia?.("(display-mode: fullscreen)").matches === true;
}

function isAppleMobile() {
  const agent = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(agent) ||
    (/Macintosh/i.test(agent) && navigator.maxTouchPoints > 1);
}

/**
 * Convite opcional para usuários do celular. Nunca bloqueia cadastro ou login:
 * "Continuar pelo navegador" fecha por sete dias. O app não se instala sem
 * consentimento explícito do usuário e não exibe o convite no Master.
 */
export default function InstallInvitation({
  pathname,
  installEvent,
  onConsumeInstall,
  installed,
}) {
  const dialog = useRef(null);
  const [dismissedAt, setDismissedAt] = useState(readDismissedAt);
  const [instructions, setInstructions] = useState(false);
  const [prompting, setPrompting] = useState(false);
  const ios = isAppleMobile();
  const mobile = isMobileForInstall(navigator.userAgent, navigator.maxTouchPoints);
  const standalone = installedStandalone();
  const role = pathname.split("/")[1];

  const visible = shouldShowInstallInvite({
    pathname,
    mobile,
    standalone,
    installed,
    dismissedAt,
    now: Date.now(),
  });

  useEffect(() => {
    if (!visible || !dialog.current) return;
    const element = dialog.current;
    if (!element.open) element.showModal();
    return () => {
      if (element.open) element.close();
    };
  }, [visible]);

  function dismiss() {
    const now = Date.now();
    setDismissedAt(now);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(now));
    } catch {
      // O usuário ainda pode continuar mesmo com armazenamento desativado.
    }
  }

  async function install() {
    if (ios || !installEvent) {
      setInstructions(true);
      return;
    }
    setPrompting(true);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      onConsumeInstall?.();
      if (choice?.outcome === "accepted") {
        // O evento appinstalled também fecha o convite após a instalação.
        dismiss();
      } else {
        setInstructions(true);
      }
    } catch {
      setInstructions(true);
    } finally {
      setPrompting(false);
    }
  }

  if (!visible) return null;

  return (
    <dialog
      ref={dialog}
      className="install-invite-dialog"
      aria-labelledby="install-invite-title"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div className="install-invite-content">
        <button type="button" className="install-invite-close"
          aria-label="Continuar pelo navegador" onClick={dismiss}>
          <X size={20} />
        </button>
        <img src="/assets/icon-192.png" className="install-invite-logo"
          alt="Ícone do aplicativo FreteOn" />
        <span className="install-invite-eyebrow">FRETEON NO CELULAR</span>
        <h2 id="install-invite-title">
          {instructions ? "Como instalar o FreteOn" : "Tenha o FreteOn na tela inicial"}
        </h2>
        <p className="install-invite-description">
          {role === "motorista"
            ? "Acompanhe novos fretes e propostas aceitas com acesso rápido ao seu painel."
            : "Solicite fretes, compare propostas e acompanhe suas entregas pelo celular."}
        </p>

        {!instructions ? (
          <>
            <div className="install-invite-benefits">
              <span><CheckCircle2 size={17} /> Abra direto pelo ícone do aplicativo</span>
              <span><CheckCircle2 size={17} /> Acesso rápido à sua conta e seus fretes</span>
              <span><CheckCircle2 size={17} /> Não precisa procurar o link novamente</span>
            </div>
            <button className="primary install-invite-primary"
              type="button" disabled={prompting} onClick={install}>
              {ios ? <Share2 size={19} /> : <Download size={19} />}
              {prompting ? "Abrindo instalação..." :
                ios ? "Ver como instalar no iPhone" : "Instalar aplicativo"}
              <ArrowRight size={17} />
            </button>
            <button type="button" className="install-invite-secondary"
              onClick={dismiss}>
              Continuar pelo navegador
            </button>
          </>
        ) : (
          <>
            <div className="install-invite-instructions">
              <Smartphone size={23} />
              {ios ? (
                <ol>
                  <li>Abra este site no <strong>Safari</strong> do iPhone.</li>
                  <li>Toque em <strong>Compartilhar</strong> (quadrado com seta).</li>
                  <li>Selecione <strong>Adicionar à Tela de Início</strong> e confirme.</li>
                </ol>
              ) : (
                <ol>
                  <li>Abra o FreteOn no <strong>Chrome</strong> do Android.</li>
                  <li>Toque no menu <strong>⋮</strong> do navegador.</li>
                  <li>Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>, se disponível.</li>
                </ol>
              )}
            </div>
            <button className="primary install-invite-primary"
              type="button" onClick={dismiss}>
              Entendi, continuar no FreteOn <ArrowRight size={17} />
            </button>
          </>
        )}
        <small className="install-invite-footnote">
          Instalar é opcional. Você pode usar o FreteOn normalmente no navegador.
        </small>
      </div>
    </dialog>
  );
}
