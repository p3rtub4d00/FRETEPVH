import { MapPin, Navigation2, ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const googleKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
let mapsLoader;
function loadGooglePlaces() {
  if (!googleKey) return Promise.resolve(null);
  if (!mapsLoader) mapsLoader = new Promise((resolve, reject) => {
    const finish = () => {
      if (!window.google?.maps?.places?.AutocompleteSuggestion) {
        reject(new Error('Biblioteca Places indisponível. Verifique Maps JavaScript API e Places API (New).'));
      } else resolve(window.google.maps.places);
    };
    if (window.google?.maps?.places?.AutocompleteSuggestion) { finish(); return; }
    if (window.google?.maps?.importLibrary) {
      window.google.maps.importLibrary('places').then(finish, reject);
      return;
    }
    const callbackName = '__freteonGoogleMapsReady';
    const script = document.createElement('script');
    let completed = false;
    const timeout = setTimeout(() => {
      if (!completed) { completed = true; delete window[callbackName]; reject(new Error('Tempo esgotado ao carregar Google Maps.')); }
    }, 12000);
    window[callbackName] = () => {
      if (completed) return;
      completed = true;
      clearTimeout(timeout);
      delete window[callbackName];
      finish();
    };
    script.src = 'https://maps.googleapis.com/maps/api/js?key=' +
      encodeURIComponent(googleKey) + '&v=weekly&libraries=places&loading=async&callback=' + callbackName;
    script.async = true;
    script.onerror = () => {
      if (completed) return;
      completed = true;
      clearTimeout(timeout);
      delete window[callbackName];
      reject(new Error('Não foi possível carregar o script Google Maps.'));
    };
    document.head.appendChild(script);
  }).catch(error => { mapsLoader = null; throw error; });
  return mapsLoader;
}
function GoogleAddressSearch({ value, onSelect }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const sequence = useRef(0);
  useEffect(() => {
    const id = ++sequence.current;
    if (!googleKey || query.trim().length < 3) { setSuggestions([]); setMessage(''); return; }
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const { AutocompleteSuggestion } = await loadGooglePlaces();
        const result = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query.trim(),
          includedRegionCodes: ['br'],
          locationBias: { center: { lat: -8.7612, lng: -63.9004 }, radius: 20000 },
          region: 'br',
          language: 'pt-BR',
        });
        if (id !== sequence.current) return;
        setSuggestions((result.suggestions || []).filter(item => item.placePrediction).slice(0, 5));
        setMessage('');
      } catch (error) {
        console.error('[FreteOn Google Places] Falha ao buscar sugestões:', error);
        if (id === sequence.current) {
          setSuggestions([]);
          const details = String(error?.message || '');
          setMessage('Busca automática indisponível: ' + (details || 'erro desconhecido') + '. Você pode preencher manualmente.');
        }
      } finally { if (id === sequence.current) setLoading(false); }
    }, 450);
    return () => clearTimeout(timer);
  }, [query]);
  async function choose(item) {
    sequence.current++;
    setSuggestions([]);
    try {
      setLoading(true);
      const place = item.placePrediction.toPlace();
      await place.fetchFields({ fields: ['addressComponents', 'formattedAddress'] });
      const parts = place.addressComponents || [];
      const get = type => parts.find(part => part.types?.includes(type));
      const street = get('route')?.longText || '';
      const number = get('street_number')?.longText || '';
      // Distrito/localidade não é bairro. Nunca inferir bairro a partir de locality ou administrative_area_level_3.
      const neighborhood = get('neighborhood')?.longText || get('sublocality_level_1')?.longText || get('sublocality')?.longText || '';
      const district = get('administrative_area_level_3')?.longText || '';
      const locality = get('locality')?.longText || '';
      const city = get('administrative_area_level_2')?.longText || locality || value.city;
      const state = get('administrative_area_level_1')?.shortText || value.state;
      onSelect({ ...value, street: street || value.street, number: number || value.number,
        noNumber: number ? false : value.noNumber,
        // Limpar o bairro anterior: uma nova escolha não pode herdar o bairro de outro endereço.
        neighborhood: neighborhood && neighborhood.toLocaleLowerCase('pt-BR') !== district.toLocaleLowerCase('pt-BR') ? neighborhood : '',
        city, state: states.includes(state) ? state : value.state }, place.formattedAddress || item.placePrediction.text?.text || '');
      setQuery(place.formattedAddress || item.placePrediction.text?.text || '');
      setMessage(district
        ? 'Endereço selecionado. Localidade/distrito informado pelo Google: ' + district + '. Confirme o bairro e o número; distrito não é bairro.'
        : 'Endereço selecionado. Confira número e bairro antes de continuar.');
    } catch (error) { console.error('[FreteOn Google Places] Falha ao obter endereço:', error); setMessage('Não foi possível preencher automaticamente. Digite os dados abaixo.'); }
    finally { setLoading(false); }
  }
  if (!googleKey) return null;
  return <div className="google-address-search">
    <label>Buscar endereço no Google
      <input type="search" value={query} onChange={e => setQuery(e.target.value)}
        placeholder="Digite rua, número ou local" autoComplete="off" aria-label="Buscar endereço no Google" />
    </label>
    {loading && <small role="status">Buscando endereços…</small>}
    {suggestions.length > 0 && <div className="google-address-suggestions" role="listbox" aria-label="Sugestões de endereço">
      {suggestions.map((item, index) => <button type="button" role="option" aria-selected="false"
        key={item.placePrediction.placeId || index} onClick={() => choose(item)}>
        {item.placePrediction.text?.text || 'Selecionar endereço'}
      </button>)}
      <small>Dados de endereço fornecidos pelo Google</small>
    </div>}
    {message && <small role="status">{message}</small>}
  </div>;
}

import { emptyAddress, formatAddress, mapsRouteUrl } from './addressFormat.js';
const states = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
function AddressFields({ title, value, onChange, prefix }) {
  const [selectedAddress, setSelectedAddress] = useState('');
  const [manual, setManual] = useState(false);
  const update = (key, next) => onChange({ ...value, [key]: next });
  const selected = Boolean(selectedAddress) && !manual;
  return <section className="manual-address compact-address" aria-label={title}>
    <h3><MapPin size={19}/> {title}</h3>
    <GoogleAddressSearch value={value} onSelect={(address, label) => {
      onChange(address);
      setSelectedAddress(label);
      setManual(false);
    }}/>
    {selected && <div className="compact-address-selected" role="status">
      <strong>Endereço selecionado</strong>
      <span>{selectedAddress}</span>
      <button type="button" onClick={() => { setSelectedAddress(''); setManual(true); }}>Corrigir dados do endereço</button>
    </div>}
    {!selected && <label>Rua ou avenida<input name={`${prefix}-street`} value={value.street} onChange={e=>update('street',e.target.value)} required minLength={3} maxLength={60} placeholder="Ex.: Avenida Sete de Setembro" autoComplete="off"/></label>}
    <div className="manual-address-grid">
      <label>Número<input name={`${prefix}-number`} value={value.number} onChange={e=>update('number',e.target.value)} required={!value.noNumber} disabled={value.noNumber} maxLength={12} placeholder="Ex.: 123"/></label>
      <label>Bairro<input name={`${prefix}-neighborhood`} value={value.neighborhood} onChange={e=>update('neighborhood',e.target.value)} required minLength={2} maxLength={40} placeholder="Ex.: Centro"/></label>
    </div>
    <label className="checkbox"><input type="checkbox" checked={value.noNumber} onChange={e=>onChange({...value,noNumber:e.target.checked,number:e.target.checked?'':value.number})}/> Endereço sem número</label>
    {!selected && <div className="manual-address-city">
      <label>Cidade<input name={`${prefix}-city`} value={value.city} onChange={e=>update('city',e.target.value)} required minLength={2} maxLength={40}/></label>
      <label>UF<select value={value.state} onChange={e=>update('state',e.target.value)}>{states.map(uf=><option key={uf}>{uf}</option>)}</select></label>
    </div>}
    <details className="compact-address-extras">
      <summary>Complemento e ponto de referência (opcionais)</summary>
      <label>Complemento<input value={value.complement} onChange={e=>update('complement',e.target.value)} maxLength={60} placeholder="Casa, apartamento, bloco ou portão"/></label>
      <label>Ponto de referência<input value={value.reference} onChange={e=>update('reference',e.target.value)} maxLength={120} placeholder="Ex.: ao lado da farmácia"/></label>
    </details>
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
