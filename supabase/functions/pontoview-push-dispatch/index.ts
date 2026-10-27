import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { SEASONAL_CAMPAIGNS, isSeasonalCampaignActive } from "./seasonalCampaigns.ts";
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json"}});
Deno.serve(async req=>{
 if(req.method!=="POST") return json({error:"method"},405);
 const url=Deno.env.get("SUPABASE_URL")||"";
 const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 if(!url||!key) return json({error:"missing backend settings"},503);
 const db=createClient(url,key,{auth:{persistSession:false}});
 const {data:secrets,error:secretError}=await db.rpc("push_server_secrets");
 if(secretError||!secrets) return json({error:"push config"},503);
 const supplied=req.headers.get("x-pontoview-job-key")||"";
 if(!supplied||supplied!==secrets.cron) return json({error:"unauthorized"},401);
 webpush.setVapidDetails("mailto:contato@pontoview.com.br",secrets.public,secrets.private);
 const cutoff=new Date(Date.now()-24*3600000).toISOString();
 const [subsRes,eventsRes,orgRes,membersRes]=await Promise.all([
  db.from("push_subscriptions").select("id,user_id,organization_id,endpoint,p256dh,auth,notify_seasonal,notify_offline,notify_errors,notify_recovered").eq("enabled",true).limit(2000),
  db.from("screen_events").select("screen_id,organization_id,media_id,event_type,occurred_at,media(name)").in("event_type",["media_error","content_ended"]).gte("occurred_at",cutoff).order("occurred_at",{ascending:false}).limit(1000),
  db.from("organizations").select("id,timezone,created_by").limit(1000),
  db.from("organization_users").select("organization_id,user_id").limit(5000)
 ]);
 if(subsRes.error||eventsRes.error||orgRes.error||membersRes.error)return json({error:"data unavailable"},503);
 const now=Date.now();
 const all:Record<string,Array<{key:string;title:string;body:string;url:string}>>={};
 const append=(org:string,n:{key:string;title:string;body:string;url:string})=>(all[org]??=[]).push(n);
 const recentFailures=new Map<string,number>();
 for(const e of eventsRes.data||[]){
   if(!e.media_id || e.event_type!=="media_error") continue;
   const id=e.screen_id+":"+e.media_id;
   recentFailures.set(id,(recentFailures.get(id)||0)+1);
 }
 const latest=new Set<string>();
 for(const e of eventsRes.data||[]){
  if(!e.media_id)continue;
  const k=e.screen_id+":"+e.media_id;
  if(latest.has(k))continue;
  latest.add(k);
  if(e.event_type!=="media_error" || (recentFailures.get(k)||0)<2)continue;
  const m:any=Array.isArray(e.media)?e.media[0]:e.media;
  append(e.organization_id,{key:"error:"+k+":"+new Date(e.occurred_at).toISOString().slice(0,10),title:"Falha recorrente de conteúdo",body:(m?.name||"Conteúdo")+" apresentou falhas de reprodução repetidas.",url:"/telas"});
 }
 for(const org of orgRes.data||[]){
  const date=new Date();
  const active=SEASONAL_CAMPAIGNS.filter(c=>isSeasonalCampaignActive(c,date,org.timezone));
  if(active.length){
    const names=active.slice(0,3).map(c=>c.name).join(", ");
    append(org.id,{
      key:"season:"+date.getUTCFullYear()+":"+active.map(c=>c.key).sort().join("-"),
      title:active.length===1?"Painel sazonal disponível":"Painéis sazonais disponíveis",
      body:names+(active.length>3?" e outros.":"")+" Confira o catálogo.",
      url:"/apps"
    });
  }
 }
 const allowed = new Set((membersRes.data||[]).map((m:any)=>m.organization_id+":"+m.user_id));
 for(const org of orgRes.data||[])if(org.created_by)allowed.add(org.id+":"+org.created_by);
 let sent=0,failed=0;
 for(const sub of subsRes.data||[]){
  if(!allowed.has(sub.organization_id+":"+sub.user_id))continue;
  for(const notice of (all[sub.organization_id]||[]).filter((n:any)=>n.key.startsWith("season:")?sub.notify_seasonal:n.key.startsWith("offline:")?sub.notify_offline:n.key.startsWith("reconnected:")?sub.notify_recovered:sub.notify_errors).slice(0,25)){
   const {error:dedupe}=await db.from("push_delivery_log").insert({organization_id:sub.organization_id,user_id:sub.user_id,dedupe_key:sub.id+":"+notice.key}).select("id").single();
   if(dedupe){if(dedupe.code!=="23505")failed++;continue;}
   try{
    await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify(notice),{TTL:3600});
    sent++;
   }catch(e){
    failed++;
    const code=Number((e as any)?.statusCode||0);
    if(code===404||code===410)await db.from("push_subscriptions").delete().eq("id",sub.id);
    else await db.from("push_delivery_log").delete().eq("user_id",sub.user_id).eq("dedupe_key",sub.id+":"+notice.key);
   }
  }
 }
 return json({sent,failed});
});
