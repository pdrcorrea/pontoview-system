import { FormEvent, useMemo, useState } from 'react';
import { Navigate, NavLink, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import {
  AppWindow, BadgeDollarSign, BookOpen, CalendarClock, Check, ChevronRight, CircleHelp,
  Cloud, CreditCard, ExternalLink, FileImage, FileVideo, FolderOpen, Gauge, Headphones,
  LayoutDashboard, Link2, ListVideo, Monitor, MoreHorizontal, Play, Plus, Search, Settings,
  ShieldCheck, Sparkles, UserRound, Users, Wifi, WifiOff
} from 'lucide-react';

type NavItem = readonly [string, string, any];
const primaryNav: NavItem[] = [
  ['/dashboard','Visão geral',LayoutDashboard],
  ['/conteudo','Conteúdo',AppWindow],
  ['/playlists','Playlists',ListVideo],
  ['/programacoes','Programação',CalendarClock],
  ['/telas','Telas',Monitor],
  ['/apps','Apps',Sparkles],
];
const accountNav: NavItem[] = [
  ['/conta','Minha conta',UserRound],
  ['/financeiro','Financeiro',BadgeDollarSign],
  ['/ajuda','Ajuda',CircleHelp],
  ['/suporte','Contato e suporte',Headphones],
];

const toast = (message: string) => window.alert(message);

function Shell(){
  const location = useLocation();
  const title = [...primaryNav,...accountNav].find(([to])=>location.pathname.startsWith(to))?.[1] || 'PontoView';
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><b>P</b><span><strong>PontoView</strong><small>Screens</small></span></div>
      <div className="nav-label">Workspace</div>
      <nav>{primaryNav.map(([to,label,Icon])=><NavLink key={to} to={to} className={({isActive})=>isActive?'active':''}><Icon size={18}/><span>{label}</span></NavLink>)}</nav>
      <div className="nav-label account-label">Conta</div>
      <nav>{accountNav.map(([to,label,Icon])=><NavLink key={to} to={to} className={({isActive})=>isActive?'active':''}><Icon size={18}/><span>{label}</span></NavLink>)}</nav>
      <NavLink className="settings" to="/configuracoes"><Settings size={18}/><span>Configurações</span></NavLink>
      <div className="org-card"><span className="avatar">PV</span><span><strong>Empresa demonstração</strong><small>Plano Pro</small></span><MoreHorizontal size={18}/></div>
    </aside>
    <main>
      <header className="topbar"><div><small>PontoView Screens</small><strong>{title}</strong></div><div className="top-actions"><span className="system-ok">● Sistema operacional</span><button className="help-button" onClick={()=>toast('A Central de Ajuda já está disponível no menu lateral.')}><CircleHelp size={17}/></button><span className="top-avatar">PC</span></div></header>
      <div className="page"><Outlet/></div>
    </main>
  </div>
}

function Head({eyebrow,title,text,action,onAction}:{eyebrow:string,title:string,text:string,action?:string,onAction?:()=>void}){
  return <div className="head"><div><small>{eyebrow}</small><h1>{title}</h1><p>{text}</p></div>{action&&<button className="btn primary" onClick={onAction}><Plus size={16}/>{action}</button>}</div>
}

const dashboardCards = [
  ['Telas online','3','de 4 telas',Monitor],['Conteúdos','18','12 do Google Drive',Cloud],['Playlists','5','3 em exibição',Play],['Programações','4','2 ativas agora',CalendarClock]
] as const;

function Dashboard(){return <>
  <Head eyebrow="Visão geral" title="Boa tarde." text="Acompanhe suas telas, conteúdos e programações em um só lugar." action="Conectar tela" onAction={()=>toast('Fluxo de pareamento de tela será conectado ao Supabase na próxima etapa.')}/>
  <div className="stats">{dashboardCards.map(([l,v,m,I])=><article key={l}><I size={19}/><span>{l}</span><strong>{v}</strong><small>{m}</small></article>)}</div>
  <div className="dashboard-grid">
    <section className="panel"><div className="panel-title"><div><h2>Telas</h2><p>Status dos dispositivos conectados</p></div><NavLink to="/telas">Ver todas <ChevronRight size={14}/></NavLink></div>{[['Recepção principal',true],['Sala de espera',true],['Refeitório',true],['Auditório',false]].map(([n,o])=><div className="screen-row" key={String(n)}><span className="icon-box"><Monitor size={19}/></span><span><b>{n}</b><small>Recepção Geral</small></span><em className={o?'online':'offline'}>{o?<Wifi size={14}/>:<WifiOff size={14}/>} {o?'Online':'Offline'}</em></div>)}</section>
    <section className="panel now"><small className="eyebrow green">EM EXIBIÇÃO</small><div className="preview"><div className="preview-screen"><span>PontoView</span><b>Conteúdo que acompanha o seu negócio.</b></div></div><h2>Recepção Geral</h2><p>3 telas usando esta playlist</p><div className="progress"><i/></div><span className="muted">Próximo: Previsão do tempo · 00:20</span></section>
  </div>
  <section className="panel activity"><div className="panel-title"><div><h2>Atividade recente</h2><p>Últimas alterações da sua conta</p></div></div><div className="timeline"><span><i/><b>Playlist “Recepção Geral” atualizada</b><small>há 12 minutos</small></span><span><i/><b>Campanha Agosto adicionada à biblioteca</b><small>há 38 minutos</small></span><span><i/><b>Tela “Auditório” ficou offline</b><small>há 1 hora</small></span></div></section>
</>}

const media = [
  {name:'Campanha Agosto',type:'Vídeo',source:'Google Drive',duration:'00:30',icon:FileVideo},
  {name:'Institucional PontoView',type:'Vídeo',source:'Google Drive',duration:'01:12',icon:FileVideo},
  {name:'Aviso de atendimento',type:'Imagem',source:'Google Drive',duration:'00:15',icon:FileImage},
  {name:'Previsão do tempo',type:'App PontoView',source:'PontoView',duration:'00:20',icon:Cloud},
  {name:'Cardápio do dia',type:'Página web',source:'URL',duration:'00:30',icon:Link2},
  {name:'Campanha Institucional',type:'Imagem',source:'Google Drive',duration:'00:15',icon:FileImage},
];
function Conteudo(){const [filter,setFilter]=useState('Todos'); const shown=filter==='Todos'?media:media.filter(m=>m.type.includes(filter)); return <>
  <Head eyebrow="Biblioteca" title="Conteúdo" text="Organize mídias do Google Drive, páginas web e conteúdos dinâmicos." action="Adicionar conteúdo" onAction={()=>toast('Aqui abriremos as opções: Google Drive, Página Web ou App PontoView.')}/>
  <div className="toolbar"><div className="tabs">{['Todos','Vídeo','Imagem','App'].map(t=><button key={t} className={filter===t?'selected':''} onClick={()=>setFilter(t)}>{t}</button>)}</div><button className="btn secondary" onClick={()=>toast('Integração com Google Drive preparada para a próxima etapa.')}><Cloud size={16}/>Conectar Google Drive</button></div>
  <div className="media-grid">{shown.map(({name,type,source,duration,icon:Icon},i)=><article className="media-card" key={name}><div className={'media-thumb thumb-'+(i%4)}><Icon size={26}/><span>{duration}</span></div><div className="media-info"><b>{name}</b><span>{type} · {source}</span></div><button className="icon-button"><MoreHorizontal size={18}/></button></article>)}</div>
</>}

const playlists=[['Recepção Geral','6 itens','03:12','3 telas'],['Sala de Espera','8 itens','05:40','1 tela'],['Refeitório','5 itens','02:45','1 tela'],['Institucional','4 itens','04:15','Nenhuma tela'],['Campanhas','7 itens','03:30','2 telas']];
function Playlists(){return <><Head eyebrow="Organização" title="Playlists" text="Combine conteúdos na ordem em que devem aparecer nas telas." action="Nova playlist" onAction={()=>toast('Editor de playlist será ligado aos dados reais do Supabase.')}/><div className="list-panel">{playlists.map((p,i)=><article className="playlist-row" key={p[0]}><span className="playlist-icon"><Play size={17}/></span><span className="grow"><b>{p[0]}</b><small>{p[1]} · {p[2]}</small></span><span className="pill">{p[3]}</span><button className="btn tertiary">Editar</button><button className="icon-button"><MoreHorizontal size={18}/></button></article>)}</div></>}

function Programacoes(){return <><Head eyebrow="Automação" title="Programação" text="Defina quando cada playlist ou campanha deve aparecer." action="Nova programação" onAction={()=>toast('Criação de programação por período e horário será conectada ao Supabase.')}/><div className="schedule-grid"><article className="panel"><span className="status active">Ativa</span><h2>Programação padrão</h2><p>Recepção Geral · Todos os dias</p><strong>00:00 <span>→</span> 23:59</strong><small>3 telas</small></article><article className="panel"><span className="status active">Ativa</span><h2>Horário de almoço</h2><p>Refeitório · Seg a Sex</p><strong>10:30 <span>→</span> 14:30</strong><small>1 tela</small></article><article className="panel"><span className="status scheduled">Agendada</span><h2>Campanha Setembro</h2><p>Campanhas · 01/09 a 15/09</p><strong>08:00 <span>→</span> 20:00</strong><small>2 telas</small></article></div></>}

function Telas(){return <><Head eyebrow="Dispositivos" title="Telas" text="Conecte, monitore e controle os players vinculados à sua conta." action="Conectar tela" onAction={()=>toast('O player exibirá um código de 6 dígitos para pareamento.')}/><div className="device-grid">{[['Recepção principal','Online','Recepção Geral','há 8 seg'],['Sala de espera','Online','Sala de Espera','há 11 seg'],['Refeitório','Online','Refeitório','há 6 seg'],['Auditório','Offline','Institucional','há 1 h']].map((d,i)=><article className="device-card" key={d[0]}><div className="tv-preview"><Monitor size={34}/><span>{i===3?'Sem sinal':'1920 × 1080'}</span></div><div className="device-head"><div><h2>{d[0]}</h2><p>{d[2]}</p></div><span className={d[1]==='Online'?'status active':'status offline-status'}>{d[1]}</span></div><dl><div><dt>Última comunicação</dt><dd>{d[3]}</dd></div><div><dt>Orientação</dt><dd>Horizontal</dd></div></dl><button className="btn secondary full">Gerenciar tela</button></article>)}</div></>}

const apps=[['Previsão do tempo','Clima atualizado automaticamente',Cloud],['Notícias','Blocos de notícias para ambientes internos',BookOpen],['Relógio','Hora, data e informações úteis',Gauge],['Menu Board','Cardápios digitais para estabelecimentos',ListVideo],['Comunicados','Avisos internos e mensagens rápidas',AppWindow],['BusBoard','Painel de horários e partidas',Monitor]];
function Apps(){return <><Head eyebrow="Conteúdo dinâmico" title="Apps PontoView" text="Painéis prontos que você pode adicionar diretamente às suas playlists."/><div className="apps-grid">{apps.map(([name,text,I])=><article className="app-card" key={String(name)}><span className="app-icon"><I size={23}/></span><h2>{name}</h2><p>{text}</p><button className="btn secondary full">Adicionar à playlist</button></article>)}</div></>}

function Conta(){return <><Head eyebrow="Conta" title="Minha conta" text="Gerencie os dados da empresa, usuários e integrações."/><div className="settings-grid"><section className="panel form-card"><div className="panel-title"><div><h2>Dados da empresa</h2><p>Informações usadas na sua conta PontoView</p></div></div><label>Nome da empresa<input defaultValue="Empresa demonstração"/></label><label>Nome de exibição<input defaultValue="Empresa demonstração"/></label><label>Documento<input defaultValue="00.000.000/0001-00"/></label><button className="btn primary" onClick={()=>toast('Dados salvos na demonstração.')}>Salvar alterações</button></section><section className="panel"><div className="panel-title"><div><h2>Usuários</h2><p>2 de 3 usuários do plano</p></div><button className="btn secondary"><Plus size={15}/>Convidar</button></div><div className="user-row"><span className="avatar">PC</span><span className="grow"><b>Pedro Corrêa</b><small>Administrador</small></span><span className="pill">Você</span></div><div className="user-row"><span className="avatar light">OP</span><span className="grow"><b>Operador</b><small>Editor</small></span></div><div className="integration"><Cloud size={20}/><span><b>Google Drive</b><small>Fonte de arquivos da biblioteca</small></span><button className="btn secondary">Conectar</button></div></section></div></>}

function Financeiro(){return <><Head eyebrow="Assinatura" title="Financeiro" text="Acompanhe seu plano, pagamentos e uso da PontoView."/><div className="billing-hero panel"><div><span className="eyebrow">PLANO ATUAL</span><h2>PontoView Pro</h2><p>Recursos para gerenciar sua comunicação em múltiplas telas.</p><div className="price"><strong>R$ 79,90</strong><span>/ mês</span></div></div><div className="billing-status"><span className="status active"><Check size={13}/> Assinatura ativa</span><small>Próxima cobrança</small><b>10 de setembro de 2026</b><button className="btn primary" onClick={()=>toast('Este botão abrirá o fluxo seguro do Mercado Pago quando a integração estiver ativa.')}><CreditCard size={16}/>Gerenciar no Mercado Pago <ExternalLink size={14}/></button></div></div>
  <div className="billing-grid"><section className="panel"><div className="panel-title"><div><h2>Uso do plano</h2><p>Limites incluídos na sua assinatura</p></div></div><Usage label="Telas" value="3 de 5" percent={60}/><Usage label="Usuários" value="2 de 3" percent={67}/><Usage label="Integrações" value="1 de 3" percent={33}/></section><section className="panel payment-card"><div className="panel-title"><div><h2>Pagamento</h2><p>Processado com segurança pelo Mercado Pago</p></div></div><div className="payment-line"><span className="mp-mark">MP</span><span><b>Mercado Pago</b><small>Pagamento recorrente</small></span><ShieldCheck size={20}/></div><button className="btn secondary full" onClick={()=>toast('Redirecionamento ao Mercado Pago será habilitado na integração.')}>Alterar forma de pagamento</button></section></div>
  <section className="panel history"><div className="panel-title"><div><h2>Histórico de pagamentos</h2><p>Últimas cobranças da assinatura</p></div></div><div className="table"><div className="tr th"><span>Data</span><span>Descrição</span><span>Valor</span><span>Status</span></div>{[['10/08/2026','PontoView Pro','R$ 79,90'],['10/07/2026','PontoView Pro','R$ 79,90'],['10/06/2026','PontoView Pro','R$ 79,90']].map(r=><div className="tr" key={r[0]}><span>{r[0]}</span><span>{r[1]}</span><span>{r[2]}</span><span><i className="paid-dot"/>Pago</span></div>)}</div></section>
</>}
function Usage({label,value,percent}:{label:string,value:string,percent:number}){return <div className="usage"><div><span>{label}</span><b>{value}</b></div><div className="usage-bar"><i style={{width:`${percent}%`}}/></div></div>}

const helpItems=[
  ['Primeiros passos','Configure sua conta e coloque a primeira tela no ar.',BookOpen],['Como conectar uma tela','Use o código exibido pelo Player PontoView.',Monitor],['Como usar o Google Drive','Conecte seu Drive sem enviar os arquivos novamente.',Cloud],['Criando playlists','Organize vídeos, imagens, páginas e Apps.',ListVideo],['Programação automática','Defina dias, horários e campanhas temporárias.',CalendarClock],['Financeiro e pagamentos','Entenda planos e cobranças pelo Mercado Pago.',BadgeDollarSign],
];
function Ajuda(){const [q,setQ]=useState(''); const filtered=useMemo(()=>helpItems.filter(([a,b])=>(a+' '+b).toLowerCase().includes(q.toLowerCase())),[q]); return <>
  <div className="help-hero"><small>Central de ajuda</small><h1>Como podemos ajudar?</h1><p>Encontre respostas rápidas para configurar e usar a PontoView.</p><label className="search"><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar na ajuda..."/></label></div>
  <section className="onboarding panel"><div className="panel-title"><div><h2>Primeiros passos</h2><p>Deixe sua primeira tela pronta em poucos minutos.</p></div><span className="pill">3 de 5 concluídos</span></div><div className="onboarding-progress"><i/></div><div className="steps">{[['Conta criada',true],['Google Drive conectado',true],['Primeiro conteúdo adicionado',true],['Criar primeira playlist',false],['Conectar primeira tela',false]].map(([s,done],i)=><span key={String(s)} className={done?'done':''}><b>{done?<Check size={14}/>:i+1}</b>{s}</span>)}</div></section>
  <section className="how"><div className="section-head"><small>COMO FUNCIONA</small><h2>Do seu Drive para a tela, sem complicação.</h2><p>A PontoView organiza a exibição. Seus arquivos continuam armazenados com você.</p></div><div className="flow"><article><span>01</span><Cloud/><h3>Conecte</h3><p>Use seus arquivos do Google Drive.</p></article><ChevronRight/><article><span>02</span><ListVideo/><h3>Organize</h3><p>Monte playlists com conteúdos e Apps.</p></article><ChevronRight/><article><span>03</span><CalendarClock/><h3>Programe</h3><p>Defina quando cada conteúdo aparece.</p></article><ChevronRight/><article><span>04</span><Monitor/><h3>Exiba</h3><p>As telas sincronizam automaticamente.</p></article></div></section>
  <div className="help-grid">{filtered.map(([title,text,I])=><article className="help-card" key={String(title)}><span><I size={20}/></span><div><h2>{title}</h2><p>{text}</p></div><ChevronRight size={18}/></article>)}</div>
</>}

function Suporte(){const [sent,setSent]=useState(false); const submit=(e:FormEvent)=>{e.preventDefault();setSent(true)}; return <><Head eyebrow="Atendimento" title="Contato e suporte" text="Conte com a PontoView para questões técnicas, financeiras ou comerciais."/><div className="support-grid"><section className="support-options"><article className="panel"><span className="support-icon"><Monitor size={21}/></span><h2>Suporte técnico</h2><p>Ajuda com telas, conteúdos, playlists e configurações.</p></article><article className="panel"><span className="support-icon"><BadgeDollarSign size={21}/></span><h2>Financeiro</h2><p>Dúvidas sobre plano, cobrança ou pagamento.</p></article><article className="panel"><span className="support-icon"><Users size={21}/></span><h2>Comercial</h2><p>Novas telas, upgrades e soluções personalizadas.</p></article></section><form className="panel support-form" onSubmit={submit}><div className="panel-title"><div><h2>Enviar solicitação</h2><p>Descreva o que precisa. Dados da conta serão anexados automaticamente.</p></div></div>{sent?<div className="success-box"><Check size={24}/><h3>Solicitação registrada</h3><p>Seu pedido foi preparado para envio ao canal de suporte.</p><button type="button" className="btn secondary" onClick={()=>setSent(false)}>Enviar outra</button></div>:<><label>Assunto<select defaultValue="Suporte técnico"><option>Suporte técnico</option><option>Financeiro</option><option>Comercial</option><option>Outro assunto</option></select></label><label>Tela relacionada<select defaultValue=""><option value="">Nenhuma / não se aplica</option><option>Recepção principal</option><option>Sala de espera</option><option>Refeitório</option><option>Auditório</option></select></label><label>Mensagem<textarea required rows={6} placeholder="Conte o que está acontecendo..."/></label><div className="context-box"><b>Informações incluídas automaticamente</b><span>Empresa demonstração · Plano Pro · Navegador atual · Data e hora</span></div><button className="btn primary" type="submit">Enviar solicitação</button></>}</form></div></>}

function Configuracoes(){return <><Head eyebrow="Preferências" title="Configurações" text="Ajuste comportamento, identidade e segurança da PontoView."/><div className="settings-grid"><section className="panel form-card"><div className="panel-title"><div><h2>Preferências do Player</h2><p>Comportamento padrão para novas telas</p></div></div><label>Duração padrão de imagens<select defaultValue="15"><option value="10">10 segundos</option><option value="15">15 segundos</option><option value="20">20 segundos</option><option value="30">30 segundos</option></select></label><label>Transição<select defaultValue="suave"><option value="suave">Suave</option><option value="direta">Direta</option></select></label><button className="btn primary">Salvar preferências</button></section><section className="panel"><div className="panel-title"><div><h2>Segurança</h2><p>Proteção da organização</p></div></div><div className="setting-row"><ShieldCheck size={20}/><span><b>Isolamento por organização</b><small>Dados separados por tenant e políticas RLS</small></span><span className="status active">Ativo</span></div><div className="setting-row"><Cloud size={20}/><span><b>Google Drive</b><small>Arquivos permanecem no armazenamento do cliente</small></span><span className="pill">Preparado</span></div></section></div></>}

function Player(){const {screenId}=useParams();return <div className="player"><div className="player-mark">P</div><small>PontoView Player</small><strong>{screenId}</strong><span>Aguardando sincronização da playlist</span></div>}

export default function App(){return <Routes>
  <Route path="/player/:screenId" element={<Player/>}/>
  <Route path="/" element={<Shell/>}>
    <Route index element={<Navigate to="/dashboard" replace/>}/>
    <Route path="dashboard" element={<Dashboard/>}/><Route path="conteudo" element={<Conteudo/>}/><Route path="playlists" element={<Playlists/>}/><Route path="programacoes" element={<Programacoes/>}/><Route path="telas" element={<Telas/>}/><Route path="apps" element={<Apps/>}/><Route path="conta" element={<Conta/>}/><Route path="financeiro" element={<Financeiro/>}/><Route path="ajuda" element={<Ajuda/>}/><Route path="suporte" element={<Suporte/>}/><Route path="configuracoes" element={<Configuracoes/>}/>
  </Route>
</Routes>}
