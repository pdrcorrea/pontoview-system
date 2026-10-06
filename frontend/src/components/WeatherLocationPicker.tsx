import { Check, LoaderCircle, MapPin, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { invokeFunction } from "../lib/supabase";
import type { WeatherLocation } from "../types";
import "./WeatherLocationPicker.css";

type LocationOption = WeatherLocation & {
  label: string;
  state?: string | null;
  state_code?: string | null;
  country?: string | null;
  country_code?: string | null;
};

type LocationSearchResponse = {
  locations?: LocationOption[];
};

export function WeatherLocationPicker({
  value,
  onChange,
}: {
  value: WeatherLocation | null;
  onChange: (value: WeatherLocation | null) => void;
}) {
  const [query, setQuery] = useState(value?.name || "");
  const [options, setOptions] = useState<LocationOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const requestRef = useRef(0);
  const selectedCoordinates = typeof value?.latitude === "number"
    && Number.isFinite(value.latitude)
    && typeof value?.longitude === "number"
    && Number.isFinite(value.longitude);

  useEffect(() => {
    setQuery(value?.name || "");
  }, [value?.name]);

  const normalizedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    if (!open || normalizedQuery.length < 2 || (selectedCoordinates && normalizedQuery === value?.name)) {
      setOptions([]);
      setLoading(false);
      return;
    }

    const requestId = ++requestRef.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setMessage(null);

      try {
        const data = await invokeFunction<LocationSearchResponse>("screens-weather", {
          action: "locations",
          query: normalizedQuery,
        });

        if (requestId !== requestRef.current) return;
        const locations = Array.isArray(data?.locations) ? data.locations : [];
        setOptions(locations);
        setMessage(locations.length ? null : "Nenhuma cidade encontrada.");
      } catch {
        if (requestId !== requestRef.current) return;
        setOptions([]);
        setMessage("Não foi possível pesquisar cidades agora.");
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [normalizedQuery, open, selectedCoordinates, value?.name]);

  const typeLocation = (next: string) => {
    setQuery(next);
    setOpen(true);
    setMessage(null);
    onChange(next.trim() ? { name: next, latitude: null, longitude: null } : null);
  };

  const choose = (option: LocationOption) => {
    const location: WeatherLocation = {
      name: option.label || option.name,
      city: option.name,
      state: option.state || null,
      state_code: option.state_code || null,
      country: option.country || null,
      country_code: option.country_code || null,
      latitude: Number(option.latitude),
      longitude: Number(option.longitude),
    };
    setQuery(location.name || option.name || "");
    setOptions([]);
    setOpen(false);
    setMessage(null);
    onChange(location);
  };

  return (
    <div className="weather-location-picker">
      <label className="simple-field widget-config-field">
        Localização do clima
        <span className="weather-location-input-wrap">
          <Search aria-hidden="true" />
          <input
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(event) => typeLocation(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
              if (event.key === "Enter" && options.length === 1) {
                event.preventDefault();
                choose(options[0]);
              }
            }}
            placeholder="Ex.: São Mateus, ES"
            autoComplete="off"
          />
          {loading && <LoaderCircle className="weather-location-spinner" aria-label="Pesquisando" />}
          {!loading && selectedCoordinates && <Check className="weather-location-confirmed" aria-label="Localização confirmada" />}
        </span>
      </label>

      {open && normalizedQuery.length >= 2 && !selectedCoordinates && (
        <div className="weather-location-results" role="listbox" aria-label="Cidades encontradas">
          {options.map((option) => (
            <button
              type="button"
              key={`${option.latitude}:${option.longitude}`}
              className="weather-location-option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
            >
              <MapPin />
              <span>
                <b>{option.name}{option.state_code ? `, ${option.state_code}` : ""}</b>
                <small>{[option.state, option.country].filter(Boolean).join(" · ")}</small>
              </span>
            </button>
          ))}
          {message && <div className="weather-location-message">{message}</div>}
        </div>
      )}

      {selectedCoordinates && (
        <small className="weather-location-selected"><MapPin /> {value?.name}</small>
      )}
    </div>
  );
}
