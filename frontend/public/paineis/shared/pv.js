(() => {
  const cleanPanelChrome = () => {
    document.querySelectorAll(".pv-footer-brand").forEach((brand) => brand.remove());
    document.querySelectorAll(".pv-footer").forEach((footer) => {
      const hasUsefulContent = Boolean(footer.textContent?.trim() || footer.querySelector("img,svg,a,.credit"));
      if (!hasUsefulContent && footer instanceof HTMLElement) footer.style.display = "none";
    });
    const clock = document.getElementById("clock");
    const source = clock?.closest(".pv-source");
    if (source instanceof HTMLElement) source.style.display = "none";
  };
  cleanPanelChrome();
  document.addEventListener("DOMContentLoaded", cleanPanelChrome, { once: true });
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

  function newsPlain(value){
    return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  function hasBrokenNewsEncoding(value){
    const text = clean(value);
    return text.includes("\uFFFD") || /(Ã[\x80-\xBF]|Â[\x80-\xBF]|â(?:€|€™|€œ|€�|€“|€”|€¦|„|†)|ðŸ|ï¿½)/.test(text);
  }
  function newsEditorialCheck(item){
    const x = item || {};
    const title = clean(x.title);
    const summary = clean(x.summary || x.description);
    const source = clean(x.source || x.sourceDomain);
    const url = clean(x.url || x.link || x.sourceUrl);

    if(!title) return { allowed:false, reason:"missing_title" };
    if(hasBrokenNewsEncoding(title) || hasBrokenNewsEncoding(summary) || hasBrokenNewsEncoding(source)) return { allowed:false, reason:"broken_encoding" };

    const text = newsPlain(title + " " + summary + " " + source + " " + url);
    const titlePlain = newsPlain(title);
    const sourcePlain = newsPlain(source);
    const urlPlain = newsPlain(url);

    const blockedSources = ["folha de s.paulo","folha de s. paulo","folha de sao paulo","folha s.paulo","folha.uol.com.br","www1.folha.uol.com.br"];
    if(blockedSources.some(term => sourcePlain.includes(term) || urlPlain.includes(term))) return { allowed:false, reason:"blocked_source" };

    const advertisingTerms = [
      "publieditorial","publipost","conteudo patrocinado","conteudo publicitario","informe publicitario",
      "oferta","ofertas","promocao","promocoes","cupom","cupons","desconto","descontos",
      "compre agora","aproveite","black friday","liquidacao","imperdivel","melhor preco",
      "a partir de r$","por apenas r$","assine agora","clique e compre","link de compra",
      "patrocinado por","parceria paga","shopping","vitrine","guia de compras"
    ];
    if(advertisingTerms.some(term => text.includes(term))) return { allowed:false, reason:"advertising" };

    let clickbaitScore = 0;
    const engagementLeads = ["veja","saiba","descubra","confira","entenda","assista","clique","leia","conheca","aprenda","relembre"];
    if(engagementLeads.some(term => titlePlain === term || titlePlain.startsWith(term + " "))) clickbaitScore += 2;

    const strongClickbait = [
      "voce nao vai acreditar","nao vai acreditar","ninguem esperava","ninguem te conta",
      "chocou a internet","surpreendeu a todos","veja o que aconteceu","descubra agora",
      "motivo vai te surpreender","revelacao bombastica","bombou na web","internet vai a loucura",
      "de cair o queixo","de arrepiar","esta dando o que falar","nao perca","urgente!",
      "segredo revelado","isso vai te surpreender","voce precisa saber","tudo o que voce precisa saber",
      "esse e o motivo","este e o motivo","o final surpreende","final inesperado","reacao surpreende","web reage"
    ];
    if(strongClickbait.some(term => text.includes(term))) clickbaitScore += 3;

    const clickInducing = [
      "saiba mais","veja mais","confira agora","confira detalhes","veja detalhes","veja como","saiba como",
      "entenda o motivo","entenda por que","saiba o motivo","saiba por que","clique aqui","assista ao video",
      "assista o video","veja o video","leia mais","continue lendo","veja a lista","confira a lista",
      "descubra quem","veja quem","o que se sabe","o que sabemos","saiba tudo","veja tudo","entenda tudo",
      "quem e","qual e o motivo","por que isso aconteceu","o que aconteceu"
    ];
    if(clickInducing.some(term => titlePlain.includes(term))) clickbaitScore += 1;
    if(/\?\s*$/.test(title)) clickbaitScore += 1;
    if((title.match(/!/g) || []).length >= 1) clickbaitScore += 1;
    if(/\.{3,}\s*$/.test(title)) clickbaitScore += 1;

    const letters = title.replace(/[^A-Za-zÀ-ÿ]/g,"");
    const uppercase = title.replace(/[^A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ]/g,"");
    if(letters.length >= 12 && uppercase.length / letters.length > .72) clickbaitScore += 2;
    if(clickbaitScore >= 2) return { allowed:false, reason:"clickbait" };

    const sensitiveTerms = [
      "estupro","estuprada","abuso sexual","violencia sexual","pornografia","nudez",
      "esquartejado","decapitado","decapitada","corpo carbonizado","corpo mutilado","cadaver",
      "suicidio","se matou","automutilacao","massacre","chacina","tortura",
      "tiroteio deixa","morre apos ser baleado","morta a tiros","morto a tiros"
    ];
    if(sensitiveTerms.some(term => text.includes(term))) return { allowed:false, reason:"sensitive" };

    const controversialTerms = [
      "barraco","treta","detona","humilha","esculacha","lacrou","cancelado","cancelada",
      "guerra nas redes","troca de farpas","climao","polemica nas redes","revolta internautas",
      "gera revolta","causa indignacao","ataque pessoal","xinga","xingou","fofoca","amante",
      "traicao","separacao bombastica"
    ];
    if(controversialTerms.some(term => text.includes(term))) return { allowed:false, reason:"controversial" };

    return { allowed:true };
  }
  function filterSafeNews(items){
    return (Array.isArray(items) ? items : []).filter(item => newsEditorialCheck(item).allowed);
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
  return { sleep, qs, clean, clamp, formatNumber, formatMoney, formatDate, titleCase, fetchJSON, cachedJSON, cached, fromApi, newsEditorialCheck, filterSafeNews, pickForRefresh, transition, startProgress, qrUrl, setImage };
})();
