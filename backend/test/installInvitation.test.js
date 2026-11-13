import test from "node:test";
import assert from "node:assert/strict";
import {
  INSTALL_REMINDER_MS,
  isInstallEligiblePath,
  isMobileForInstall,
  shouldShowInstallInvite,
} from "../../frontend/src/installInvitationRules.js";

test("convida apenas Cliente e Motorista, nunca Master ou página inicial", () => {
  assert.equal(isInstallEligiblePath("/cliente"), true);
  assert.equal(isInstallEligiblePath("/cliente/cadastro"), true);
  assert.equal(isInstallEligiblePath("/motorista"), true);
  assert.equal(isInstallEligiblePath("/motorista/cadastro"), true);
  assert.equal(isInstallEligiblePath("/master"), false);
  assert.equal(isInstallEligiblePath("/"), false);
  assert.equal(isInstallEligiblePath("/motorista-qualquer"), false);
});

test("reconhece Android e iPhone e não exige em computadores comuns", () => {
  assert.equal(isMobileForInstall("Mozilla/5.0 (Linux; Android 15) Mobile"), true);
  assert.equal(isMobileForInstall("Mozilla/5.0 (iPhone; CPU iPhone OS 18_2)"), true);
  assert.equal(isMobileForInstall("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), false);
  assert.equal(isMobileForInstall("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", 5), true);
});

test("respeita instalação, dispensa temporária e opção de navegador", () => {
  const now = Date.now();
  const active = {
    pathname: "/motorista",
    mobile: true,
    standalone: false,
    installed: false,
    dismissedAt: 0,
    now,
  };
  assert.equal(shouldShowInstallInvite(active), true);
  assert.equal(shouldShowInstallInvite({ ...active, standalone: true }), false);
  assert.equal(shouldShowInstallInvite({ ...active, installed: true }), false);
  assert.equal(shouldShowInstallInvite({ ...active, mobile: false }), false);
  assert.equal(shouldShowInstallInvite({ ...active, pathname: "/master" }), false);
  assert.equal(shouldShowInstallInvite({ ...active, dismissedAt: now - 1000 }), false);
  assert.equal(shouldShowInstallInvite({
    ...active, dismissedAt: now - INSTALL_REMINDER_MS - 1000,
  }), true);
});
