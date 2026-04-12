const { useState, useEffect, useMemo } = React;
const { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
        ResponsiveContainer, ReferenceLine, BarChart, Bar } = Recharts;

// ── Utilities ─────────────────────────────────────────────────────────────────
const fmt     = n => new Intl.NumberFormat("he-IL",{style:"currency",currency:"ILS",minimumFractionDigits:0,maximumFractionDigits:0}).format(n||0);
const fmtDate = d => d ? new Date(d).toLocaleDateString("he-IL",{day:"2-digit",month:"2-digit",year:"numeric"}) : "—";
const toISO   = d => { if(!d) return ""; const dt=d instanceof Date?d:new Date(d); return isNaN(dt)?"":dt.toISOString().split("T")[0]; };
const addDays = (d,n) => { const r=new Date(d); r.setDate(r.getDate()+n); return r; };
const eom     = d => { const dt=new Date(d); return new Date(dt.getFullYear(),dt.getMonth()+1,0); };
const uid     = () => Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const excelDate = v => { if(!v) return ""; if(v instanceof Date) return toISO(v); if(typeof v==="number") return toISO(new Date(Math.round((v-25569)*86400000))); return toISO(new Date(v)); };
const typeLabel = t => ({check:"המחאה",invoice:"חשבונית",income:"הכנסה",fixed:"הוצאה קבועה"}[t]||t);

// ── localStorage storage (sync) ───────────────────────────────────────────────
const lsLoad = (k,fb) => { try{ const v=localStorage.getItem(k); return v?JSON.parse(v):fb; }catch{ return fb; } };
const lsSave = (k,v)  => { try{ localStorage.setItem(k,JSON.stringify(v)); }catch{} };

// ── Tab config ────────────────────────────────────────────────────────────────
const TABS = [
  {id:"dashboard",icon:"📊",label:"דשבורד"},
  {id:"forecast", icon:"📅",label:"תזרים עתידי"},
  {id:"suppliers",icon:"🏢",label:"ספקים"},
  {id:"ledger",   icon:"📒",label:"כרטסת ספק"},
  {id:"aging",    icon:"⏱", label:"גיול חשבוניות"},
  {id:"import",   icon:"📥",label:"יבוא נתונים"},
  {id:"recurring",icon:"🔄",label:"קבועות"},
];

// ── Root ──────────────────────────────────────────────────────────────────────
function App() {
  const [tab,setTab]               = useState("dashboard");
  const [suppliers,setSuppliers]   = useState(()=>lsLoad("cf-sup",[]));
  const [checks,setChecks]         = useState(()=>lsLoad("cf-chk",[]));
  const [invoices,setInvoices]     = useState(()=>lsLoad("cf-inv",[]));
  const [fixedItems,setFixedItems] = useState(()=>lsLoad("cf-fix",[]));
  const [openingBal,setOpeningBal] = useState(()=>lsLoad("cf-ob",0));
  const [selSup,setSelSup]         = useState(null);

  useEffect(()=>lsSave("cf-sup",suppliers),[suppliers]);
  useEffect(()=>lsSave("cf-chk",checks),[checks]);
  useEffect(()=>lsSave("cf-inv",invoices),[invoices]);
  useEffect(()=>lsSave("cf-fix",fixedItems),[fixedItems]);
  useEffect(()=>lsSave("cf-ob",openingBal),[openingBal]);

  const today = useMemo(()=>{ const d=new Date(); d.setHours(0,0,0,0); return d; },[]);

  const forecast = useMemo(()=>{
    const DAYS=120, events=[];
    checks.forEach(c=>{ if(!c.date) return; const d=new Date(c.date); d.setHours(0,0,0,0); if(d>=today) events.push({date:toISO(d),amount:-Math.abs(c.amount||0),type:"check",label:c.supplierName||"המחאה"}); });
    invoices.forEach(inv=>{ if(!inv.date) return; const sup=suppliers.find(s=>s.id===inv.supplierId||s.name===inv.supplierName); const terms=sup?(sup.paymentTerms||30):30; const pay=addDays(eom(new Date(inv.date)),terms); if(pay>=today) events.push({date:toISO(pay),amount:-Math.abs(inv.amount||0),type:"invoice",label:inv.supplierName||"חשבונית"}); });
    for(let i=0;i<DAYS;i++){ const d=addDays(today,i); fixedItems.forEach(fi=>{ const sign=fi.type==="income"?1:-1; if(fi.recurrence==="monthly"&&d.getDate()===(fi.dayOfMonth||1)) events.push({date:toISO(d),amount:sign*Math.abs(fi.amount||0),type:fi.type==="income"?"income":"fixed",label:fi.name}); else if(fi.recurrence==="once"&&toISO(d)===fi.date) events.push({date:toISO(d),amount:sign*Math.abs(fi.amount||0),type:fi.type==="income"?"income":"fixed",label:fi.name}); }); }
    events.sort((a,b)=>a.date.localeCompare(b.date));
    const byDate={}; events.forEach(e=>{(byDate[e.date]=byDate[e.date]||[]).push(e);});
    let bal=openingBal; const chartData=[];
    for(let i=0;i<DAYS;i++){ const d=addDays(today,i),key=toISO(d); (byDate[key]||[]).forEach(e=>{bal+=e.amount;}); chartData.push({date:key,balance:Math.round(bal),label:d.toLocaleDateString("he-IL",{day:"numeric",month:"short"})}); }
    const negDays=chartData.filter(c=>c.balance<0).map(c=>c.date);
    const minBal=chartData.length?Math.min(...chartData.map(c=>c.balance)):0;
    return {events,byDate,chartData,negDays,minBal};
  },[checks,invoices,suppliers,fixedItems,openingBal,today]);

  const kpis = useMemo(()=>({
    ob:openingBal,
    totalChecks:checks.reduce((s,c)=>s+(c.amount||0),0),
    totalInvoices:invoices.reduce((s,i)=>s+(i.amount||0),0),
    supCount:suppliers.length,
    minForecast:forecast.minBal,
    negDays:forecast.negDays.length,
  }),[checks,invoices,suppliers,openingBal,forecast]);

  const ctx={suppliers,setSuppliers,checks,setChecks,invoices,setInvoices,fixedItems,setFixedItems,openingBal,setOpeningBal,forecast,kpis,selSup,setSelSup,setTab,today};

  return (
    <div style={{display:"flex",height:"100vh",overflow:"hidden"}}>
      <nav style={{width:220,background:"#05090f",borderLeft:"1px solid var(--bd)",display:"flex",flexDirection:"column",flexShrink:0,overflow:"auto"}}>
        <div style={{padding:"20px 16px 16px",borderBottom:"1px solid var(--bd)"}}>
          <div style={{fontSize:9,color:"var(--mu)",letterSpacing:3,marginBottom:4}}>ניהול תזרים מזומנים</div>
          <div style={{fontSize:19,fontWeight:900,color:"var(--gold)",letterSpacing:-.5}}>CashFlow Pro</div>
        </div>
        <div style={{flex:1,padding:"10px 8px",display:"flex",flexDirection:"column",gap:2}}>
          {TABS.map(t=>{
            const act=tab===t.id;
            return <button key={t.id} onClick={()=>setTab(t.id)} style={{background:act?"var(--glow)":"transparent",color:act?"var(--gold)":"var(--mu2)",border:"none",borderRadius:9,padding:"9px 12px",textAlign:"right",fontSize:13.5,fontWeight:act?700:400,display:"flex",alignItems:"center",gap:9,cursor:"pointer",borderRight:act?"2px solid var(--gold)":"2px solid transparent",transition:"all .15s"}}>
              <span style={{fontSize:16}}>{t.icon}</span>{t.label}
            </button>;
          })}
        </div>
        <div style={{padding:"10px 12px 16px",display:"flex",flexDirection:"column",gap:8}}>
          {kpis.negDays>0&&<div style={{padding:"9px 12px",background:"rgba(224,84,84,.07)",border:"1px solid rgba(224,84,84,.2)",borderRadius:9}}><div style={{fontSize:11,color:"var(--err)",fontWeight:700}}>⚠ {kpis.negDays} ימי חוסר צפויים</div></div>}
          <div style={{padding:"9px 12px",background:"var(--glow)",border:"1px solid rgba(212,168,83,.15)",borderRadius:9}}>
            <div style={{fontSize:10,color:"var(--mu)",marginBottom:3}}>יתרה נוכחית</div>
            <div className="mono" style={{fontSize:14,fontWeight:700,color:openingBal>=0?"var(--ok)":"var(--err)"}}>{fmt(openingBal)}</div>
          </div>
        </div>
      </nav>
      <main style={{flex:1,overflow:"auto",padding:"26px 32px"}}>
        {tab==="dashboard"&&<Dashboard ctx={ctx}/>}
        {tab==="forecast" &&<ForecastTab ctx={ctx}/>}
        {tab==="suppliers"&&<SuppliersTab ctx={ctx}/>}
        {tab==="ledger"   &&<LedgerTab ctx={ctx}/>}
        {tab==="aging"    &&<AgingTab ctx={ctx}/>}
        {tab==="import"   &&<ImportTab ctx={ctx}/>}
        {tab==="recurring"&&<RecurringTab ctx={ctx}/>}
      </main>
    </div>
  );
}

// ── Shared ────────────────────────────────────────────────────────────────────
function Modal({title,onClose,children}){
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div className="card" style={{width:440,padding:28,boxShadow:"0 24px 64px rgba(0,0,0,.6)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h3 style={{fontSize:16,fontWeight:700}}>{title}</h3>
        <button className="btn-g" style={{padding:"4px 10px",fontSize:16}} onClick={onClose}>✕</button>
      </div>
      {children}
    </div>
  </div>;
}

function KpiCard({icon,label,value,color,onClick,note}){
  return <div className="card" onClick={onClick} style={{padding:"18px 20px",cursor:onClick?"pointer":"default",transition:"border-color .2s"}} onMouseEnter={e=>onClick&&(e.currentTarget.style.borderColor="var(--gold)")} onMouseLeave={e=>(e.currentTarget.style.borderColor="var(--bd)")}>
    <div style={{fontSize:24,marginBottom:10}}>{icon}</div>
    <div className="mono" style={{fontSize:18,fontWeight:700,color:color||"var(--tx)"}}>{value}</div>
    <div style={{fontSize:12,color:"var(--mu2)",marginTop:5}}>{label}</div>
    {note&&<div style={{fontSize:10,color:"rgba(212,168,83,.4)",marginTop:4}}>{note}</div>}
  </div>;
}

function ChartTip({active,payload}){
  if(!active||!payload?.length) return null;
  const v=payload[0].value;
  return <div style={{background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:9,padding:"10px 14px"}}>
    <div style={{fontSize:11,color:"var(--mu2)",marginBottom:3}}>{payload[0]?.payload?.label}</div>
    <div className="mono" style={{fontSize:15,fontWeight:700,color:v>=0?"var(--ok)":"var(--err)"}}>{fmt(v)}</div>
  </div>;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ctx}){
  const {kpis,forecast,openingBal,setOpeningBal,checks,invoices}=ctx;
  const [editBal,setEditBal]=useState(false);
  const [balVal,setBalVal]=useState(openingBal);

  const monthlyBars=useMemo(()=>{
    const now=new Date();
    return Array.from({length:6},(_,i)=>{
      const d=new Date(now.getFullYear(),now.getMonth()-5+i,1);
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      const label=d.toLocaleDateString("he-IL",{month:"short",year:"2-digit"});
      return {label,inv:invoices.filter(x=>x.date?.startsWith(key)).reduce((s,x)=>s+(x.amount||0),0),chk:checks.filter(x=>x.date?.startsWith(key)).reduce((s,x)=>s+(x.amount||0),0)};
    });
  },[invoices,checks]);

  return <div>
    <h1>דשבורד</h1>
    <div className="sub">סקירה כללית ותחזית תזרים</div>
    <div className="g3" style={{marginBottom:20}}>
      <KpiCard icon="💰" label="יתרה נוכחית" value={fmt(kpis.ob)} color={kpis.ob>=0?"var(--ok)":"var(--err)"} onClick={()=>{setBalVal(kpis.ob);setEditBal(true);}} note="לחץ לעדכון"/>
      <KpiCard icon="🧾" label="סה״כ חשבוניות" value={fmt(kpis.totalInvoices)} color="var(--warn)"/>
      <KpiCard icon="📄" label="סה״כ המחאות" value={fmt(kpis.totalChecks)} color="var(--inf)"/>
      <KpiCard icon="⏳" label="יתרה לתשלום" value={fmt(Math.max(0,kpis.totalInvoices-kpis.totalChecks))} color="var(--err)"/>
      <KpiCard icon={kpis.minForecast<0?"⚠":"✅"} label="מינימום תחזית 120י׳" value={fmt(kpis.minForecast)} color={kpis.minForecast<0?"var(--err)":"var(--ok)"}/>
      <KpiCard icon="🏢" label="ספקים פעילים" value={kpis.supCount} color="var(--mu2)"/>
    </div>

    {editBal&&<Modal title="עדכון יתרת חשבון בנק" onClose={()=>setEditBal(false)}>
      <label>יתרה נוכחית (₪)</label>
      <input type="number" value={balVal} onChange={e=>setBalVal(+e.target.value)} style={{marginBottom:16}} autoFocus/>
      <div style={{display:"flex",gap:8}}>
        <button className="btn-p" onClick={()=>{setOpeningBal(+balVal);setEditBal(false);}}>שמור</button>
        <button className="btn-g" onClick={()=>setEditBal(false)}>ביטול</button>
      </div>
    </Modal>}

    <div className="card" style={{padding:"22px 24px",marginBottom:18}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <h2 style={{fontSize:15,fontWeight:700}}>תחזית תזרים — 120 ימים קדימה</h2>
        {forecast.negDays.length>0&&<span className="tag t-fixed">⚠ {forecast.negDays.length} ימי חוסר</span>}
      </div>
      <ResponsiveContainer width="100%" height={230}>
        <AreaChart data={forecast.chartData} margin={{top:5,right:5,bottom:0,left:5}}>
          <defs><linearGradient id="gp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#d4a853" stopOpacity={0.25}/><stop offset="95%" stopColor="#d4a853" stopOpacity={0}/></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#172030"/>
          <XAxis dataKey="label" tick={{fill:"#4e6a8a",fontSize:10}} tickLine={false} axisLine={false} interval={14}/>
          <YAxis tick={{fill:"#4e6a8a",fontSize:10}} tickLine={false} axisLine={false} tickFormatter={v=>`₪${(Math.abs(v)/1000).toFixed(0)}K`} width={52}/>
          <Tooltip content={<ChartTip/>}/>
          <ReferenceLine y={0} stroke="#e05454" strokeDasharray="4 4" strokeOpacity={0.5}/>
          <Area type="monotone" dataKey="balance" stroke="#d4a853" strokeWidth={2} fill="url(#gp)" dot={false} activeDot={{r:4,fill:"#d4a853"}}/>
        </AreaChart>
      </ResponsiveContainer>
    </div>

    {monthlyBars.some(m=>m.inv>0||m.chk>0)&&<div className="card" style={{padding:"22px 24px",marginBottom:18}}>
      <h2 style={{fontSize:15,fontWeight:700,marginBottom:18}}>חשבוניות מול תשלומים — 6 חודשים אחרונים</h2>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={monthlyBars} margin={{top:5,right:5,bottom:0,left:5}}>
          <CartesianGrid strokeDasharray="3 3" stroke="#172030"/>
          <XAxis dataKey="label" tick={{fill:"#4e6a8a",fontSize:11}} tickLine={false} axisLine={false}/>
          <YAxis tick={{fill:"#4e6a8a",fontSize:10}} tickLine={false} axisLine={false} tickFormatter={v=>`₪${(v/1000).toFixed(0)}K`} width={52}/>
          <Tooltip formatter={(v,n)=>[fmt(v),n==="inv"?"חשבוניות":"המחאות"]} contentStyle={{background:"var(--s2)",border:"1px solid var(--bd)",borderRadius:8}}/>
          <Bar dataKey="inv" fill="#d4a030" opacity={0.85} radius={[3,3,0,0]}/>
          <Bar dataKey="chk" fill="#4d96e8" opacity={0.85} radius={[3,3,0,0]}/>
        </BarChart>
      </ResponsiveContainer>
      <div style={{display:"flex",gap:18,justifyContent:"center",marginTop:10}}>
        {[["#d4a030","חשבוניות"],["#4d96e8","המחאות"]].map(([c,l])=><div key={l} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"var(--mu2)"}}><div style={{width:10,height:10,borderRadius:2,background:c}}/>{l}</div>)}
      </div>
    </div>}

    {forecast.negDays.length>0&&<div style={{background:"rgba(224,84,84,.04)",border:"1px solid rgba(224,84,84,.18)",borderRadius:12,padding:20}}>
      <h3 style={{color:"var(--err)",fontSize:14,marginBottom:12,fontWeight:700}}>⚠ ימים עם יתרה שלילית</h3>
      <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
        {forecast.negDays.slice(0,18).map(d=><span key={d} style={{background:"rgba(224,84,84,.1)",color:"var(--err)",padding:"3px 10px",borderRadius:999,fontSize:12}}>{fmtDate(d)}</span>)}
        {forecast.negDays.length>18&&<span style={{color:"var(--mu2)",fontSize:12,alignSelf:"center"}}>+{forecast.negDays.length-18} נוספים</span>}
      </div>
    </div>}
  </div>;
}

// ── Forecast Tab ──────────────────────────────────────────────────────────────
function ForecastTab({ctx}){
  const {forecast,openingBal}=ctx;
  const [mode,setMode]=useState("table");
  const [filter,setFilter]=useState("all");

  const rows=useMemo(()=>{
    let bal=openingBal;
    return forecast.events.map(e=>{bal+=e.amount;return{...e,bal};});
  },[forecast.events,openingBal]);

  const filtered=filter==="all"?rows:rows.filter(r=>r.type===filter);

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
      <div><h1>תזרים עתידי</h1><div className="sub">תחזית 120 יום קדימה</div></div>
      <div style={{display:"flex",gap:8}}>
        <button className={mode==="table"?"btn-p":"btn-g"} onClick={()=>setMode("table")}>טבלה</button>
        <button className={mode==="chart"?"btn-p":"btn-g"} onClick={()=>setMode("chart")}>גרף</button>
      </div>
    </div>

    {mode==="chart"&&<div className="card" style={{padding:"22px 24px"}}>
      <ResponsiveContainer width="100%" height={360}>
        <AreaChart data={forecast.chartData} margin={{top:5,right:5,bottom:0,left:5}}>
          <defs><linearGradient id="fg2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#d4a853" stopOpacity={0.25}/><stop offset="95%" stopColor="#d4a853" stopOpacity={0}/></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#172030"/>
          <XAxis dataKey="label" tick={{fill:"#4e6a8a",fontSize:10}} tickLine={false} axisLine={false} interval={7}/>
          <YAxis tick={{fill:"#4e6a8a",fontSize:10}} tickLine={false} axisLine={false} tickFormatter={v=>`₪${(Math.abs(v)/1000).toFixed(0)}K`} width={58}/>
          <Tooltip content={<ChartTip/>}/>
          <ReferenceLine y={0} stroke="#e05454" strokeDasharray="4 4" strokeOpacity={0.6}/>
          <Area type="monotone" dataKey="balance" stroke="#d4a853" strokeWidth={2} fill="url(#fg2)" dot={false} activeDot={{r:4,fill:"#d4a853"}}/>
        </AreaChart>
      </ResponsiveContainer>
    </div>}

    {mode==="table"&&<>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        {[["all","הכל"],["check","המחאות"],["invoice","חשבוניות"],["income","הכנסות"],["fixed","קבועות"]].map(([v,l])=>
          <button key={v} onClick={()=>setFilter(v)} className={filter===v?"btn-p":"btn-g"} style={{padding:"5px 12px",fontSize:13}}>{l}</button>
        )}
      </div>
      <div className="card" style={{overflow:"hidden"}}>
        <table>
          <thead><tr><th>תאריך</th><th>סוג</th><th>תיאור</th><th>שינוי</th><th>יתרה מצטברת</th></tr></thead>
          <tbody>
            <tr>
              <td colSpan={4} style={{color:"var(--mu2)",fontSize:12}}>יתרת פתיחה</td>
              <td className="mono" style={{color:"var(--gold)",fontWeight:700}}>{fmt(openingBal)}</td>
            </tr>
            {filtered.map((r,i)=><tr key={i}>
              <td style={{color:"var(--mu2)",fontSize:12,whiteSpace:"nowrap"}}>{fmtDate(r.date)}</td>
              <td><span className={`tag t-${r.type}`}>{typeLabel(r.type)}</span></td>
              <td style={{maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.label}</td>
              <td className="mono" style={{color:r.amount<0?"var(--err)":"var(--ok)",fontWeight:600,whiteSpace:"nowrap"}}>{r.amount<0?"−":"+"}{fmt(Math.abs(r.amount))}</td>
              <td className="mono" style={{fontWeight:700,color:r.bal<0?"var(--err)":"var(--tx)"}}>{fmt(r.bal)}</td>
            </tr>)}
            {filtered.length===0&&<tr><td colSpan={5} style={{textAlign:"center",color:"var(--mu2)",padding:50}}>אין נתונים. ייבא קבצים כדי לראות תחזית.</td></tr>}
          </tbody>
        </table>
      </div>
    </>}
  </div>;
}

// ── Suppliers Tab ─────────────────────────────────────────────────────────────
function SuppliersTab({ctx}){
  const {suppliers,setSuppliers,checks,invoices,setSelSup,setTab}=ctx;
  const blank={name:"",paymentTerms:"30",paymentMethod:"המחאה",phone:"",email:"",notes:""};
  const [form,setForm]=useState(blank);
  const [editId,setEditId]=useState(null);
  const [search,setSearch]=useState("");
  const up=k=>v=>setForm(f=>({...f,[k]:v}));

  const submit=()=>{
    if(!form.name.trim()) return;
    if(editId){setSuppliers(s=>s.map(x=>x.id===editId?{...x,...form,paymentTerms:+form.paymentTerms}:x));setEditId(null);}
    else setSuppliers(s=>[...s,{...form,id:uid(),paymentTerms:+form.paymentTerms}]);
    setForm(blank);
  };

  const stats=sup=>{
    const tInv=invoices.filter(i=>i.supplierId===sup.id||i.supplierName===sup.name).reduce((s,i)=>s+(i.amount||0),0);
    const tChk=checks.filter(c=>c.supplierId===sup.id||c.supplierName===sup.name).reduce((s,c)=>s+(c.amount||0),0);
    return{tInv,tChk,bal:tInv-tChk};
  };

  const list=suppliers.filter(s=>!search||s.name.includes(search));

  return <div>
    <h1>ניהול ספקים</h1>
    <div className="sub">הגדר ספקים ותנאי תשלום לחישוב תחזית מדויק</div>

    <div className="card" style={{padding:20,marginBottom:20}}>
      <h3 style={{fontSize:15,fontWeight:700,marginBottom:14}}>{editId?"✏ עריכת ספק":"➕ הוסף ספק"}</h3>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",gap:12,marginBottom:12}}>
        <div><label>שם ספק *</label><input value={form.name} onChange={e=>up("name")(e.target.value)} placeholder="שם הספק"/></div>
        <div><label>תנאי תשלום (ימים)</label><input type="number" value={form.paymentTerms} onChange={e=>up("paymentTerms")(e.target.value)}/></div>
        <div><label>אמצעי תשלום</label><select value={form.paymentMethod} onChange={e=>up("paymentMethod")(e.target.value)}>{["המחאה","העברה בנקאית","אשראי","מזומן","אחר"].map(m=><option key={m}>{m}</option>)}</select></div>
        <div><label>טלפון</label><input value={form.phone||""} onChange={e=>up("phone")(e.target.value)} placeholder="050-0000000"/></div>
        <div><label>אימייל</label><input value={form.email||""} onChange={e=>up("email")(e.target.value)} placeholder="supplier@..."/></div>
      </div>
      <div style={{marginBottom:12}}><label>הערות</label><input value={form.notes||""} onChange={e=>up("notes")(e.target.value)}/></div>
      <div style={{display:"flex",gap:8}}>
        <button className="btn-p" onClick={submit}>{editId?"עדכן":"הוסף ספק"}</button>
        {editId&&<button className="btn-g" onClick={()=>{setEditId(null);setForm(blank);}}>ביטול</button>}
      </div>
    </div>

    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 חיפוש…" style={{maxWidth:280,marginBottom:14}}/>

    <div className="card" style={{overflow:"hidden"}}>
      <table>
        <thead><tr><th>שם ספק</th><th>תנאי תשלום</th><th>אמצעי תשלום</th><th>חשבוניות</th><th>שולם</th><th>יתרה</th><th>פעולות</th></tr></thead>
        <tbody>
          {list.map(sup=>{
            const st=stats(sup);
            return <tr key={sup.id}>
              <td style={{fontWeight:700}}>{sup.name}{sup.phone&&<div style={{fontSize:11,color:"var(--mu2)"}}>{sup.phone}</div>}</td>
              <td><span className="mono" style={{fontSize:12,color:"var(--mu2)"}}>שוטף+{sup.paymentTerms}</span></td>
              <td style={{fontSize:13,color:"var(--mu2)"}}>{sup.paymentMethod}</td>
              <td className="mono" style={{color:"var(--warn)",fontWeight:600}}>{fmt(st.tInv)}</td>
              <td className="mono" style={{color:"var(--ok)",fontWeight:600}}>{fmt(st.tChk)}</td>
              <td className="mono" style={{fontWeight:700,color:st.bal>0?"var(--err)":"var(--ok)"}}>{fmt(st.bal)}</td>
              <td><div style={{display:"flex",gap:5}}>
                <button className="btn-g" style={{padding:"3px 9px",fontSize:12}} onClick={()=>{setSelSup(sup.id);setTab("ledger");}}>כרטסת</button>
                <button className="btn-g" style={{padding:"3px 9px",fontSize:12}} onClick={()=>{setForm({name:sup.name,paymentTerms:String(sup.paymentTerms||30),paymentMethod:sup.paymentMethod||"המחאה",phone:sup.phone||"",email:sup.email||"",notes:sup.notes||""});setEditId(sup.id);}}>עריכה</button>
                <button className="btn-d" style={{padding:"3px 9px",fontSize:12}} onClick={()=>confirm("למחוק ספק זה?")&&setSuppliers(s=>s.filter(x=>x.id!==sup.id))}>מחק</button>
              </div></td>
            </tr>;
          })}
          {list.length===0&&<tr><td colSpan={7} style={{textAlign:"center",color:"var(--mu2)",padding:50}}>{search?"לא נמצאו":"הוסף ספק ראשון"}</td></tr>}
        </tbody>
      </table>
    </div>
  </div>;
}

// ── Ledger Tab ────────────────────────────────────────────────────────────────
function LedgerTab({ctx}){
  const {suppliers,checks,invoices,selSup,setSelSup,today}=ctx;
  const [sid,setSid]=useState(selSup||(suppliers[0]?.id||""));
  useEffect(()=>{if(selSup)setSid(selSup);},[selSup]);

  const sup=suppliers.find(s=>s.id===sid);
  const sInv=sup?[...invoices.filter(i=>i.supplierId===sup.id||i.supplierName===sup.name)].sort((a,b)=>(a.date||"").localeCompare(b.date||"")):[];
  const sChk=sup?[...checks.filter(c=>c.supplierId===sup.id||c.supplierName===sup.name)].sort((a,b)=>(a.date||"").localeCompare(b.date||"")):[];
  const tInv=sInv.reduce((s,i)=>s+(i.amount||0),0);
  const tChk=sChk.reduce((s,c)=>s+(c.amount||0),0);

  return <div>
    <h1>כרטסת ספק</h1>
    <div className="sub">כל החשבוניות וההמחאות לפי ספק</div>

    <div style={{display:"flex",alignItems:"center",gap:20,marginBottom:24,flexWrap:"wrap"}}>
      <select value={sid} onChange={e=>{setSid(e.target.value);setSelSup(e.target.value);}} style={{maxWidth:250}}>
        <option value="">— בחר ספק —</option>
        {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      {sup&&<div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
        {[{l:"חשבוניות",v:fmt(tInv),c:"var(--warn)"},{l:"שולם",v:fmt(tChk),c:"var(--ok)"},{l:"יתרה לתשלום",v:fmt(tInv-tChk),c:(tInv-tChk)>0?"var(--err)":"var(--ok)"},{l:"תנאי תשלום",v:`שוטף+${sup.paymentTerms||30}`,c:"var(--mu2)"}].map((k,i)=>
          <div key={i} style={{textAlign:"center"}}>
            <div style={{fontSize:11,color:"var(--mu2)",marginBottom:2}}>{k.l}</div>
            <div className="mono" style={{fontSize:14,fontWeight:700,color:k.c}}>{k.v}</div>
          </div>
        )}
      </div>}
    </div>

    {sup?<div className="g2">
      <div className="card" style={{overflow:"hidden"}}>
        <div style={{padding:"13px 18px",borderBottom:"1px solid var(--bd)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontWeight:700}}>🧾 חשבוניות ({sInv.length})</span>
          <span className="mono" style={{color:"var(--warn)",fontWeight:700}}>{fmt(tInv)}</span>
        </div>
        <table>
          <thead><tr><th>תאריך</th><th>מס׳ חשבונית</th><th>סכום</th><th>תשלום צפוי</th></tr></thead>
          <tbody>
            {sInv.map(inv=>{
              const pay=addDays(eom(new Date(inv.date)),sup.paymentTerms||30);
              const late=pay<today;
              return <tr key={inv.id}>
                <td style={{fontSize:12,color:"var(--mu2)",whiteSpace:"nowrap"}}>{fmtDate(inv.date)}</td>
                <td style={{fontSize:12}}>{inv.invoiceNumber||"—"}</td>
                <td className="mono" style={{color:"var(--warn)",fontWeight:700}}>{fmt(inv.amount)}</td>
                <td style={{fontSize:12,color:late?"var(--err)":"var(--inf)",whiteSpace:"nowrap"}}>{fmtDate(pay)}{late?" ⚠":""}</td>
              </tr>;
            })}
            {!sInv.length&&<tr><td colSpan={4} style={{textAlign:"center",color:"var(--mu2)",padding:28}}>אין חשבוניות</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="card" style={{overflow:"hidden"}}>
        <div style={{padding:"13px 18px",borderBottom:"1px solid var(--bd)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontWeight:700}}>📄 המחאות ({sChk.length})</span>
          <span className="mono" style={{color:"var(--ok)",fontWeight:700}}>{fmt(tChk)}</span>
        </div>
        <table>
          <thead><tr><th>תאריך</th><th>מס׳ המחאה</th><th>סכום</th></tr></thead>
          <tbody>
            {sChk.map(c=><tr key={c.id}>
              <td style={{fontSize:12,color:"var(--mu2)",whiteSpace:"nowrap"}}>{fmtDate(c.date)}</td>
              <td style={{fontSize:12}}>{c.checkNumber||"—"}</td>
              <td className="mono" style={{color:"var(--ok)",fontWeight:700}}>{fmt(c.amount)}</td>
            </tr>)}
            {!sChk.length&&<tr><td colSpan={3} style={{textAlign:"center",color:"var(--mu2)",padding:28}}>אין המחאות</td></tr>}
          </tbody>
        </table>
      </div>
    </div>:<div style={{textAlign:"center",color:"var(--mu2)",padding:80,fontSize:16}}>בחר ספק לצפייה בכרטסת</div>}
  </div>;
}

// ── Aging Tab ─────────────────────────────────────────────────────────────────
function AgingTab({ctx}){
  const {invoices,checks,suppliers,today}=ctx;

  const rows=useMemo(()=>suppliers.map(sup=>{
    const sInv=invoices.filter(i=>i.supplierId===sup.id||i.supplierName===sup.name);
    let pool=checks.filter(c=>c.supplierId===sup.id||c.supplierName===sup.name).reduce((s,c)=>s+(c.amount||0),0);
    const bkts={"0-30":0,"31-60":0,"61-90":0,"90+":0};
    [...sInv].sort((a,b)=>(a.date||"").localeCompare(b.date||"")).forEach(inv=>{
      const age=Math.floor((today-new Date(inv.date))/86400000);
      const amt=inv.amount||0,cov=Math.min(pool,amt);pool-=cov;const open=amt-cov;
      if(open<=0) return;
      if(age<=30)bkts["0-30"]+=open;else if(age<=60)bkts["31-60"]+=open;else if(age<=90)bkts["61-90"]+=open;else bkts["90+"]+=open;
    });
    const total=Object.values(bkts).reduce((s,v)=>s+v,0);
    return{sup,bkts,total};
  }).filter(r=>r.total>0),[invoices,checks,suppliers,today]);

  const totals=useMemo(()=>{
    const t={"0-30":0,"31-60":0,"61-90":0,"90+":0,all:0};
    rows.forEach(r=>{Object.keys(r.bkts).forEach(k=>{t[k]+=r.bkts[k];});t.all+=r.total;});
    return t;
  },[rows]);

  const bc={"0-30":"var(--ok)","31-60":"var(--warn)","61-90":"var(--err)","90+":"#b91c1c"};

  return <div>
    <h1>גיול חשבוניות פתוחות</h1>
    <div className="sub">ניתוח חשבוניות שטרם שולמו לפי גיל</div>

    <div className="g4" style={{marginBottom:20}}>
      {[["0-30","עד 30 יום"],["31-60","31–60 יום"],["61-90","61–90 יום"],["90+","מעל 90 יום"]].map(([k,l])=>
        <div key={k} className="card" style={{padding:"16px 18px"}}>
          <div style={{fontSize:11,color:"var(--mu2)",marginBottom:6}}>{l}</div>
          <div className="mono" style={{fontSize:16,fontWeight:700,color:bc[k]}}>{fmt(totals[k])}</div>
        </div>
      )}
    </div>

    {rows.length>0?<div className="card" style={{overflow:"hidden"}}>
      <table>
        <thead><tr>
          <th>ספק</th>
          <th style={{color:bc["0-30"]}}>0–30</th>
          <th style={{color:bc["31-60"]}}>31–60</th>
          <th style={{color:bc["61-90"]}}>61–90</th>
          <th style={{color:bc["90+"]}}>90+</th>
          <th>סה"כ פתוח</th>
        </tr></thead>
        <tbody>
          {rows.map(({sup,bkts,total})=><tr key={sup.id}>
            <td style={{fontWeight:700}}>{sup.name}</td>
            {Object.entries(bkts).map(([k,v])=><td key={k} className="mono" style={{color:v>0?bc[k]:"var(--mu)",fontWeight:v>0?700:400}}>{v>0?fmt(v):"—"}</td>)}
            <td className="mono" style={{fontWeight:800,color:"var(--err)"}}>{fmt(total)}</td>
          </tr>)}
          <tr style={{borderTop:"2px solid var(--bd)"}}>
            <td style={{fontWeight:700,color:"var(--mu2)"}}>סה"כ</td>
            {["0-30","31-60","61-90","90+"].map(k=><td key={k} className="mono" style={{fontWeight:700,color:bc[k]}}>{fmt(totals[k])}</td>)}
            <td className="mono" style={{fontWeight:800,color:"var(--err)",fontSize:15}}>{fmt(totals.all)}</td>
          </tr>
        </tbody>
      </table>
    </div>:<div style={{textAlign:"center",color:"var(--ok)",padding:80,fontSize:16}}>✅ אין חשבוניות פתוחות</div>}
  </div>;
}

// ── Import Tab ────────────────────────────────────────────────────────────────
function ImportTab({ctx}){
  const {suppliers,setSuppliers,checks,setChecks,invoices,setInvoices}=ctx;
  const [preview,setPreview]=useState(null);
  const [map,setMap]=useState({});
  const [msg,setMsg]=useState("");

  const detect=(cols,...cands)=>{
    for(const c of cands){const f=cols.find(col=>col.toLowerCase().includes(c));if(f)return f;}
    return cols[0]||"";
  };

  const parseFile=(file,type)=>{
    const r=new FileReader();
    r.onload=e=>{
      const wb=XLSX.read(new Uint8Array(e.target.result),{type:"array",cellDates:true});
      const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""});
      const cols=rows.length?Object.keys(rows[0]):[];
      const fm=type==="checks"
        ?{supplierName:detect(cols,"ספק","שם","supplier","name"),date:detect(cols,"תאריך","date"),amount:detect(cols,"סכום","amount","סה"),checkNumber:detect(cols,"המחאה","check","מספר","num")}
        :{supplierName:detect(cols,"ספק","שם","supplier","name"),date:detect(cols,"תאריך","date"),amount:detect(cols,"סכום","amount","סה"),invoiceNumber:detect(cols,"חשבונית","invoice","מספר","num")};
      setMap(fm);setPreview({type,rows,cols});setMsg("");
    };
    r.readAsArrayBuffer(file);
  };

  const doImport=()=>{
    if(!preview) return;
    const {type,rows}=preview;
    const allSups=[...suppliers];
    const getOrCreate=name=>{
      let s=allSups.find(x=>x.name===name);
      if(!s){s={id:uid(),name,paymentTerms:30,paymentMethod:"המחאה",notes:""};allSups.push(s);}
      return s;
    };
    const parse=v=>parseFloat(String(v).replace(/[^0-9.-]/g,""))||0;
    if(type==="checks"){
      const items=rows.map(r=>{const name=String(r[map.supplierName]||"").trim();if(!name)return null;const sup=getOrCreate(name);const amt=parse(r[map.amount]);if(!amt)return null;return{id:uid(),supplierName:name,supplierId:sup.id,date:excelDate(r[map.date]),amount:amt,checkNumber:String(r[map.checkNumber]||"")};}).filter(Boolean);
      setChecks(c=>[...c,...items]);setSuppliers(allSups);
      setMsg(`✅ יובאו ${items.length} המחאות${allSups.length>suppliers.length?` | ${allSups.length-suppliers.length} ספקים חדשים`:""}`);
    } else {
      const items=rows.map(r=>{const name=String(r[map.supplierName]||"").trim();if(!name)return null;const sup=getOrCreate(name);const amt=parse(r[map.amount]);if(!amt)return null;return{id:uid(),supplierName:name,supplierId:sup.id,date:excelDate(r[map.date]),amount:amt,invoiceNumber:String(r[map.invoiceNumber]||"")};}).filter(Boolean);
      setInvoices(i=>[...i,...items]);setSuppliers(allSups);
      setMsg(`✅ יובאו ${items.length} חשבוניות${allSups.length>suppliers.length?` | ${allSups.length-suppliers.length} ספקים חדשים`:""}`);
    }
    setPreview(null);
  };

  const UploadBox=({label,onFile})=><div style={{border:"2px dashed var(--bd2)",borderRadius:12,padding:"36px 24px",textAlign:"center"}}
    onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor="var(--gold)"}}
    onDragLeave={e=>{e.currentTarget.style.borderColor="var(--bd2)"}}
    onDrop={e=>{e.preventDefault();e.currentTarget.style.borderColor="var(--bd2)";const f=e.dataTransfer.files[0];if(f)onFile(f);}}>
    <div style={{fontSize:32,marginBottom:10}}>📁</div>
    <div style={{fontSize:15,fontWeight:600,marginBottom:6}}>{label}</div>
    <div style={{fontSize:12,color:"var(--mu2)",marginBottom:14}}>גרור קובץ לכאן או לחץ לבחירה</div>
    <label style={{cursor:"pointer"}}>
      <span style={{background:"var(--s2)",border:"1px solid var(--bd2)",borderRadius:8,padding:"7px 16px",fontSize:13,fontWeight:600,color:"var(--gold)"}}>בחר קובץ</span>
      <input type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={e=>{if(e.target.files[0])onFile(e.target.files[0]);}}/>
    </label>
  </div>;

  const fLabels={supplierName:"שם ספק",date:"תאריך",amount:"סכום",checkNumber:"מס׳ המחאה",invoiceNumber:"מס׳ חשבונית"};

  return <div>
    <h1>יבוא נתונים מאקסל</h1>
    <div className="sub">העלה קבצי Excel — האפליקציה מזהה עמודות אוטומטית</div>

    {msg&&<div style={{background:"rgba(38,184,135,.07)",border:"1px solid rgba(38,184,135,.25)",borderRadius:10,padding:"12px 18px",marginBottom:18,color:"var(--ok)",fontSize:14}}>{msg}</div>}

    {!preview&&<div className="g2" style={{marginBottom:24}}>
      <UploadBox label="📄 ייבוא המחאות" onFile={f=>parseFile(f,"checks")}/>
      <UploadBox label="🧾 ייבוא חשבוניות" onFile={f=>parseFile(f,"invoices")}/>
    </div>}

    {preview&&<div className="card" style={{padding:22,marginBottom:20}}>
      <h3 style={{fontSize:15,fontWeight:700,marginBottom:4}}>{preview.type==="checks"?"תצוגה מקדימה — המחאות":"תצוגה מקדימה — חשבוניות"}</h3>
      <div style={{fontSize:13,color:"var(--mu2)",marginBottom:18}}>{preview.rows.length} שורות</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:14,marginBottom:20}}>
        {Object.entries(map).map(([field,col])=><div key={field}><label>{fLabels[field]}</label>
          <select value={col} onChange={e=>setMap(m=>({...m,[field]:e.target.value}))}>
            {preview.cols.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>)}
      </div>
      <div style={{overflowX:"auto",marginBottom:18}}>
        <table style={{minWidth:500}}>
          <thead><tr><th>שם ספק</th><th>תאריך</th><th>סכום</th><th>{preview.type==="checks"?"מס׳ המחאה":"מס׳ חשבונית"}</th></tr></thead>
          <tbody>
            {preview.rows.slice(0,5).map((r,i)=>{
              const name=String(r[map.supplierName]||"").trim();
              const amt=parseFloat(String(r[map.amount]).replace(/[^0-9.-]/g,""))||0;
              const num=String(r[preview.type==="checks"?map.checkNumber:map.invoiceNumber]||"");
              return <tr key={i}>
                <td>{name||<span style={{color:"var(--err)"}}>חסר</span>}</td>
                <td style={{fontSize:12,color:"var(--mu2)"}}>{fmtDate(excelDate(r[map.date]))}</td>
                <td className="mono" style={{color:amt?"var(--warn)":"var(--err)"}}>{amt?fmt(amt):"חסר"}</td>
                <td style={{fontSize:12,color:"var(--mu2)"}}>{num||"—"}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button className="btn-p" onClick={doImport}>ייבא {preview.rows.length} {preview.type==="checks"?"המחאות":"חשבוניות"}</button>
        <button className="btn-g" onClick={()=>setPreview(null)}>ביטול</button>
      </div>
    </div>}

    <div className="g2">
      <div className="card" style={{padding:"16px 18px"}}>
        <div style={{fontSize:13,color:"var(--mu2)",marginBottom:8}}>📄 המחאות מיובאות</div>
        <div className="mono" style={{fontSize:20,fontWeight:700,color:"var(--inf)"}}>{ctx.checks.length}</div>
        <div style={{fontSize:12,color:"var(--mu2)",marginTop:4}}>סה"כ: {fmt(ctx.checks.reduce((s,c)=>s+(c.amount||0),0))}</div>
        {ctx.checks.length>0&&<button className="btn-d" style={{marginTop:12,fontSize:12,padding:"4px 10px"}} onClick={()=>confirm("למחוק את כל ההמחאות?")&&ctx.setChecks([])}>נקה הכל</button>}
      </div>
      <div className="card" style={{padding:"16px 18px"}}>
        <div style={{fontSize:13,color:"var(--mu2)",marginBottom:8}}>🧾 חשבוניות מיובאות</div>
        <div className="mono" style={{fontSize:20,fontWeight:700,color:"var(--warn)"}}>{ctx.invoices.length}</div>
        <div style={{fontSize:12,color:"var(--mu2)",marginTop:4}}>סה"כ: {fmt(ctx.invoices.reduce((s,i)=>s+(i.amount||0),0))}</div>
        {ctx.invoices.length>0&&<button className="btn-d" style={{marginTop:12,fontSize:12,padding:"4px 10px"}} onClick={()=>confirm("למחוק את כל החשבוניות?")&&ctx.setInvoices([])}>נקה הכל</button>}
      </div>
    </div>
  </div>;
}

// ── Recurring Tab ─────────────────────────────────────────────────────────────
function RecurringTab({ctx}){
  const {fixedItems,setFixedItems}=ctx;
  const blank={name:"",amount:"",type:"expense",recurrence:"monthly",dayOfMonth:"1",date:""};
  const [form,setForm]=useState(blank);
  const [editId,setEditId]=useState(null);
  const up=k=>v=>setForm(f=>({...f,[k]:v}));

  const submit=()=>{
    if(!form.name.trim()||!form.amount) return;
    const item={...form,id:editId||uid(),amount:+form.amount,dayOfMonth:+form.dayOfMonth};
    if(editId){setFixedItems(s=>s.map(x=>x.id===editId?item:x));setEditId(null);}
    else setFixedItems(s=>[...s,item]);
    setForm(blank);
  };

  const expenses=fixedItems.filter(f=>f.type==="expense");
  const incomes=fixedItems.filter(f=>f.type==="income");

  return <div>
    <h1>הכנסות והוצאות קבועות</h1>
    <div className="sub">פריטים חוזרים חודשיים או חד-פעמיים</div>

    <div className="card" style={{padding:20,marginBottom:22}}>
      <h3 style={{fontSize:15,fontWeight:700,marginBottom:14}}>{editId?"✏ עריכה":"➕ הוסף פריט"}</h3>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr",gap:12,marginBottom:12}}>
        <div><label>שם</label><input value={form.name} onChange={e=>up("name")(e.target.value)} placeholder="שם ההוצאה/הכנסה"/></div>
        <div><label>סכום (₪)</label><input type="number" value={form.amount} onChange={e=>up("amount")(e.target.value)} placeholder="0"/></div>
        <div><label>סוג</label><select value={form.type} onChange={e=>up("type")(e.target.value)}><option value="expense">הוצאה</option><option value="income">הכנסה</option></select></div>
        <div><label>תדירות</label><select value={form.recurrence} onChange={e=>up("recurrence")(e.target.value)}><option value="monthly">חודשי</option><option value="once">חד-פעמי</option></select></div>
        {form.recurrence==="monthly"
          ?<div><label>יום בחודש</label><input type="number" min="1" max="28" value={form.dayOfMonth} onChange={e=>up("dayOfMonth")(e.target.value)}/></div>
          :<div><label>תאריך</label><input type="date" value={form.date} onChange={e=>up("date")(e.target.value)}/></div>}
      </div>
      <div style={{display:"flex",gap:8}}>
        <button className="btn-p" onClick={submit}>{editId?"עדכן":"הוסף"}</button>
        {editId&&<button className="btn-g" onClick={()=>{setEditId(null);setForm(blank);}}>ביטול</button>}
      </div>
    </div>

    <div className="g2" style={{marginBottom:20}}>
      <div className="card" style={{padding:"14px 18px"}}><div style={{fontSize:11,color:"var(--mu2)",marginBottom:3}}>סה"כ הוצאות / חודש</div><div className="mono" style={{fontSize:18,fontWeight:700,color:"var(--err)"}}>{fmt(expenses.reduce((s,f)=>s+(f.amount||0),0))}</div></div>
      <div className="card" style={{padding:"14px 18px"}}><div style={{fontSize:11,color:"var(--mu2)",marginBottom:3}}>סה"כ הכנסות / חודש</div><div className="mono" style={{fontSize:18,fontWeight:700,color:"var(--ok)"}}>{fmt(incomes.reduce((s,f)=>s+(f.amount||0),0))}</div></div>
    </div>

    {[{title:"🔴 הוצאות קבועות",items:expenses,col:"var(--err)"},{title:"🟢 הכנסות קבועות",items:incomes,col:"var(--ok)"}].map(({title,items,col})=>
      <div key={title} className="card" style={{overflow:"hidden",marginBottom:14}}>
        <div style={{padding:"13px 18px",borderBottom:"1px solid var(--bd)",fontWeight:700,fontSize:14}}>{title}</div>
        <table>
          <thead><tr><th>שם</th><th>סכום</th><th>תדירות</th><th>יום / תאריך</th><th>פעולות</th></tr></thead>
          <tbody>
            {items.map(fi=><tr key={fi.id}>
              <td style={{fontWeight:600}}>{fi.name}</td>
              <td className="mono" style={{color:col,fontWeight:700}}>{fmt(fi.amount)}</td>
              <td style={{fontSize:12,color:"var(--mu2)"}}>{fi.recurrence==="monthly"?"חודשי":"חד-פעמי"}</td>
              <td style={{fontSize:12,color:"var(--mu2)"}}>{fi.recurrence==="monthly"?`יום ${fi.dayOfMonth}`:fmtDate(fi.date)}</td>
              <td><div style={{display:"flex",gap:5}}>
                <button className="btn-g" style={{padding:"3px 9px",fontSize:12}} onClick={()=>{setForm({name:fi.name,amount:String(fi.amount),type:fi.type,recurrence:fi.recurrence,dayOfMonth:String(fi.dayOfMonth||1),date:fi.date||""});setEditId(fi.id);}}>עריכה</button>
                <button className="btn-d" style={{padding:"3px 9px",fontSize:12}} onClick={()=>confirm("למחוק?")&&setFixedItems(s=>s.filter(x=>x.id!==fi.id))}>מחק</button>
              </div></td>
            </tr>)}
            {items.length===0&&<tr><td colSpan={5} style={{textAlign:"center",color:"var(--mu2)",padding:30}}>אין פריטים</td></tr>}
          </tbody>
        </table>
      </div>
    )}
  </div>;
}

// ── Mount ──────────────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById("root")).render(<App/>);