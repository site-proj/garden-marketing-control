'use client';
import {useEffect,useMemo,useState} from 'react';
import {initializeApp,getApp,getApps} from 'firebase/app';
import {getAuth,onAuthStateChanged,User} from 'firebase/auth';
import {doc,getFirestore,onSnapshot,setDoc} from 'firebase/firestore';
import {ArrowLeft,ArrowUpRight,BarChart3,CheckCircle2,Cloud,Download,FileUp,Plus,ShieldCheck,Target,Trash2,Activity,ScanLine,Star,ChevronRight} from 'lucide-react';
import {ResponsiveContainer,CartesianGrid,Tooltip,XAxis,YAxis,ComposedChart,Bar,Line} from 'recharts';
import './analytics.css';

const config={apiKey:process.env.NEXT_PUBLIC_FIREBASE_API_KEY,authDomain:process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,appId:process.env.NEXT_PUBLIC_FIREBASE_APP_ID,messagingSenderId:process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,storageBucket:process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET};
const enabled=Boolean(config.apiKey&&config.appId&&config.projectId);
const app=enabled?(getApps().length?getApp():initializeApp(config)):null;
const auth=app?getAuth(app):null;
const db=app?getFirestore(app):null;
const BASE='/garden-marketing-control/';
type Entry={id:string,date:string,scans:number,reviews?:number,total?:number,rating?:string,notes?:string,recordedAt?:string};
type FormData={date:string,scans:string,reviews:string,total:string,rating:string,notes:string};
const emptyForm=():FormData=>({date:new Date().toISOString().slice(0,10),scans:'',reviews:'',total:'',rating:'',notes:''});
const fmt=(n:number)=>n.toLocaleString('pt-BR');
const pct=(n:number)=>n.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const dateLabel=(date:string)=>new Date(date+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
const num=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:undefined;
function calculated(entries:Entry[]){
 const ordered=[...entries].sort((a,b)=>a.date.localeCompare(b.date));
 return ordered.map((e,i)=>{
   const previous=ordered[i-1];
   const adjacent=previous&&Math.round((new Date(e.date+'T12:00:00').getTime()-new Date(previous.date+'T12:00:00').getTime())/86400000)===1;
   const direct=num(e.reviews);
   const delta=adjacent&&num(e.total)!==undefined&&num(previous?.total)!==undefined?Number(e.total)-Number(previous.total):undefined;
   return {...e,derivedReviews:direct===undefined?delta:direct};
 });
}
function escapeCSV(value:unknown){const v=String(value??'');return '"'+v.replace(/"/g,'""')+'"';}
function saveDownload(content:string,name:string,type:string){const url=URL.createObjectURL(new Blob(['\uFEFF'+content],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
function parseCsv(text:string){
 const rows:string[][]=[];const delimiter=(text.split(/\r?\n/,1)[0]||'').includes(';')?';':',';
 let row:string[]=[],part='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){part+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(part.trim());part='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(part.trim());if(row.some(x=>x!==''))rows.push(row);row=[];part='';}else part+=c;}
 if(part||row.length){row.push(part.trim());rows.push(row);}
 return rows;
}
export default function AnalyticsPage(){
 const [user,setUser]=useState<User|null>(null),[checked,setChecked]=useState(false),[entries,setEntries]=useState<Entry[]>([]);
 const [form,setForm]=useState<FormData>(emptyForm),[sync,setSync]=useState('Conectando…'),[saving,setSaving]=useState(false);
 const [days,setDays]=useState(30),[csvResult,setCsvResult]=useState<{scans:number,rows:number}|null>(null),[csvMessage,setCsvMessage]=useState('');
 useEffect(()=>{if(!auth){setChecked(true);setSync('Firebase não configurado');return;}return onAuthStateChanged(auth,u=>{setUser(u);setChecked(true)})},[]);
 useEffect(()=>{if(!user||!db)return;setSync('Carregando');return onSnapshot(doc(db,'users',user.uid,'data','analytics'),snapshot=>{const value=snapshot.data();setEntries(Array.isArray(value?.entries)?value.entries:[]);setSync('Sincronizado')},()=>setSync('Falha na sincronização — verifique o acesso'))},[user]);
 const ordered=useMemo(()=>calculated(entries),[entries]);
 const selected=useMemo(()=>{if(days===0)return ordered;const now=Date.now(),limit=days*86400000;return ordered.filter(e=>{const diff=now-new Date(e.date+'T12:00:00').getTime();return diff<=limit&&diff>=-86400000;})},[ordered,days]);
 const sumScans=selected.reduce((v,e)=>v+Number(e.scans||0),0);
 const comparable=selected.filter(e=>typeof e.derivedReviews==='number'&&e.derivedReviews>=0);
 const comparableScans=comparable.reduce((v,e)=>v+Number(e.scans||0),0);
 const reviewCount=comparable.reduce((v,e)=>v+Number(e.derivedReviews||0),0);
 const ratio=comparableScans>0?comparableScans/reviewCount:null;
 const conversion=comparableScans>0?pct(reviewCount/comparableScans*100):'—';
 const latest=[...ordered].reverse().find(e=>num(e.total)!==undefined);
 const lastRating=[...ordered].reverse().find(e=>e.rating)?.rating||'—';
 const goals=[1500,2000].map(target=>({target,remaining:latest?Math.max(0,target-Number(latest.total)):null,percentage:latest?Math.min(100,Number(latest.total)/target*100):0}));
 const chart=selected.map(e=>({name:dateLabel(e.date),scans:e.scans,reviews:typeof e.derivedReviews==='number'&&e.derivedReviews>=0?e.derivedReviews:null}));
 async function store(next:Entry[]){if(!user||!db)return;setSaving(true);setSync('Salvando…');try{await setDoc(doc(db,'users',user.uid,'data','analytics'),{entries:next,updatedAt:new Date().toISOString()});setSync('Sincronizado')}catch(err){setSync('Erro ao salvar — confira as permissões');alert('Não foi possível salvar. Tente novamente.')}finally{setSaving(false)}}
 function add(e:React.FormEvent){e.preventDefault();const scans=Number(form.scans),reviews=form.reviews===''?undefined:Number(form.reviews),total=form.total===''?undefined:Number(form.total);if(!form.date||form.scans===''||!Number.isInteger(scans)||scans<0||(reviews!==undefined&&(!Number.isInteger(reviews)||reviews<0))||(total!==undefined&&(!Number.isInteger(total)||total<0))){alert('Confira a data e os números não negativos.');return;}
 const old=entries.find(x=>x.date===form.date);if(old&&!window.confirm('Já existe registro para essa data. Deseja substituí-lo?'))return;
 const entry:Entry={id:old?.id||crypto.randomUUID(),date:form.date,scans,reviews,total,rating:form.rating.trim(),notes:form.notes.trim(),recordedAt:new Date().toISOString()};
 void store([...entries.filter(x=>x.date!==form.date),entry]);setForm(emptyForm);}
 function exportHistory(){const headers=['data','scans_dia','novas_avaliacoes_informadas','total_avaliacoes_google','nota_google','observacoes'];const rows=[...entries].sort((a,b)=>a.date.localeCompare(b.date)).map(x=>[x.date,x.scans,x.reviews??'',x.total??'',x.rating??'',x.notes??'']);saveDownload([headers,...rows].map(row=>row.map(escapeCSV).join(';')).join('\r\n'),'garden-analytics-historico.csv','text/csv;charset=utf-8');}
 async function importCsv(file?:File){setCsvResult(null);setCsvMessage('');if(!file)return;try{const rows=parseCsv((await file.text()).replace(/^\uFEFF/,''));const head=(rows[0]||[]).map(x=>x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''));const idx=head.findIndex(x=>x.includes('scan'));if(idx<0){setCsvMessage('Nenhuma coluna de scans encontrada no relatório.');return;}let total=0,count=0;for(const row of rows.slice(1)){const raw=(row[idx]||'').replace(/\s/g,'');if(!raw)continue;const n=Number(raw.replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.'));if(Number.isFinite(n)&&n>=0){total+=n;count++;}}setCsvResult({scans:total,rows:count});setCsvMessage('Prévia importada. Confira o período antes de adicionar ao registro.')}catch{setCsvMessage('Não foi possível ler o CSV. Confira o arquivo.');}}
 const metrics=[
  {label:'Scans registrados',value:fmt(sumScans),desc:'Leituras informadas no período',Icon:ScanLine},
  {label:'Avaliações comparáveis',value:comparable.length?fmt(reviewCount):'—',desc:'Contagens verificáveis no período',Icon:Star},
  {label:'Relação estimada',value:conversion,desc:'Avaliações / scans comparáveis',Icon:Activity},
  {label:'Scans por avaliação',value:ratio!==null&&Number.isFinite(ratio)&&reviewCount>0?ratio.toLocaleString('pt-BR',{maximumFractionDigits:1}):'—',desc:'Indicador indicativo, sem atribuição',Icon:BarChart3}
 ];
 return <div className="analytics-root">
  <header className="a-top"><div className="a-top-in">
   <a className="a-brand" href={BASE} aria-label="Garden Studio — página inicial">
    <span className="a-brand-word">GARDEN <span className="a-brand-slash">/</span> <span className="a-brand-studio">STUDIO</span></span>
    <span className="a-brand-caption">CENTRAL DE INTELIGÊNCIA</span>
   </a>
   <nav className="a-top-links" aria-label="Navegação do Analytics">
    <a href="#indicadores">Indicadores</a><a href="#registros">Registros</a><a href="#metas">Metas</a>
   </nav>
   <div className="a-header-actions">
    <a className="a-top-new" href="#registros" aria-label="Ir para novo registro"><Plus size={16}/><span>Novo registro</span></a>
    <a className="a-return" href={BASE}><ArrowLeft size={16}/><span className="a-return-long">Marketing Control</span><span className="a-return-short">Voltar</span></a>
   </div>
  </div></header>
  <section className="a-hero"><div className="a-frame a-hero-in">
   <div className="a-eyebrow">Reputação &amp; desempenho · Garden Café</div>
   <h1>Garden <em>Analytics.</em></h1>
   <p>Avaliações Google, scans de QR Code e metas em uma visão clara para orientar suas decisões.</p>
   <div className="a-hero-footer"><span className="a-chip"><span className="a-chip-dot"/>{checked?(user?'Acesso autenticado':'Aguardando login'):'Verificando acesso'}</span><span className="a-chip"><Cloud size={14}/> {sync}</span><span className="a-hero-note">Dados manuais · API Google pendente</span></div>
  </div></section>
  <main className="a-main a-frame">
  {!checked?<section className="a-card" style={{marginTop:-68,position:'relative'}}>Verificando autenticação…</section>:!user?<section className="a-card" style={{marginTop:-68,position:'relative',maxWidth:620}}><h2>Área privada</h2><p className="a-sub" style={{margin:'14px 0 20px'}}>Entre no Garden Studio com seu e-mail e senha para acessar o Analytics.</p><a className="a-btn" href={BASE}>Entrar no Studio <ChevronRight size={17}/></a></section>:<>
   <section className="a-kpis" aria-label="Resumo dos resultados">{metrics.map(x=><div className="a-kpi" key={x.label}><div className="a-kpi-label"><span>{x.label}</span><span className="a-kpi-icon"><x.Icon size={17}/></span></div><strong>{x.value}</strong><small>{x.desc}</small></div>)}</section>
   <div className="a-pagehead" id="indicadores"><div><span className="a-eyebrow">Performance em foco</span><h2>Visão dos resultados.</h2><p className="a-sub">Evolução com base nas informações registradas, sem dados fictícios.</p></div><div className="a-ctrls" aria-label="Filtrar período">{[{n:7,label:'7 dias'},{n:30,label:'30 dias'},{n:90,label:'90 dias'},{n:0,label:'Tudo'}].map(d=><button key={d.n} className={days===d.n?'active':''} onClick={()=>setDays(d.n)}>{d.label}</button>)}</div></div>
   <div className="a-grid">
    <section className="a-card"><div className="a-card-title"><div><h3>Evolução da reputação</h3><p>Scans de QR Code e novas avaliações informadas</p></div><span className="a-card-label">Por período</span></div><div className="a-chart">{chart.length>=2?<ResponsiveContainer width="100%" height="100%"><ComposedChart data={chart} margin={{top:12,right:5,bottom:0,left:0}}><CartesianGrid stroke="#eaf0e8" vertical={false}/><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#87998b'}}/><YAxis yAxisId="scans" tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#87998b'}}/><YAxis yAxisId="reviews" orientation="right" tickLine={false} axisLine={false} tick={{fontSize:11,fill:'#a58d60'}}/><Tooltip contentStyle={{border:'1px solid #e8eee6',borderRadius:12,fontSize:12}}/><Bar yAxisId="scans" dataKey="scans" name="Scans" fill="#315c42" radius={[5,5,0,0]} maxBarSize={26}/><Line yAxisId="reviews" type="monotone" dataKey="reviews" name="Avaliações" stroke="#ba9863" strokeWidth={3} dot={{r:3}} connectNulls={false}/></ComposedChart></ResponsiveContainer>:<div className="a-chart-empty">Registre pelo menos dois períodos para visualizar a evolução.</div>}</div><div className="a-key"><span><i style={{background:'#315c42'}}/>Scans</span><span><i style={{background:'#ba9863'}}/>Avaliações informadas</span></div></section>
    <div className="a-sidegrid">
     <section className="a-card" id="metas"><div className="a-card-title"><div><h3>Metas de reputação</h3><p>Acompanhamento do total acumulado no Google</p></div><Target color="#497757" size={20}/></div><div className="a-goals">{goals.map(g=><div className="a-goal" key={g.target}><div className="a-goal-top"><strong>{fmt(g.target)} avaliações</strong><span>{latest?pct(g.percentage):'Sem base'}</span></div><div className="a-progress"><span style={{width:g.percentage+'%'}}/></div><small>{g.remaining===null?'Informe o total Google para calcular':g.remaining===0?'Meta alcançada':'Faltam '+fmt(g.remaining)+' avaliações'}</small></div>)}</div><p className="a-note">Total Google registrado: {latest?fmt(Number(latest.total)):'não informado'} · Nota: {lastRating}</p></section>
     <section className="a-card a-source"><span className="a-src-status">Integração automática pendente</span><h3>Google Reviews</h3><p>A aprovação e autorização da API do Perfil da Empresa no Google ainda precisam ser confirmadas. A coleta de scans também depende de uma fonte autorizada.</p><p style={{marginTop:14}}>A rotina de 02h não realiza a coleta nesta versão.</p></section>
    </div>
   </div>
   <div className="a-pagehead" id="registros"><div><span className="a-eyebrow">Controle operacional</span><h2>Registre. Compare. Evolua.</h2><p className="a-sub">Os dados são salvos no Firebase da sua conta, separados do Marketing Control.</p></div></div>
   <div className="a-second-grid">
    <section className="a-card"><div className="a-card-title"><div><h3>Adicionar registro</h3><p>Você pode informar avaliações do dia e o total acumulado</p></div><Plus size={20} color="#497757"/></div><form className="a-form" onSubmit={add}>
     <label>Data<input type="date" required value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label>
     <label>Scans no período<input type="number" min="0" required value={form.scans} onChange={e=>setForm({...form,scans:e.target.value})} placeholder="Ex.: 85"/></label>
     <label>Novas avaliações (opcional)<input type="number" min="0" value={form.reviews} onChange={e=>setForm({...form,reviews:e.target.value})} placeholder="Ex.: 12"/></label>
     <label>Total Google acumulado (opcional)<input type="number" min="0" value={form.total} onChange={e=>setForm({...form,total:e.target.value})} placeholder="Ex.: 1062"/></label>
     <label className="a-wide">Nota exibida (opcional)<input type="text" value={form.rating} onChange={e=>setForm({...form,rating:e.target.value})} placeholder="Ex.: 4,7"/></label>
     <label className="a-wide">Fonte e observações<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Período de coleta, origem dos scans e observações importantes"/></label>
     <button className="a-btn a-wide" disabled={saving} type="submit"><Plus size={16}/>{saving?'Salvando…':'Salvar registro no Firebase'}</button>
    </form><p className="a-note">A variação entre totais Google só é calculada se houver registros de dias consecutivos. Não confunda variação líquida com o número exato de novas avaliações.</p></section>
    <section className="a-card"><div className="a-card-title"><div><h3>Importar relatório</h3><p>Leitura de CSV de scans, sem alterar seus registros automaticamente</p></div><FileUp size={20} color="#497757"/></div><div className="a-csv"><FileUp size={28} color="#598469"/><p>Selecione um relatório CSV do sistema de QR Code</p><input type="file" accept=".csv,text/csv" onChange={e=>{void importCsv(e.target.files?.[0]);e.currentTarget.value='';}}/><p>Detectamos a coluna de scans para apresentar uma prévia.</p></div>{csvMessage&&<div className="a-csv-result">{csvMessage}{csvResult&&<><br/><strong>{fmt(csvResult.scans)} scans</strong> em {csvResult.rows} linhas processadas.<div className="a-actions"><button className="a-btn a-btn-outline" type="button" onClick={()=>setForm({...form,scans:String(csvResult.scans)})}>Utilizar no formulário</button></div></>}</div>}
    <div className="a-actions"><button type="button" className="a-btn a-btn-outline" onClick={exportHistory}><Download size={15}/> Exportar histórico CSV</button></div>
    <p className="a-note">O relatório é processado apenas no navegador; ele não é enviado automaticamente para o Firebase. Confirme se contém apenas linhas pertinentes ao período escolhido.</p></section>
   </div>
   <section className="a-card a-table-card" id="historico"><div className="a-card-title"><div><h3>Histórico de performance</h3><p>Registros manuais sincronizados entre seus computadores</p></div><span className="a-card-label">{entries.length} registros</span></div><div className="a-tablewrap"><table className="a-table"><thead><tr><th>Data</th><th>Scans</th><th>Avaliações informadas</th><th>Total Google</th><th>Nota</th><th>Fonte</th><th></th></tr></thead><tbody>{[...entries].sort((a,b)=>b.date.localeCompare(a.date)).map(e=><tr key={e.id}><td><strong>{new Date(e.date+'T12:00:00').toLocaleDateString('pt-BR')}</strong></td><td>{fmt(Number(e.scans||0))}</td><td>{num(e.reviews)!==undefined?fmt(Number(e.reviews)):'—'}</td><td>{num(e.total)!==undefined?fmt(Number(e.total)):'—'}</td><td>{e.rating||'—'}</td><td>{e.notes||'—'}</td><td><button disabled={saving} title="Excluir registro" aria-label="Excluir registro" className="a-delete" onClick={()=>{if(window.confirm('Excluir este registro do Firebase?'))void store(entries.filter(x=>x.id!==e.id));}}><Trash2 size={16}/></button></td></tr>)}{!entries.length&&<tr><td className="a-empty" colSpan={7}>Nenhum registro ainda. Comece pelo formulário acima.</td></tr>}</tbody></table></div><p className="a-note">Scans não equivalem a avaliações publicadas. A relação mostrada é estimativa por período, não atribuição individual por garçom.</p></section>
  </>}
  </main><footer className="a-foot"><div className="a-frame a-foot-inner"><span>GARDEN / STUDIO · Analytics</span><span>Onde os momentos florescem.</span></div></footer>
 </div>;
}
