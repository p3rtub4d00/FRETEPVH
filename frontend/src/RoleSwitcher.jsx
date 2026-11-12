import { ShieldCheck, Truck, UserRound } from "lucide-react";

const choices = [
  { role: "cliente", label: "Cliente", Icon: UserRound },
  { role: "motorista", label: "Motorista", Icon: Truck },
  { role: "master", label: "Master", Icon: ShieldCheck },
];

export default function RoleSwitcher({ activeRole, sessions, onSwitch }) {
  return (
    <nav className="role-switcher" aria-label="Alternar contas para testes">
      <span className="role-switcher-title">Testar como:</span>
      <div className="role-switcher-buttons">
        {choices.map(({ role, label, Icon }) => {
          const connected = Boolean(sessions[role]);
          return (
            <button
              type="button"
              key={role}
              className={activeRole === role ? "active" : ""}
              aria-current={activeRole === role ? "page" : undefined}
              title={connected ? `${label}: conta conectada` : `${label}: entrar uma vez para ativar`}
              onClick={() => onSwitch(role)}
            >
              <Icon size={15} aria-hidden="true" />
              <span>{label}</span>
              <span
                className={connected ? "role-status connected" : "role-status"}
                aria-label={connected ? "Conta conectada" : "Login necessário"}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
