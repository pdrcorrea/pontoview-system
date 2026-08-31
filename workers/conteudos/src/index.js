const CULTURE_TOPICS = [
  ["Tarsila do Amaral","Arte brasileira"],["Candido Portinari","Arte brasileira"],["Aleijadinho","Arte brasileira"],["Anita Malfatti","Arte brasileira"],
  ["Museu de Arte de São Paulo","Museus"],["Museu do Amanhã","Museus"],["Teatro Amazonas","Arquitetura"],["Congresso Nacional do Brasil","Arquitetura"],
  ["Oscar Niemeyer","Arquitetura"],["Bossa nova","Música"],["Samba","Música"],["Choro","Música"],["Cinema do Brasil","Cinema"],
  ["Literatura do Brasil","Literatura"],["Machado de Assis","Literatura"],["Clarice Lispector","Literatura"],["Semana de Arte Moderna","História da arte"],
  ["Festa Junina no Brasil","Cultura popular"],["Carnaval do Brasil","Cultura popular"],["Capoeira","Patrimônio cultural"]
];

const CORS = {
  "access-control-allow-origin":"*",
  "access-control-allow-methods":"GET, OPTIONS",
  "access-control-allow-headers":"Content-Type",
  "content-type":"application/json; charset=utf-8"
};

const TTL = { hoje:3600, curiosidades:21600, cultura:43200, economia:180, sustentabilidade:21600, noticias:300, saude:21600, tempo:600 };

function json(data, status = 200, cache = "public, max-age=180, s-maxage=300", extraHeaders = {}){
  return new Response(JSON.stringify(data), { status, headers:{...CORS,"cache-control":cache,...extraHeaders} });
}

async function cachedEndpoint(request, ctx, ttl, producer){
  const cache = caches.default;
  const key = new Request(request.url, {method:"GET"});
  const hit = await cache.match(key);
  if(hit){
    const headers = new Headers(hit.headers);
    headers.set("x-pontoview-cache","HIT");
    return new Response(hit.body,{status:hit.status,statusText:hit.statusText,headers});
  }
  const data = await producer();
  const response = json(data,200,`public, max-age=${ttl}, s-maxage=${ttl}`,{"x-pontoview-cache":"MISS"});
  ctx.waitUntil(cache.put(key,response.clone()));
  return response;
}

async function fetchJSON(url, timeout = 9000, ttl = 300){
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try{
    const res = await fetch(url, {
      signal:ctrl.signal,
      headers:{"user-agent":"PontoView-Telas/1.0 (+https://pontoview.com.br)","accept":"application/json,*/*"},
      cf:{cacheTtl:ttl,cacheEverything:true}
    });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

function clean(value = ""){ return String(value).replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim(); }
function trimText(value, max = 560){ const t = clean(value); return t.length <= max ? t : t.slice(0,max-3).replace(/\s+\S*$/,"") + "..."; }
function isSuitable(text){
  const normalized = clean(text).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const blocked = ["suicidio","assassinato","homicidio","massacre","estupro","pornografia","sexo explicito","guerra civil","cadaver","tortura","feminicidio"];
  return !blocked.some(term => normalized.includes(term));
}

async function getHoje(){
  const now = new Date();
  let holidays = [];
  try{ holidays = await fetchJSON(`https://brasilapi.com.br/api/feriados/v1/${now.getUTCFullYear()}`,8000,21600); }catch{}
  return {ok:true,source:"BrasilAPI",now:now.toISOString(),holidays:Array.isArray(holidays)?holidays:[]};
}

async function getCuriosidades(){
  const url = "https://pt.wikipedia.org/w/api.php?action=query&format=json&generator=random&grnnamespace=0&grnlimit=12&prop=extracts|pageimages|info&exintro=1&explaintext=1&piprop=thumbnail&pithumbsize=1200&inprop=url&origin=*";
  const data = await fetchJSON(url,9000,900);
  const pages = Object.values(data?.query?.pages || {}).map(p => ({ title:clean(p.title), text:trimText(p.extract,760), image:p.thumbnail?.source || "", link:p.fullurl || "", topic:"Conhecimento" }))
    .filter(p => p.title && p.text.length >= 120 && !/^(Lista|Anexo|Categoria|Wikipédia:)/i.test(p.title) && isSuitable(`${p.title} ${p.text}`));
  return {ok:pages.length>0,source:"Wikipédia",items:pages.slice(0,8)};
}

async function getCultura(){
  const titles = CULTURE_TOPICS.map(x=>x[0]).join("|");
  const url = "https://pt.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|pageimages|info&exintro=1&explaintext=1&piprop=thumbnail&pithumbsize=1600&inprop=url&redirects=1&origin=*&titles=" + encodeURIComponent(titles);
  const data = await fetchJSON(url,9000,21600);
  const map = new Map(CULTURE_TOPICS.map(x=>[x[0].toLowerCase(),x[1]]));
  const pages = Object.values(data?.query?.pages || {}).filter(p=>!p.missing).map(p=>({ title:clean(p.title),text:trimText(p.extract,860),image:p.thumbnail?.source||"",link:p.fullurl||"",category:map.get(clean(p.title).toLowerCase())||"Cultura brasileira" })).filter(x=>x.title&&x.text.length>100);
  for(let i=pages.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pages[i],pages[j]]=[pages[j],pages[i]]}
  return {ok:pages.length>0,source:"Wikipédia",items:pages};
}

async function getEconomia(){
  const [quotesRes,ratesRes] = await Promise.allSettled([
    fetchJSON("https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,BTC-BRL",8000,180),
    fetchJSON("https://brasilapi.com.br/api/taxas/v1",8000,1800)
  ]);
  const q = quotesRes.status === "fulfilled" ? quotesRes.value : {};
  const quotes = [
    q.USDBRL && {code:"USD",label:"Dólar americano",value:Number(q.USDBRL.bid),change:Number(q.USDBRL.pctChange),updated:q.USDBRL.create_date},
    q.EURBRL && {code:"EUR",label:"Euro",value:Number(q.EURBRL.bid),change:Number(q.EURBRL.pctChange),updated:q.EURBRL.create_date},
    q.BTCBRL && {code:"BTC",label:"Bitcoin",value:Number(q.BTCBRL.bid),change:Number(q.BTCBRL.pctChange),updated:q.BTCBRL.create_date}
  ].filter(Boolean);
  return {ok:quotes.length>0 || ratesRes.status==="fulfilled",sources:["AwesomeAPI","BrasilAPI"],quotes,rates:ratesRes.status==="fulfilled"&&Array.isArray(ratesRes.value)?ratesRes.value:[]};
}

function latestWorldBank(jsonData){ const rows = Array.isArray(jsonData) && Array.isArray(jsonData[1]) ? jsonData[1] : []; const row = rows.find(x=>x&&x.value!==null&&x.value!==undefined); return row ? {value:Number(row.value),year:row.date} : null; }
function ymd(date){ return `${date.getUTCFullYear()}${String(date.getUTCMonth()+1).padStart(2,"0")}${String(date.getUTCDate()).padStart(2,"0")}`; }
function latestSolar(jsonData){
  const values = jsonData?.properties?.parameter?.ALLSKY_SFC_SW_DWN || {};
  const rows = Object.entries(values).filter(([,value]) => Number.isFinite(Number(value)) && Number(value) > -900).sort((a,b) => b[0].localeCompare(a[0]));
  if(!rows.length) return null;
  const [date,value] = rows[0];
  return {value:Number(value),date:`${date.slice(6,8)}/${date.slice(4,6)}/${date.slice(0,4)}`};
}

async function getSustentabilidade(url){
  const lat = Number(url.searchParams.get("lat") || -15.793889);
  const lon = Number(url.searchParams.get("lon") || -47.882778);
  const city = clean(url.searchParams.get("cidade") || "Brasil");
  const end = new Date(); end.setUTCDate(end.getUTCDate()-1);
  const start = new Date(end); start.setUTCDate(start.getUTCDate()-9);
  const solarUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=${encodeURIComponent(lon)}&latitude=${encodeURIComponent(lat)}&start=${ymd(start)}&end=${ymd(end)}&format=JSON`;
  const base = "https://api.worldbank.org/v2/country/BR/indicator/";
  const results = await Promise.allSettled([
    fetchJSON(solarUrl,10000,21600),
    fetchJSON(base+"EG.FEC.RNEW.ZS?format=json&per_page=12",8500,43200),
    fetchJSON(base+"AG.LND.FRST.ZS?format=json&per_page=12",8500,43200),
    fetchJSON(base+"EN.ATM.CO2E.PC?format=json&per_page=12",8500,43200)
  ]);
  return { ok:results.some(r=>r.status==="fulfilled"),location:city,solar:results[0].status==="fulfilled"?latestSolar(results[0].value):null,renewable:results[1].status==="fulfilled"?latestWorldBank(results[1].value):null,forest:results[2].status==="fulfilled"?latestWorldBank(results[2].value):null,co2:results[3].status==="fulfilled"?latestWorldBank(results[3].value):null,sources:["NASA POWER","World Bank"] };
}

async function getNoticias(){ const data = await fetchJSON("https://pontoview-api.pedrhc258.workers.dev/api/news",11000,300); return {...data,proxiedBy:"PontoView Telas Content API"}; }
async function getSaude(){ const data = await fetchJSON("https://saude.pedrhc258.workers.dev/api/health-tips",10000,1800); const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []; return {ok:items.length>0,items,proxiedBy:"PontoView Telas Content API"}; }

async function getTempo(url){
  const lat = Number(url.searchParams.get("lat") || -19.5394);
  const lon = Number(url.searchParams.get("lon") || -40.6306);
  const uf = clean(url.searchParams.get("uf") || "").toUpperCase();
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=6`;
  const jobs = [fetchJSON(forecastUrl,9000,600)];
  if(uf) jobs.push(fetchJSON(`https://radarmeteorologico.com.br/api/v1/alertas?uf=${encodeURIComponent(uf)}`,9000,600));
  const results = await Promise.allSettled(jobs);
  if(results[0].status !== "fulfilled") throw new Error("Previsão meteorológica indisponível");
  return { ok:true,weather:results[0].value,alerts:results[1]?.status === "fulfilled" ? (results[1].value?.alertas || results[1].value || []) : [],sources:["Open-Meteo","INMET via RadarMeteorológico"] };
}

export default {
  async fetch(request, env, ctx){
    const url = new URL(request.url);
    if(request.method === "OPTIONS") return new Response(null,{status:204,headers:CORS});
    if(request.method !== "GET") return json({ok:false,error:"Method not allowed"},405,"no-store");
    try{
      if(url.pathname === "/api/hoje") return cachedEndpoint(request,ctx,TTL.hoje,getHoje);
      if(url.pathname === "/api/curiosidades") return cachedEndpoint(request,ctx,TTL.curiosidades,getCuriosidades);
      if(url.pathname === "/api/cultura") return cachedEndpoint(request,ctx,TTL.cultura,getCultura);
      if(url.pathname === "/api/economia") return cachedEndpoint(request,ctx,TTL.economia,getEconomia);
      if(url.pathname === "/api/sustentabilidade") return cachedEndpoint(request,ctx,TTL.sustentabilidade,()=>getSustentabilidade(url));
      if(url.pathname === "/api/noticias") return cachedEndpoint(request,ctx,TTL.noticias,getNoticias);
      if(url.pathname === "/api/saude") return cachedEndpoint(request,ctx,TTL.saude,getSaude);
      if(url.pathname === "/api/tempo") return cachedEndpoint(request,ctx,TTL.tempo,()=>getTempo(url));
      if(url.pathname === "/health") return json({ok:true,service:"PontoView Telas Content API",cache:"Cloudflare Cache API",endpoints:["/api/hoje","/api/curiosidades","/api/cultura","/api/economia","/api/sustentabilidade","/api/noticias","/api/saude","/api/tempo"]},200,"no-store");
      return json({ok:true,service:"PontoView Telas Content API",health:"/health"},200,"no-store");
    }catch(error){ return json({ok:false,error:error instanceof Error?error.message:"Unexpected error"},500,"no-store"); }
  }
};
