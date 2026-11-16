import { MapPin, Navigation2, ExternalLink } from 'lucide-react';
import { emptyAddress, formatAddress, mapsRouteUrl } from './addressFormat.js';
const states = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
function AddressFields({ title, value, onChange, prefix }) {
  const update = (key, next) => onChange({ ...value, [key]: next });
  return <section className="manual-address" aria-label={title}>
    <h3><MapPin size={19}/> {title}</h3>
    <label>Rua ou avenida<input name={`${prefix}-street`} value={value.street} onChange={e=>update('street',e.target.value)} required minLength={3} maxLength={60} placeholder="Ex.: Avenida Sete de Setembro" autoComplete="off"/></label>
    <div className="manual-address-grid">
      <label>Número<input name={`${prefix}-number`} value={value.number} onChange={e=>update('number',e.target.value)} required={!value.noNumber} disabled={value.noNumber} maxLength={12} placeholder="Ex.: 123"/></label>
      <label>Bairro<input name={`${prefix}-neighborhood`} value={value.neighborhood} onChange={e=>update('neighborhood',e.target.value)} required minLength={2} maxLength={40} placeholder="Ex.: Centro"/></label>
    </div>
    <label className="checkbox"><input type="checkbox" checked={value.noNumber} onChange={e=>onChange({...value,noNumber:e.target.checked,number:e.target.checked?'':value.number})}/> Endereço sem número</label>
    <div className="manual-address-city">
      <label>Cidade<input name={`${prefix}-city`} value={value.city} onChange={e=>update('city',e.target.value)} required minLength={2} maxLength={40}/></label>
      <label>UF<select value={value.state} onChange={e=>update('state',e.target.value)}>{states.map(uf=><option key={uf}>{uf}</option>)}</select></label>
    </div>
    <label>Complemento <small>(opcional)</small><input value={value.complement} onChange={e=>update('complement',e.target.value)} maxLength={60} placeholder="Casa, apartamento, bloco ou portão"/></label>
    <label>Ponto de referência <small>(opcional)</small><input value={value.reference} onChange={e=>update('reference',e.target.value)} maxLength={120} placeholder="Ex.: ao lado da farmácia"/></label>
  </section>;
}
export default function RoutePicker({ data, onChange, mode = "both" }) {
  const origin = data.originAddress || emptyAddress();
  const destination = data.destinationAddress || emptyAddress();
  const update = (field, value) => onChange({
    [field + "Address"]: value,
    [field]: formatAddress(value),
    [field + "Point"]: null,
    routeEstimate: null
  });
  const ready = a => a.street.trim().length >= 3 && a.neighborhood.trim().length >= 2 &&
    a.city.trim().length >= 2 && (a.noNumber || a.number.trim());
  return <div className="manual-route-picker">
    <p className="muted">
      {mode === "origin"
        ? "Primeiro, informe onde o motorista deverá retirar a carga."
        : mode === "destination"
          ? "Agora informe para onde a carga será transportada."
          : "Informe os endereços completos. Número, complemento e referência ajudam o motorista a encontrar o local."}
    </p>
    {mode !== "destination" && (
      <AddressFields title="Onde retirar?" prefix="origin" value={origin}
        onChange={a => update("origin", a)}/>
    )}
    {mode === "destination" && ready(origin) && (
      <p className="request-route-origin-summary">
        <MapPin size={16}/> <span><strong>Retirada:</strong> {formatAddress(origin)}</span>
      </p>
    )}
    {mode !== "origin" && (
      <AddressFields title="Onde entregar?" prefix="destination" value={destination}
        onChange={a => update("destination", a)}/>
    )}
    {mode !== "origin" && ready(origin) && ready(destination) && (
      <a className="maps-route-button" href={mapsRouteUrl(formatAddress(origin),formatAddress(destination))}
        target="_blank" rel="noopener noreferrer">
        <Navigation2 size={19}/> Conferir rota no Google Maps <ExternalLink size={16}/>
      </a>
    )}
    {mode !== "origin" && (
      <p className="maps-route-help">A distância e o tempo estimado poderão ser consultados no Google Maps. Confira se os locais encontrados estão corretos.</p>
    )}
  </div>;
}
