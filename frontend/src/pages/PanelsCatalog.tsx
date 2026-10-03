import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarHeart,
  Check,
  Search,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { AsyncButton, FormMessage, PageHead } from "../components/ui";
import { supabase } from "../lib/supabase";
import { PANEL_CATALOG, panelUrl, type PanelCatalogItem } from "../panelCatalog";
import {
  SEASONAL_CAMPAIGNS,
  SEASONAL_GROUP_LABELS,
  isSeasonalCampaignActive,
  type SeasonalCampaign,
  type SeasonalContentGroup,
} from "../seasonalCampaigns";

type CatalogTab = "automatic" | SeasonalContentGroup;

const tabs: Array<{ id: CatalogTab; label: string }> = [
  { id: "automatic", label: "Automáticos" },
  { id: "campaign", label: "Campanhas" },
  { id: "holiday", label: "Feriados" },
  { id: "commemorative", label: "Datas comemorativas" },
];

export function PanelsCatalogPage() {
  const { organization, user } = useAuth();
  const [tab, setTab] = useState<CatalogTab>("automatic");
  const [search, setSearch] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(() => new Set());

  const loadAdded = useCallback(async () => {
    if (!organization) {
      setAdded(new Set());
      return;
    }
    const result = await supabase
      .from("media")
      .select("type,page_url,app_key,status")
      .eq("organization_id", organization.id)
      .neq("status", "archived");
    if (result.error) {
      setError(result.error.message);
      return;
    }
    const next = new Set<string>();
    for (const row of result.data || []) {
      if (row.type === "webpage" && row.page_url) {
        const panel = PANEL_CATALOG.find((item) => panelUrl(item.slug) === row.page_url);
        if (panel) next.add(`panel:${panel.key}`);
      }
      if (row.type === "app" && row.app_key) next.add(`seasonal:${row.app_key}`);
    }
    setAdded(next);
  }, [organization]);

  useEffect(() => { void loadAdded(); }, [loadAdded]);

  const addPanel = async (panel: PanelCatalogItem) => {
    if (!organization || !user) return;
    const marker = `panel:${panel.key}`;
    if (added.has(marker)) {
      setMessage(`${panel.title} já está na sua biblioteca.`);
      return;
    }
    setBusyKey(marker);
    setError(null);
    setMessage(null);
    const url = panelUrl(panel.slug);
    try {
      const archived = await supabase
        .from("media")
        .select("id")
        .eq("organization_id", organization.id)
        .eq("type", "webpage")
        .eq("page_url", url)
        .eq("status", "archived")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (archived.error) throw archived.error;
      const payload = {
        organization_id: organization.id,
        type: "webpage" as const,
        name: panel.title,
        page_url: url,
        duration_seconds: panel.duration,
        online_required: false,
        status: "ready",
        created_by: user.id,
        metadata: { pontoview_panel: true, panel_key: panel.key, panel_category: panel.category },
      };
      const result = archived.data?.id
        ? await supabase.from("media").update(payload).eq("id", archived.data.id)
        : await supabase.from("media").insert(payload);
      if (result.error) throw result.error;
      setAdded((current) => new Set(current).add(marker));
      setMessage(`${panel.title} adicionado à biblioteca.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível adicionar este painel.");
    } finally {
      setBusyKey(null);
    }
  };

  const addSeasonal = async (campaign: SeasonalCampaign) => {
    if (!organization || !user) return;
    const marker = `seasonal:${campaign.key}`;
    if (added.has(marker)) {
      setMessage(`${campaign.name} já está na sua biblioteca.`);
      return;
    }
    setBusyKey(marker);
    setError(null);
    setMessage(null);
    try {
      const archived = await supabase
        .from("media")
        .select("id")
        .eq("organization_id", organization.id)
        .eq("type", "app")
        .eq("app_key", campaign.key)
        .eq("status", "archived")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (archived.error) throw archived.error;
      const payload = {
        organization_id: organization.id,
        type: "app" as const,
        app_key: campaign.key,
        name: campaign.name,
        duration_seconds: campaign.durationSeconds,
        online_required: false,
        created_by: user.id,
        status: "ready",
        metadata: {
          seasonal: true,
          seasonal_group: campaign.group,
          seasonal_category: campaign.category,
          seasonal_window: {
            start: campaign.start || null,
            end: campaign.end || null,
            rule: campaign.rule || null,
            period_label: campaign.periodLabel,
          },
        },
      };
      const result = archived.data?.id
        ? await supabase.from("media").update(payload).eq("id", archived.data.id)
        : await supabase.from("media").insert(payload);
      if (result.error) throw result.error;
      setAdded((current) => new Set(current).add(marker));
      setMessage(`${campaign.name} adicionado à biblioteca.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível adicionar este painel sazonal.");
    } finally {
      setBusyKey(null);
    }
  };

  const query = search.trim().toLowerCase();
  const automatic = useMemo(
    () => PANEL_CATALOG.filter((item) => `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(query)),
    [query],
  );
  const seasonal = useMemo(
    () => SEASONAL_CAMPAIGNS.filter((item) => item.group === tab && `${item.name} ${item.description} ${item.category} ${item.periodLabel}`.toLowerCase().includes(query)),
    [tab, query],
  );

  return (
    <>
      <PageHead
        eyebrow="Conteúdo PontoView"
        title="Painéis PontoView"
        text="Um catálogo único para painéis automáticos, campanhas, feriados e datas comemorativas."
      />

      <div className="panel-catalog-toolbar">
        <div className="panel-catalog-tabs" role="tablist" aria-label="Categorias de painéis">
          {tabs.map((item) => {
            const count = item.id === "automatic"
              ? PANEL_CATALOG.length
              : SEASONAL_CAMPAIGNS.filter((campaign) => campaign.group === item.id).length;
            return (
              <button
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={tab === item.id ? "active" : ""}
                key={item.id}
                onClick={() => setTab(item.id)}
              >
                <span>{item.label}</span><small>{count}</small>
              </button>
            );
          })}
        </div>
        <label className="panel-catalog-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar painel" /></label>
      </div>

      <FormMessage error={error} success={message} />

      {tab === "automatic" ? (
        <div className="pv-catalog-grid">
          {automatic.map((panel) => {
            const marker = `panel:${panel.key}`;
            const isAdded = added.has(marker);
            return (
              <article className="pv-catalog-card" key={panel.key}>
                <div className="pv-catalog-art" aria-hidden="true">{panel.emoji}</div>
                <div className="pv-catalog-copy">
                  <span className="pv-catalog-kicker">{panel.category}</span>
                  <h2>{panel.title}</h2>
                  <p>{panel.description}</p>
                  <small>{panel.duration}s · automático</small>
                </div>
                <AsyncButton busy={busyKey === marker} disabled={Boolean(busyKey && busyKey !== marker) || isAdded} className={isAdded ? "btn secondary" : "btn primary"} onClick={() => void addPanel(panel)}>
                  {isAdded ? <Check /> : <Sparkles />}{isAdded ? "Na biblioteca" : "Adicionar"}
                </AsyncButton>
              </article>
            );
          })}
        </div>
      ) : (
        <>
          <div className="seasonal-catalog-intro">
            <span><CalendarHeart /></span>
            <div><b>{SEASONAL_GROUP_LABELS[tab]}</b><p>Todo o calendário fica aqui. Na página Conteúdo aparecem somente os sazonais disponíveis no período atual.</p></div>
          </div>
          <div className="pv-catalog-grid seasonal-catalog-grid">
            {seasonal.map((campaign) => {
              const marker = `seasonal:${campaign.key}`;
              const isAdded = added.has(marker);
              const active = isSeasonalCampaignActive(campaign, new Date());
              return (
                <article className={`pv-catalog-card seasonal ${active ? "available" : "scheduled"}`} key={campaign.key}>
                  <div className="pv-catalog-art" aria-hidden="true">{campaign.emoji}</div>
                  <div className="pv-catalog-copy">
                    <span className={active ? "pv-seasonal-status available" : "pv-seasonal-status scheduled"}>{active ? "Disponível agora" : "Programado"}</span>
                    <h2>{campaign.name}</h2>
                    <p>{campaign.description}</p>
                    <small>{campaign.category} · {campaign.periodLabel} · {campaign.durationSeconds}s</small>
                  </div>
                  <AsyncButton busy={busyKey === marker} disabled={Boolean(busyKey && busyKey !== marker) || isAdded} className={isAdded ? "btn secondary" : active ? "btn primary" : "btn secondary"} onClick={() => void addSeasonal(campaign)}>
                    {isAdded ? <Check /> : <Sparkles />}{isAdded ? "Na biblioteca" : "Adicionar"}
                  </AsyncButton>
                </article>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
