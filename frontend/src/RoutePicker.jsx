import { useEffect, useState } from "react";
import {
  Clock3,
  ExternalLink,
  LoaderCircle,
  MapPin,
  Navigation2,
  Route as RouteIcon,
} from "lucide-react";
import { api } from "./api.js";

function AddressField({ label, field, value, point, mapsEnabled, onChange, gps }) {
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [notice, setNotice] = useState("");
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!mapsEnabled || point || value.trim().length < 3) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      api("/maps/suggest?q=" + encodeURIComponent(value.trim()), {
        signal: controller.signal,
      })
        .then((result) => {
          if (!controller.signal.aborted) {
            setSuggestions(result.suggestions || []);
            setNotice("");
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setSuggestions([]);
            setNotice("Sugestões indisponíveis. Você pode digitar o endereço.");
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, point, mapsEnabled]);

  async function selectSuggestion(suggestion) {
    setSelecting(true);
    setNotice("");
    try {
      const result = await api(
        "/maps/place?id=" + encodeURIComponent(suggestion.placeId),
      );
      onChange(result.address, result.point);
      setSuggestions([]);
    } catch {
      setNotice("Não foi possível localizar este endereço. Tente outro.");
    } finally {
      setSelecting(false);
    }
  }

  function useGps() {
    if (!navigator.geolocation) {
      setNotice("Seu dispositivo não oferece localização por GPS.");
      return;
    }
    setLocating(true);
    setNotice("");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const query =
            "/maps/reverse?lat=" +
            encodeURIComponent(coords.latitude) +
            "&lng=" +
            encodeURIComponent(coords.longitude);
          const result = await api(query);
          onChange(result.address, result.point);
          setSuggestions([]);
        } catch {
          setNotice("Não foi possível encontrar seu endereço. Digite-o manualmente.");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setNotice("Permita o acesso à localização ou digite o endereço.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }

  return (
    <div className="address-picker">
      <label htmlFor={field}>{label}</label>
      <div className="address-input-wrap">
        <MapPin size={19} className={gps ? "pickup-pin" : "dropoff-pin"} />
        <input
          id={field}
          name={field}
          value={value}
          onChange={(event) => {
            setNotice("");
            setSuggestions([]);
            onChange(event.target.value, null);
          }}
          required
          minLength={5}
          maxLength={180}
          autoComplete="off"
          placeholder={gps ? "Rua, número ou local de retirada" : "Rua, número ou local de entrega"}
          aria-autocomplete={mapsEnabled ? "list" : undefined}
          aria-expanded={mapsEnabled ? suggestions.length > 0 : undefined}
          aria-controls={field + "-suggestions"}
        />
        {(searching || selecting) && (
          <LoaderCircle size={17} className="picker-spinner" aria-label="Buscando endereço" />
        )}
      </div>
      {mapsEnabled && suggestions.length > 0 && (
        <div id={field + "-suggestions"} className="address-suggestions" role="listbox">
          {suggestions.map((suggestion) => (
            <button
              type="button"
              role="option"
              aria-selected={false}
              disabled={selecting}
              key={suggestion.placeId}
              onClick={() => selectSuggestion(suggestion)}
            >
              <MapPin size={16} />
              <span>{suggestion.label}</span>
            </button>
          ))}
        </div>
      )}
      {gps && (
        <button
          type="button"
          className="gps-action"
          disabled={!mapsEnabled || locating}
          onClick={useGps}
        >
          {locating ? <LoaderCircle size={16} className="picker-spinner" /> : <Navigation2 size={16} />}
          {locating ? "Localizando..." : "Usar minha localização"}
        </button>
      )}
      {point && mapsEnabled && (
        <span className="picker-confirmed">Endereço localizado no mapa</span>
      )}
      {notice && <p className="picker-notice" role="status">{notice}</p>}
    </div>
  );
}

export default function RoutePicker({ data, onChange }) {
  const [mapsEnabled, setMapsEnabled] = useState(null);
  const [estimate, setEstimate] = useState(data.routeEstimate || null);
  const [calculating, setCalculating] = useState(false);
  const [routeError, setRouteError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api("/maps/config")
      .then((result) => {
        if (!cancelled) setMapsEnabled(Boolean(result.enabled));
      })
      .catch(() => {
        if (!cancelled) setMapsEnabled(false);
      });
    return () => { cancelled = true; };
  }, []);

  const originPoint = data.originPoint;
  const destinationPoint = data.destinationPoint;
  const fromLat = originPoint?.latitude;
  const fromLng = originPoint?.longitude;
  const toLat = destinationPoint?.latitude;
  const toLng = destinationPoint?.longitude;

  useEffect(() => {
    if (
      !mapsEnabled ||
      fromLat === undefined || fromLng === undefined ||
      toLat === undefined || toLng === undefined
    ) {
      setEstimate(null);
      setCalculating(false);
      setRouteError("");
      return;
    }
    let cancelled = false;
    setEstimate(null);
    setCalculating(true);
    setRouteError("");
    api("/maps/route", {
      method: "POST",
      body: {
        origin: { latitude: fromLat, longitude: fromLng },
        destination: { latitude: toLat, longitude: toLng },
      },
    })
      .then((route) => {
        if (cancelled) return;
        setEstimate(route);
        onChange({ routeEstimate: route });
      })
      .catch(() => {
        if (cancelled) return;
        setRouteError("Não foi possível calcular a rota neste momento.");
        onChange({ routeEstimate: null });
      })
      .finally(() => {
        if (!cancelled) setCalculating(false);
      });
    return () => { cancelled = true; };
  }, [mapsEnabled, fromLat, fromLng, toLat, toLng]);

  function updateField(field, text, point) {
    setEstimate(null);
    setRouteError("");
    onChange({
      [field]: text,
      [field + "Point"]: point,
      routeEstimate: null,
    });
  }

  const mapsUrl =
    "https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=" +
    encodeURIComponent(data.origin) +
    "&destination=" +
    encodeURIComponent(data.destination);
  const km = estimate
    ? (estimate.distanceMeters / 1000).toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    : null;

  return (
    <div className="route-picker">
      <p className="muted route-intro">
        Informe de onde a carga sairá e o endereço de entrega.
      </p>
      <AddressField
        label="Endereço de retirada"
        field="origin"
        value={data.origin}
        point={data.originPoint}
        mapsEnabled={mapsEnabled}
        gps
        onChange={(text, point) => updateField("origin", text, point)}
      />
      <AddressField
        label="Endereço de entrega"
        field="destination"
        value={data.destination}
        point={data.destinationPoint}
        mapsEnabled={mapsEnabled}
        onChange={(text, point) => updateField("destination", text, point)}
      />
      <section className="route-estimate" aria-live="polite">
        <div className="route-estimate-head">
          <strong>Resumo do trajeto</strong>
          <RouteIcon size={20} />
        </div>
        <div className="route-estimate-values">
          <div>
            <span>Distância por ruas</span>
            <strong>{km === null ? "— km" : km + " km"}</strong>
          </div>
          <div>
            <span>Tempo aproximado</span>
            <strong>{estimate ? estimate.durationMinutes + " min" : "— min"}</strong>
          </div>
        </div>
        {calculating ? (
          <p className="route-estimate-hint"><LoaderCircle size={15} className="picker-spinner" /> Calculando melhor trajeto...</p>
        ) : routeError ? (
          <p className="route-estimate-hint">{routeError} Você pode continuar normalmente.</p>
        ) : estimate ? (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="route-map-link">
            <MapPin size={15} /> Visualizar trajeto no Google Maps <ExternalLink size={14} />
          </a>
        ) : (
          <p className="route-estimate-hint">
            {mapsEnabled
              ? "Selecione os endereços sugeridos para calcular km e duração."
              : "A estimativa estará disponível após configurar a integração de mapas."}
          </p>
        )}
      </section>
      {mapsEnabled === false && (
        <p className="route-map-info" role="status">
          Os campos continuam funcionando manualmente. O cálculo automático
          aguarda a configuração do serviço de mapas no servidor.
        </p>
      )}
      {estimate && (
        <p className="route-map-info">
          Estimativa de carro, sujeita a mudanças conforme condições da via.
          O preço será definido pelas propostas dos motoristas.
        </p>
      )}
    </div>
  );
}
