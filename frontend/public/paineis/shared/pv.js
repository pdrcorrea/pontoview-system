(() => {
  const style = document.createElement("style");
  style.textContent = `
    .pv-footer{display:none!important}
    .pv-shell{grid-template-rows:auto minmax(0,1fr)!important}
  `;
  document.head.appendChild(style);
  const removeRedundantClock = () => {
    const clock = document.getElementById("clock");
    const source = clock?.closest(".pv-source");
    if (source) source.remove();
  };
  removeRedundantClock();
  document.addEventListener("DOMContentLoaded", removeRedundantClock, { once: true });
})();

window.PV = (() => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const qs = (name, fallback = "") => new URLSearchParams(location.search).get(name) || fallback;
  const clean = value => String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const formatNumber = (value, digits = 1) => Number(value).toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: digits });
  const formatMoney = (value, currency = "BRL", digits = 2) => Number(value).toLocaleString("pt-BR", { style:"currency", currency, maximumFractionDigits: digits, minimumFractionDigits: digits });
  const formatDate = date => new Intl.DateTimeFormat("pt-BR", { weekday:"long", day:"2-digit", month:"long", year:"numeric" }).format(date);
  const titleCase = text => clean(text).replace(/(^|\s)([a-záàâãéèêíìîóòôõúùûç])/g, (_, a, b) => a + b.toUpperCase());

  async function fetchJSON(url, options = {}, timeout = 9000){
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try{
      const res = await fetch(url, { cache:"no-store", ...options, signal:ctrl.signal });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally { clearTimeout(timer); }
  }

  function hash(text){
    let h = 2166136261;
    for(let i=0;i<text.length;i++){ h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }
  function storageGet(key){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }catch{return null} }
  function storageSet(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch{} }

  async function cached(key, ttlMs, loader, staleMs = ttlMs * 12){
    const storageKey = `pv-cache:${hash(key)}`;
    const now = Date.now();
    const saved = storageGet(storageKey);
    if(saved && saved.value !== undefined && now - Number(saved.at || 0) < ttlMs) return saved.value;
    try{
      const value = await loader();
      storageSet(storageKey, { at:now, value });
      return value;
    }catch(error){
      if(saved && saved.value !== undefined && now - Number(saved.at || 0) < staleMs) return saved.value;
      throw error;
    }
  }

  function ttlForPath(path){
    if(path.startsWith("/api/noticias")) return 5 * 60 * 1000;
    if(path.startsWith("/api/tempo")) return 10 * 60 * 1000;
    if(path.startsWith("/api/economia")) return 3 * 60 * 1000;
    if(path.startsWith("/api/hoje")) return 60 * 60 * 1000;
    if(path.startsWith("/api/curiosidades")) return 6 * 60 * 60 * 1000;
    if(path.startsWith("/api/cultura")) return 12 * 60 * 60 * 1000;
    if(path.startsWith("/api/sustentabilidade")) return 6 * 60 * 60 * 1000;
    if(path.startsWith("/api/saude")) return 6 * 60 * 60 * 1000;
    return 5 * 60 * 1000;
  }
  async function cachedJSON(url, ttlMs = 5 * 60 * 1000, options = {}, timeout = 9000){ return cached(`url:${url}`, ttlMs, () => fetchJSON(url, options, timeout)); }
  function apiBase(){ return qs("api", "").replace(/\/$/, ""); }
  async function fromApi(path, fallback, ttlMs = ttlForPath(path)){
    const base = apiBase();
    return cached(`endpoint:${base || "direct"}:${path}`, ttlMs, async () => {
      if(base){ try{ return await fetchJSON(base + path); }catch{} }
      if(typeof fallback === "function") return await fallback();
      throw new Error("Fonte indisponível");
    });
  }

  function signatureOf(item){
    if(item == null) return "";
    if(typeof item === "string") return item;
    return String(item.link || item.url || item.id || item.title || item.text || JSON.stringify(item));
  }
  function pickForRefresh(items, key = "default", signatureFn = signatureOf){
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if(!list.length) return null;
    const storageKey = `pv-last:${key}`;
    let last = "";
    try{ last = localStorage.getItem(storageKey) || ""; }catch{}
    const alternatives = list.filter(item => signatureFn(item) !== last);
    const pool = alternatives.length ? alternatives : list;
    const item = pool[Math.floor(Math.random() * pool.length)];
    try{ localStorage.setItem(storageKey, signatureFn(item)); }catch{}
    return item;
  }

  async function transition(shell, update, duration = 560){
    shell.classList.add("is-leaving");
    await sleep(duration);
    await update();
    shell.classList.remove("is-leaving");
    shell.classList.remove("is-entering");
    void shell.offsetWidth;
    shell.classList.add("is-entering");
    setTimeout(() => shell.classList.remove("is-entering"), 780);
  }
  function startProgress(el, duration){
    if(!el) return () => {};
    let raf = 0;
    const start = performance.now();
    const tick = now => {
      const p = clamp((now - start) / duration, 0, 1);
      el.style.width = `${p * 100}%`;
      if(p < 1) raf = requestAnimationFrame(tick);
    };
    el.style.width = "0%";
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }
  function qrUrl(link){ return link ? "https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=" + encodeURIComponent(link) : ""; }
  function setImage(img, media, url){
    if(!img || !media) return;
    if(!url){ media.classList.remove("has-image"); img.removeAttribute("src"); return; }
    img.onload = () => media.classList.add("has-image");
    img.onerror = () => { media.classList.remove("has-image"); img.removeAttribute("src"); img.onerror = null; };
    img.src = url;
  }
  return { sleep, qs, clean, clamp, formatNumber, formatMoney, formatDate, titleCase, fetchJSON, cachedJSON, cached, fromApi, pickForRefresh, transition, startProgress, qrUrl, setImage };
})();
