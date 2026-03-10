import { useState, useEffect, useRef } from "react";

// ─── Storage ─────────────────────────────────────────────────
const STORAGE_KEY = "cattle_db_v3";
function loadDB() {
  try { const r = localStorage.getItem(STORAGE_KEY); if (r) return JSON.parse(r); } catch {}
  return {
    cattle: [
      { id:"1", earTag:"JP001", name:"はなこ", birthDate:"2024-02-10", arrivalDate:"2024-03-01", barn:"A-01号舎", gender:"female", feed:"配合飼料A", feedAmount:"3.5", feedTimes:"2", feedMemo:"", memo:"" },
      { id:"2", earTag:"JP002", name:"たろう", birthDate:"2023-10-05", arrivalDate:"2023-11-01", barn:"A-01号舎", gender:"male",   feed:"配合飼料B", feedAmount:"4.0", feedTimes:"2", feedMemo:"", memo:"" },
      { id:"3", earTag:"JP003", name:"くろ",   birthDate:"2023-06-20", arrivalDate:"2023-07-10", barn:"A-02号舎", gender:"female", feed:"配合飼料A", feedAmount:"3.0", feedTimes:"3", feedMemo:"少量ずつ", memo:"要観察" },
      { id:"4", earTag:"JP004", name:"しろ",   birthDate:"2022-12-01", arrivalDate:"2023-01-15", barn:"B-01号舎", gender:"female", feed:"配合飼料C", feedAmount:"5.0", feedTimes:"2", feedMemo:"", memo:"" },
    ],
    barns: ["A-01号舎","A-02号舎","A-03号舎","B-01号舎","B-02号舎"],
    feeds: ["配合飼料A","配合飼料B","配合飼料C"],
    mapImage: null,
    barnPins: [],
  };
}
function saveDB(db) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch {} }

// ─── Helpers ─────────────────────────────────────────────────
function getAgeMonths(d) {
  const b = new Date(d), n = new Date();
  return (n.getFullYear()-b.getFullYear())*12 + n.getMonth()-b.getMonth();
}
function formatAge(m) {
  if (m < 1)  return "1ヶ月未満";
  if (m < 12) return `${m}ヶ月`;
  const y = Math.floor(m/12), r = m%12;
  return r ? `${y}歳${r}ヶ月` : `${y}歳`;
}
function uid() { return Math.random().toString(36).slice(2)+Date.now().toString(36); }

// ピンカラー判定（後期優先）
function pinColor(barnName, cattle) {
  const bc = cattle.filter(c => c.barn === barnName);
  if (bc.length === 0) return { color:"#3b82f6", label:"空", phase:"empty" };
  const ages = bc.map(c => getAgeMonths(c.birthDate));
  if (ages.some(m => m >= 19)) return { color:"#ef4444", label:"後期", phase:"late" };
  if (ages.some(m => m >= 15)) return { color:"#fbbf24", label:"中期", phase:"mid" };
  if (ages.some(m => m >= 7))  return { color:"#22c55e", label:"前期", phase:"early" };
  return { color:"#3b82f6", label:"空", phase:"empty" };
}

// クラスタリング
function clusterPins(pins, cattle, scale) {
  const radius = 7 / scale;
  const visited = new Set();
  const clusters = [];
  pins.forEach(pin => {
    if (visited.has(pin.barn)) return;
    const nearby = pins.filter(p =>
      !visited.has(p.barn) &&
      Math.hypot(p.x - pin.x, p.y - pin.y) < radius
    );
    nearby.forEach(p => visited.add(p.barn));
    const cx = nearby.reduce((s,p)=>s+p.x,0)/nearby.length;
    const cy = nearby.reduce((s,p)=>s+p.y,0)/nearby.length;
    let clusterColor = "#3b82f6";
    if (nearby.some(p => pinColor(p.barn,cattle).phase==="late"))  clusterColor="#ef4444";
    else if (nearby.some(p => pinColor(p.barn,cattle).phase==="mid"))  clusterColor="#fbbf24";
    else if (nearby.some(p => pinColor(p.barn,cattle).phase==="early")) clusterColor="#22c55e";
    clusters.push({ id:pin.barn, pins:nearby, x:cx, y:cy, count:nearby.length, color:clusterColor });
  });
  return clusters;
}

const EMPTY_FORM = { earTag:"", name:"", birthDate:"", arrivalDate:"", barn:"", gender:"female", feed:"", feedAmount:"", feedTimes:"1", feedMemo:"", memo:"" };

// ─── Sub components ───────────────────────────────────────────
function Toast({ msg, onDone }) {
  useEffect(()=>{ const t=setTimeout(onDone,2200); return ()=>clearTimeout(t); });
  return (
    <div style={{ position:"fixed", bottom:40, left:"50%", transform:"translateX(-50%)", background:"#166534", border:"1px solid #22c55e", color:"#dcfce7", borderRadius:14, padding:"12px 28px", fontSize:14, fontWeight:700, boxShadow:"0 8px 32px #00000088", zIndex:9999, whiteSpace:"nowrap" }}>
      ✓ {msg}
    </div>
  );
}
function FInput({ label, ...p }) {
  const [f,setF]=useState(false);
  return (
    <div style={{ marginBottom:14 }}>
      {label&&<label style={{ display:"block", fontSize:11, color:"#64748b", marginBottom:5, letterSpacing:0.5 }}>{label}</label>}
      <input {...p} onFocus={()=>setF(true)} onBlur={()=>setF(false)}
        style={{ width:"100%", background:"#0f172a", border:`1.5px solid ${f?"#3b82f6":"#1e293b"}`, borderRadius:10, padding:"10px 13px", color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box" }} />
    </div>
  );
}
function FSel({ label, options, ...p }) {
  return (
    <div style={{ marginBottom:14 }}>
      {label&&<label style={{ display:"block", fontSize:11, color:"#64748b", marginBottom:5, letterSpacing:0.5 }}>{label}</label>}
      <select {...p} style={{ width:"100%", background:"#0f172a", border:"1.5px solid #1e293b", borderRadius:10, padding:"10px 13px", color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box" }}>
        {options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
      </select>
    </div>
  );
}
function PhaseChip({ months }) {
  let color="#3b82f6", label="—";
  if (months>=19){ color="#ef4444"; label=`後期 ${formatAge(months)}`; }
  else if (months>=15){ color="#fbbf24"; label=`中期 ${formatAge(months)}`; }
  else if (months>=7){ color="#22c55e"; label=`前期 ${formatAge(months)}`; }
  else { label=formatAge(months); }
  return <span style={{ background:color+"22", color, border:`1px solid ${color}44`, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>{label}</span>;
}

// ─── VIEW MODE ────────────────────────────────────────────────
function ViewMode({ db, onSwitchAdmin }) {
  const { cattle, barns, mapImage, barnPins=[] } = db;
  const [zoom, setZoom]           = useState({ scale:1, x:0, y:0 });
  const [dragging, setDragging]   = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [selCluster, setSelCluster] = useState(null);
  const [selBarn, setSelBarn]     = useState(null);
  const [selCattle, setSelCattle] = useState(null);

  const scale    = zoom.scale;
  const clusters = clusterPins(barnPins, cattle, scale);

  function doZoom(d) { setZoom(z=>({...z,scale:Math.min(6,Math.max(1,z.scale+d))})); setSelCluster(null); }
  function resetView() { setZoom({scale:1,x:0,y:0}); setSelCluster(null); setSelBarn(null); setSelCattle(null); }
  function onMD(e){ if(scale<=1) return; setDragging(true); setDragStart({x:e.clientX-zoom.x,y:e.clientY-zoom.y}); }
  function onMM(e){ if(!dragging||!dragStart) return; setZoom(z=>({...z,x:e.clientX-dragStart.x,y:e.clientY-dragStart.y})); }
  function onMU(){ setDragging(false); }
  function onWheel(e){ e.preventDefault(); doZoom(e.deltaY<0?0.4:-0.4); }

  function handleClusterClick(cl) {
    if (cl.count===1) { setSelBarn(cl.pins[0].barn); setSelCluster(null); setSelCattle(null); }
    else { setSelCluster(cl); setSelBarn(null); setSelCattle(null); setZoom(z=>({...z,scale:Math.min(6,z.scale*1.8)})); }
  }

  const barnCattle = selBarn ? cattle.filter(c=>c.barn===selBarn) : [];
  const transform  = `translate(${zoom.x}px,${zoom.y}px) scale(${scale})`;

  return (
    <div style={{ position:"fixed", inset:0, background:"#060d18", display:"flex", flexDirection:"column" }}>
      {/* Header */}
      <div style={{ position:"absolute", top:0, left:0, right:0, zIndex:100, display:"flex", alignItems:"center", padding:"14px 20px", background:"linear-gradient(180deg,#060d18ee 0%,transparent 100%)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:24 }}>🐄</span>
          <div style={{ fontSize:16, fontWeight:800, color:"#f1f5f9", letterSpacing:1 }}>牧場マップ</div>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ background:"#0f172add", border:"1px solid #1e293b", borderRadius:12, padding:"6px 14px", display:"flex", gap:12 }}>
            <span style={{ fontSize:12, color:"#64748b" }}>総頭数</span>
            <span style={{ fontSize:14, fontWeight:900, color:"#fbbf24" }}>{cattle.length}</span>
            <span style={{ fontSize:12, color:"#334155" }}>|</span>
            <span style={{ fontSize:12, color:"#64748b" }}>牛舎</span>
            <span style={{ fontSize:14, fontWeight:900, color:"#60a5fa" }}>{barns.length}</span>
          </div>
          <div style={{ background:"#0f172add", border:"1px solid #1e293b", borderRadius:12, padding:"6px 12px", display:"flex", gap:8, alignItems:"center" }}>
            {[["#3b82f6","空"],["#22c55e","前期"],["#fbbf24","中期"],["#ef4444","後期"]].map(([c,l])=>(
              <div key={l} style={{ display:"flex", alignItems:"center", gap:3 }}>
                <div style={{ width:9,height:9,borderRadius:"50%",background:c }} />
                <span style={{ fontSize:10,color:"#94a3b8" }}>{l}</span>
              </div>
            ))}
          </div>
          <button onClick={onSwitchAdmin} style={{ background:"#1e293b", border:"1px solid #334155", borderRadius:12, padding:"8px 18px", color:"#94a3b8", fontSize:13, fontWeight:700, cursor:"pointer" }}>⚙ 管理</button>
        </div>
      </div>

      {/* Map */}
      {!mapImage ? (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
          <div style={{ fontSize:72, opacity:0.15 }}>🗺</div>
          <div style={{ fontSize:18, color:"#334155", fontWeight:700 }}>地図が登録されていません</div>
          <button onClick={onSwitchAdmin} style={{ background:"#1e3a5f", border:"1px solid #2563eb", borderRadius:12, padding:"12px 28px", color:"#60a5fa", fontSize:14, fontWeight:700, cursor:"pointer", marginTop:8 }}>管理画面へ →</button>
        </div>
      ) : (
        <div style={{ flex:1, position:"relative", overflow:"hidden", cursor:scale>1?(dragging?"grabbing":"grab"):"default" }}
          onWheel={onWheel} onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}>
          <div style={{ position:"absolute", inset:0, transformOrigin:"0 0", transform, transition:dragging?"none":"transform 0.2s ease" }}>
            <img src={mapImage} alt="農場マップ" style={{ width:"100%", height:"100%", objectFit:"contain", display:"block" }}
              onClick={()=>{ setSelCluster(null); setSelBarn(null); setSelCattle(null); }} />
          </div>
          <div style={{ position:"absolute", inset:0, transformOrigin:"0 0", transform, transition:dragging?"none":"transform 0.2s ease", pointerEvents:"none" }}>
            {clusters.map(cl=>{
              const isSingle = cl.count===1;
              const col = isSingle ? pinColor(cl.pins[0].barn, cattle).color : cl.color;
              const size = isSingle ? 36 : Math.min(64, 38+cl.count*0.5);
              const isActive = selCluster?.id===cl.id || selBarn===cl.pins[0]?.barn;
              return (
                <div key={cl.id} style={{ position:"absolute", left:`${cl.x*100}%`, top:`${cl.y*100}%`, transform:"translate(-50%,-50%)", zIndex:isActive?30:10, pointerEvents:"all", cursor:"pointer" }}
                  onClick={e=>{ e.stopPropagation(); handleClusterClick(cl); }}>
                  {isSingle ? (
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", filter:isActive?`drop-shadow(0 0 10px ${col})`:"drop-shadow(0 2px 5px #00000099)" }}>
                      <div style={{ background:col, border:"3px solid #fff", width:32, height:32, borderRadius:"50% 50% 50% 0", transform:"rotate(-45deg)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>
                        <span style={{ transform:"rotate(45deg)" }}>⌂</span>
                      </div>
                      {scale>=2.5 && <div style={{ background:"#0f172add", color:"#e2e8f0", fontSize:9, borderRadius:5, padding:"2px 5px", marginTop:2, whiteSpace:"nowrap", border:`1px solid ${col}44` }}>{cl.pins[0].barn}</div>}
                    </div>
                  ) : (
                    <div style={{ background:`radial-gradient(circle,${col}cc,${col}88)`, border:`3px solid ${isActive?"#fff":col}`, borderRadius:"50%", width:size, height:size, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", boxShadow:isActive?`0 0 20px ${col}88`:"0 2px 10px #00000066", transition:"all 0.2s" }}>
                      <div style={{ fontSize:size>48?18:13, fontWeight:900, color:"#fff", lineHeight:1 }}>{cl.count}</div>
                      <div style={{ fontSize:9, color:"#ffffffbb" }}>牛舎</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ position:"absolute", right:16, bottom:80, display:"flex", flexDirection:"column", gap:6, zIndex:100 }}>
            {[["＋",0.5],["－",-0.5]].map(([l,d])=>(
              <button key={l} onClick={()=>doZoom(d)} style={{ background:"#0b1524", border:"1px solid #1e293b", borderRadius:10, width:42, height:42, color:"#e2e8f0", fontSize:22, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>{l}</button>
            ))}
            <button onClick={resetView} style={{ background:"#0b1524", border:"1px solid #1e293b", borderRadius:10, width:42, height:42, color:"#64748b", fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>⟲</button>
          </div>
        </div>
      )}

      {/* 右パネル：クラスター内一覧 */}
      {selCluster && !selBarn && (
        <div style={{ position:"absolute", right:0, top:0, bottom:0, width:300, background:"#0b1524f0", backdropFilter:"blur(12px)", borderLeft:"1px solid #1e293b", zIndex:200, display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"20px 16px 12px", borderBottom:"1px solid #1e293b" }}>
            <button onClick={()=>setSelCluster(null)} style={{ background:"none", border:"none", color:"#475569", fontSize:13, cursor:"pointer", marginBottom:10, padding:0 }}>← 閉じる</button>
            <div style={{ fontSize:16, fontWeight:800, color:"#f1f5f9" }}>このエリア <span style={{ color:"#60a5fa" }}>{selCluster.count}牛舎</span></div>
            <div style={{ fontSize:11, color:"#475569", marginTop:3 }}>拡大するとさらに分離します</div>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:"8px 12px" }}>
            {selCluster.pins.map(p=>{
              const pc=pinColor(p.barn,cattle);
              const count=cattle.filter(c=>c.barn===p.barn).length;
              return (
                <div key={p.barn} onClick={()=>{ setSelBarn(p.barn); setSelCluster(null); }}
                  style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:10, padding:"10px 12px", marginBottom:6, cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=pc.color}
                  onMouseLeave={e=>e.currentTarget.style.borderColor="#1e293b"}>
                  <div style={{ width:12,height:12,borderRadius:"50%",background:pc.color,flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"#f1f5f9" }}>{p.barn}</div>
                    <div style={{ fontSize:11, color:"#475569" }}>🐄 {count}頭　{pc.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 右パネル：牛舎詳細 */}
      {selBarn && !selCattle && (
        <div style={{ position:"absolute", right:0, top:0, bottom:0, width:300, background:"#0b1524f0", backdropFilter:"blur(12px)", borderLeft:"1px solid #1e293b", zIndex:210, display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"20px 16px 12px", borderBottom:"1px solid #1e293b" }}>
            <button onClick={()=>setSelBarn(null)} style={{ background:"none", border:"none", color:"#475569", fontSize:13, cursor:"pointer", marginBottom:10, padding:0 }}>← 閉じる</button>
            <div style={{ fontSize:20, fontWeight:900, color:"#f1f5f9" }}>⌂ {selBarn}</div>
            <div style={{ fontSize:13, color:pinColor(selBarn,cattle).color, marginTop:4, fontWeight:700 }}>
              {barnCattle.length}頭　{pinColor(selBarn,cattle).label}
            </div>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:"10px 12px" }}>
            {barnCattle.length===0 ? (
              <div style={{ color:"#334155", textAlign:"center", padding:32, fontSize:13 }}>この牛舎に個体がいません</div>
            ) : barnCattle.map(c=>{
              const m=getAgeMonths(c.birthDate);
              return (
                <div key={c.id} onClick={()=>setSelCattle(c)}
                  style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:12, padding:"12px 14px", marginBottom:8, cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor="#3b82f6"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor="#1e293b"}>
                  <span style={{ fontSize:22 }}>{c.gender==="female"?"🐄":"🐂"}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:"#f1f5f9" }}>{c.name||"—"}</div>
                    <div style={{ fontSize:11, color:"#475569", fontFamily:"monospace" }}>{c.earTag}</div>
                  </div>
                  <PhaseChip months={m} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 右パネル：個体詳細 */}
      {selCattle && (
        <div style={{ position:"absolute", right:0, top:0, bottom:0, width:300, background:"#0b1524f0", backdropFilter:"blur(12px)", borderLeft:"1px solid #1e293b", zIndex:220, display:"flex", flexDirection:"column", overflowY:"auto" }}>
          <div style={{ padding:"20px 16px 12px", borderBottom:"1px solid #1e293b" }}>
            <button onClick={()=>setSelCattle(null)} style={{ background:"none", border:"none", color:"#475569", fontSize:13, cursor:"pointer", marginBottom:10, padding:0 }}>← {selBarn} に戻る</button>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:44 }}>{selCattle.gender==="female"?"🐄":"🐂"}</span>
              <div>
                <div style={{ fontSize:20, fontWeight:900, color:"#f1f5f9" }}>{selCattle.name||"名前なし"}</div>
                <div style={{ fontSize:12, color:"#475569", fontFamily:"monospace" }}>{selCattle.earTag}</div>
              </div>
            </div>
            <div style={{ marginTop:10 }}><PhaseChip months={getAgeMonths(selCattle.birthDate)} /></div>
          </div>
          <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:8 }}>
            {[
              ["牛舎", selCattle.barn],
              ["性別", selCattle.gender==="female"?"雌":"雄"],
              ["生年月日", selCattle.birthDate],
              ["導入日", selCattle.arrivalDate],
              ["月齢", formatAge(getAgeMonths(selCattle.birthDate))],
            ].map(([l,v])=>(
              <div key={l} style={{ background:"#0f172a", borderRadius:10, padding:"10px 14px" }}>
                <div style={{ fontSize:10, color:"#475569", marginBottom:3 }}>{l}</div>
                <div style={{ fontSize:14, fontWeight:700, color:"#f1f5f9" }}>{v||"—"}</div>
              </div>
            ))}
            <div style={{ background:"#0f172a", borderRadius:10, padding:"12px 14px" }}>
              <div style={{ fontSize:10, color:"#fbbf24", marginBottom:8, fontWeight:700 }}>🌾 飼料情報</div>
              {[
                ["配合飼料", selCattle.feed],
                ["給与量（日）", selCattle.feedAmount?`${selCattle.feedAmount} kg`:"—"],
                ["給与回数", selCattle.feedTimes?`${selCattle.feedTimes} 回`:"—"],
                ["飼料備考", selCattle.feedMemo],
              ].map(([l,v])=>(
                <div key={l} style={{ marginBottom:6 }}>
                  <div style={{ fontSize:10, color:"#475569" }}>{l}</div>
                  <div style={{ fontSize:13, color:"#f1f5f9" }}>{v||"—"}</div>
                </div>
              ))}
            </div>
            {selCattle.memo && (
              <div style={{ background:"#2a1010", border:"1px solid #7f1d1d", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#f87171" }}>⚠ {selCattle.memo}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ADMIN MODE ───────────────────────────────────────────────
function AdminMode({ db, update, onSwitchView, setToast }) {
  const { cattle, barns, feeds=[], mapImage, barnPins=[] } = db;
  const [tab, setTab]           = useState("cattle");
  const [form, setForm]         = useState(EMPTY_FORM);
  const [listOpen, setListOpen] = useState(false);
  const [search, setSearch]     = useState("");
  const [newBarn, setNewBarn]   = useState("");
  const [newFeed, setNewFeed]   = useState("");
  const [zoom, setZoom]         = useState({ scale:1, x:0, y:0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [placing, setPlacing]   = useState(false);
  const [continuous, setContinuous] = useState(true);
  const [pins, setPins]         = useState(barnPins);
  const [pendingPos, setPendingPos] = useState(null);
  const [pendingBarn, setPendingBarn] = useState("");
  const [pinHistory, setPinHistory] = useState([]);
  const [pinSearch, setPinSearch] = useState("");
  const imgRef     = useRef();
  const fileMapRef = useRef();
  const fileDataRef= useRef();

  useEffect(()=>{ if(tab==="pins") setPins(barnPins); },[tab]);

  const scale    = zoom.scale;
  const placed   = new Set(pins.map(p=>p.barn));
  const unplaced = barns.filter(b=>!placed.has(b));
  const pct      = barns.length>0 ? Math.round(pins.length/barns.length*100) : 0;

  function toast(msg) { setToast(msg); }
  function setF(k,v)  { setForm(f=>({...f,[k]:v})); }

  function handleRegister() {
    if (!form.earTag||!form.birthDate||!form.arrivalDate||!form.barn) { alert("必須項目を入力してください（耳標番号・生年月日・導入日・牛舎）"); return; }
    if (cattle.find(c=>c.earTag===form.earTag)) { alert("この耳標番号はすでに登録されています"); return; }
    update({cattle:[...cattle,{...form,id:uid()}]}); setForm(EMPTY_FORM); toast("個体を登録しました");
  }
  function handleDelete(id) {
    if(!window.confirm("削除しますか？")) return;
    update({cattle:cattle.filter(c=>c.id!==id)}); toast("削除しました");
  }

  function handleMapClick(e) {
    if(!placing||dragging) return;
    const rect=imgRef.current.getBoundingClientRect();
    setPendingPos({ x:(e.clientX-rect.left)/rect.width, y:(e.clientY-rect.top)/rect.height });
    if(!pendingBarn) setPendingBarn(unplaced[0]||barns[0]||"");
  }
  function confirmPin() {
    if(!pendingBarn||!pendingPos) return;
    const next=[...pins.filter(p=>p.barn!==pendingBarn),{barn:pendingBarn,x:pendingPos.x,y:pendingPos.y}];
    setPinHistory(h=>[...h,pins]); setPins(next); update({barnPins:next});
    toast(`「${pendingBarn}」を配置しました`);
    const rem=unplaced.filter(b=>b!==pendingBarn);
    if(continuous&&rem.length>0){ setPendingPos(null); setPendingBarn(rem[0]); }
    else setPendingPos(null);
  }
  function removePin(barn){ const next=pins.filter(p=>p.barn!==barn); setPins(next); update({barnPins:next}); toast("ピンを削除しました"); }
  function handleUndo(){ if(!pinHistory.length) return; const prev=pinHistory[pinHistory.length-1]; setPins(prev); update({barnPins:prev}); setPinHistory(h=>h.slice(0,-1)); toast("取り消しました"); }
  function doZoom(d){ setZoom(z=>({...z,scale:Math.min(6,Math.max(1,z.scale+d))})); }
  function onMD(e){ if(scale<=1) return; setDragging(true); setDragStart({x:e.clientX-zoom.x,y:e.clientY-zoom.y}); }
  function onMM(e){ if(!dragging||!dragStart) return; setZoom(z=>({...z,x:e.clientX-dragStart.x,y:e.clientY-dragStart.y})); }
  function onMU(){ setDragging(false); }
  function onWheel(e){ e.preventDefault(); doZoom(e.deltaY<0?0.4:-0.4); }

  function handleExport(){ const b=new Blob([JSON.stringify(db,null,2)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download=`cattle_backup_${new Date().toISOString().slice(0,10)}.json`; a.click(); }
  function handleImport(e){ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>{ try{ const d=JSON.parse(ev.target.result); update(d); toast(`インポート完了（${d.cattle?.length||0}頭）`); }catch{ alert("読み込みに失敗しました"); } }; r.readAsText(f); e.target.value=""; }
  function handleMapUpload(e){ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>update({mapImage:ev.target.result}); r.readAsDataURL(f); e.target.value=""; }

  const TABS=[["cattle","🐄","個体登録"],["barns","⌂","牛舎管理"],["feeds","🌾","配合飼料"],["pins","📍","ピン配置"],["data","↕","データ管理"]];
  const transform=`translate(${zoom.x}px,${zoom.y}px) scale(${scale})`;
  const filteredSearch=cattle.filter(c=>!search||(c.earTag+c.name+c.barn).includes(search));
  const filteredUnplaced=unplaced.filter(b=>!pinSearch||b.includes(pinSearch));

  return (
    <div style={{ position:"fixed", inset:0, background:"#060d18", display:"flex", flexDirection:"column" }}>
      <div style={{ background:"#0b1524", borderBottom:"1px solid #1e293b", padding:"10px 20px", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
        <button onClick={onSwitchView} style={{ background:"#1e293b", border:"1px solid #334155", borderRadius:10, padding:"7px 14px", color:"#94a3b8", fontSize:13, cursor:"pointer" }}>← マップへ戻る</button>
        <span style={{ fontSize:18, fontWeight:800, color:"#f1f5f9", marginLeft:6 }}>管理モード</span>
        <div style={{ marginLeft:"auto", fontSize:12, color:"#475569" }}>総頭数 <b style={{ color:"#fbbf24" }}>{cattle.length}</b></div>
      </div>
      <div style={{ background:"#0b1524", borderBottom:"1px solid #1e293b", display:"flex", flexShrink:0, overflowX:"auto" }}>
        {TABS.map(([id,icon,label])=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{ background:tab===id?"#1e293b":"transparent", border:"none", borderBottom:tab===id?"2px solid #3b82f6":"2px solid transparent", padding:"12px 18px", color:tab===id?"#f1f5f9":"#475569", fontSize:13, fontWeight:tab===id?700:400, cursor:"pointer", whiteSpace:"nowrap" }}>
            {icon} {label}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:tab==="pins"?"hidden":"auto", padding:tab==="pins"?0:"24px 28px", display:"flex", flexDirection:tab==="pins"?"row":"column" }}>

        {/* ══ 個体登録 ══ */}
        {tab==="cattle" && (
          <div style={{ maxWidth:560 }}>
            <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:18, padding:24, marginBottom:20 }}>
              <div style={{ fontSize:16, fontWeight:800, color:"#f1f5f9", marginBottom:18 }}>新規個体登録</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
                <FInput label="耳標番号 *" value={form.earTag} onChange={e=>setF("earTag",e.target.value)} placeholder="例: JP001" />
                <FInput label="名前" value={form.name} onChange={e=>setF("name",e.target.value)} placeholder="例: はなこ" />
                <FInput label="生年月日 *" type="date" value={form.birthDate} onChange={e=>setF("birthDate",e.target.value)} />
                <FInput label="導入日 *" type="date" value={form.arrivalDate} onChange={e=>setF("arrivalDate",e.target.value)} />
              </div>
              <FSel label="牛舎 *" value={form.barn} onChange={e=>setF("barn",e.target.value)}
                options={[{value:"",label:"-- 選択 --"},...barns.map(b=>({value:b,label:b}))]} />
              <FSel label="性別" value={form.gender} onChange={e=>setF("gender",e.target.value)}
                options={[{value:"female",label:"雌"},{value:"male",label:"雄"}]} />
              <div style={{ background:"#060d18", border:"1px solid #1e293b", borderRadius:12, padding:"14px 16px", marginBottom:14 }}>
                <div style={{ fontSize:11, color:"#fbbf24", marginBottom:12, fontWeight:700 }}>🌾 飼料情報</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 16px" }}>
                  <FSel label="配合飼料" value={form.feed} onChange={e=>setF("feed",e.target.value)}
                    options={[{value:"",label:"-- 選択 --"},...feeds.map(f=>({value:f,label:f}))]} />
                  <FInput label="給与量（kg/日）" value={form.feedAmount} onChange={e=>setF("feedAmount",e.target.value)} placeholder="例: 3.5" type="number" step="0.1" />
                  <FSel label="給与回数" value={form.feedTimes} onChange={e=>setF("feedTimes",e.target.value)}
                    options={["1","2","3","4"].map(v=>({value:v,label:`${v}回`}))} />
                  <FInput label="飼料備考" value={form.feedMemo} onChange={e=>setF("feedMemo",e.target.value)} placeholder="任意" />
                </div>
              </div>
              <FInput label="メモ" value={form.memo} onChange={e=>setF("memo",e.target.value)} placeholder="任意" />
              <button onClick={handleRegister} style={{ width:"100%", background:"#1d4ed8", border:"none", borderRadius:12, padding:"13px", color:"#fff", fontSize:15, fontWeight:800, cursor:"pointer", marginTop:4 }}>登録する</button>
            </div>
            <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:18, padding:24 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <div style={{ fontSize:14, fontWeight:700, color:"#f1f5f9" }}>登録済み <span style={{ color:"#60a5fa" }}>{cattle.length}</span>頭</div>
                <button onClick={()=>setListOpen(v=>!v)} style={{ background:"#1e293b", border:"none", borderRadius:8, padding:"6px 14px", color:"#94a3b8", fontSize:12, cursor:"pointer" }}>{listOpen?"▲ 閉じる":"▼ 一覧表示"}</button>
              </div>
              {listOpen && (
                <>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 耳標番号・名前・牛舎で検索"
                    style={{ width:"100%", background:"#060d18", border:"1px solid #1e293b", borderRadius:10, padding:"9px 13px", color:"#f1f5f9", fontSize:13, outline:"none", marginBottom:12, boxSizing:"border-box" }} />
                  {filteredSearch.map(c=>{
                    const m=getAgeMonths(c.birthDate);
                    return (
                      <div key={c.id} style={{ background:"#060d18", border:"1px solid #1e293b", borderRadius:12, padding:"12px 14px", marginBottom:8, display:"flex", alignItems:"center", gap:10 }}>
                        <span>{c.gender==="female"?"🐄":"🐂"}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:"#f1f5f9" }}>{c.name||"—"} <span style={{ color:"#475569", fontSize:11, fontFamily:"monospace" }}>{c.earTag}</span></div>
                          <div style={{ fontSize:11, color:"#475569" }}>{c.barn}　{c.feed||"飼料未設定"}</div>
                        </div>
                        <PhaseChip months={m} />
                        <button onClick={()=>handleDelete(c.id)} style={{ background:"#2a1010", border:"1px solid #7f1d1d", borderRadius:8, padding:"4px 10px", color:"#f87171", fontSize:12, cursor:"pointer" }}>×</button>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}

        {/* ══ 牛舎管理 ══ */}
        {tab==="barns" && (
          <div style={{ maxWidth:520 }}>
            <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:18, padding:24, marginBottom:20 }}>
              <div style={{ fontSize:15, fontWeight:800, color:"#f1f5f9", marginBottom:16 }}>牛舎を追加</div>
              <div style={{ display:"flex", gap:10 }}>
                <input value={newBarn} onChange={e=>setNewBarn(e.target.value)} placeholder="牛舎名（例：A-06号舎）"
                  style={{ flex:1, background:"#060d18", border:"1.5px solid #1e293b", borderRadius:10, padding:"10px 13px", color:"#f1f5f9", fontSize:14, outline:"none" }} />
                <button onClick={()=>{
                  if(!newBarn.trim()) return;
                  if(barns.includes(newBarn.trim())){ alert("同じ名前の牛舎が存在します"); return; }
                  update({barns:[...barns,newBarn.trim()]}); setNewBarn(""); toast("牛舎を追加しました");
                }} style={{ background:"#1d4ed8", border:"none", borderRadius:10, padding:"10px 20px", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>追加</button>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {barns.map(b=>{
                const count=cattle.filter(c=>c.barn===b).length;
                const pc=pinColor(b,cattle);
                const pinned=barnPins.find(p=>p.barn===b);
                return (
                  <div key={b} style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:14, padding:"14px 18px", display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ width:14,height:14,borderRadius:"50%",background:pc.color,flexShrink:0 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:"#f1f5f9" }}>{b}</div>
                      <div style={{ fontSize:11, color:"#475569", marginTop:2 }}>{count}頭　{pinned?"📍 配置済":"○ 未配置"}　{pc.label}</div>
                    </div>
                    <button onClick={()=>{
                      if(!window.confirm(`「${b}」を削除しますか？\n※個体データは保持されます`)) return;
                      update({barns:barns.filter(x=>x!==b),barnPins:barnPins.filter(p=>p.barn!==b)}); toast("牛舎を削除しました");
                    }} style={{ background:"#2a1010", border:"1px solid #7f1d1d", borderRadius:8, padding:"5px 12px", color:"#f87171", fontSize:12, cursor:"pointer" }}>削除</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ 配合飼料マスター ══ */}
        {tab==="feeds" && (
          <div style={{ maxWidth:480 }}>
            <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:18, padding:24, marginBottom:20 }}>
              <div style={{ fontSize:15, fontWeight:800, color:"#f1f5f9", marginBottom:16 }}>🌾 配合飼料を追加</div>
              <div style={{ display:"flex", gap:10 }}>
                <input value={newFeed} onChange={e=>setNewFeed(e.target.value)} placeholder="飼料名（例：配合飼料D）"
                  style={{ flex:1, background:"#060d18", border:"1.5px solid #1e293b", borderRadius:10, padding:"10px 13px", color:"#f1f5f9", fontSize:14, outline:"none" }} />
                <button onClick={()=>{
                  if(!newFeed.trim()) return;
                  if(feeds.includes(newFeed.trim())){ alert("同じ名前の飼料が存在します"); return; }
                  update({feeds:[...feeds,newFeed.trim()]}); setNewFeed(""); toast("飼料を追加しました");
                }} style={{ background:"#1d4ed8", border:"none", borderRadius:10, padding:"10px 20px", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>追加</button>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {feeds.length===0&&<div style={{ color:"#334155", textAlign:"center", padding:32, fontSize:13 }}>配合飼料が登録されていません</div>}
              {feeds.map(f=>{
                const useCount=cattle.filter(c=>c.feed===f).length;
                return (
                  <div key={f} style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:14, padding:"14px 18px", display:"flex", alignItems:"center", gap:12 }}>
                    <span style={{ fontSize:20 }}>🌾</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:"#f1f5f9" }}>{f}</div>
                      <div style={{ fontSize:11, color:"#475569", marginTop:2 }}>{useCount}頭が使用中</div>
                    </div>
                    <button onClick={()=>{
                      if(useCount>0&&!window.confirm(`「${f}」を削除しますか？\n${useCount}頭の飼料情報が空欄になります`)) return;
                      update({feeds:feeds.filter(x=>x!==f),cattle:cattle.map(c=>c.feed===f?{...c,feed:""}:c)}); toast("飼料を削除しました");
                    }} style={{ background:"#2a1010", border:"1px solid #7f1d1d", borderRadius:8, padding:"5px 12px", color:"#f87171", fontSize:12, cursor:"pointer" }}>削除</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ ピン配置 ══ */}
        {tab==="pins" && (
          <>
            <div style={{ position:"absolute", top:90, left:0, right:0, zIndex:50, background:"#0b1524", borderBottom:"1px solid #1e293b", padding:"8px 16px", display:"flex", gap:10, alignItems:"center" }}>
              <button onClick={()=>{ setPlacing(v=>!v); setPendingPos(null); }}
                style={{ background:placing?"#1d4ed8":"#1e293b", border:`1px solid ${placing?"#3b82f6":"#334155"}`, borderRadius:10, padding:"8px 16px", color:placing?"#fff":"#94a3b8", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                {placing?"📍 配置中… タップで設置":"＋ 配置モードON"}
              </button>
              <button onClick={()=>setContinuous(v=>!v)}
                style={{ background:continuous?"#14532d":"#1e293b", border:`1px solid ${continuous?"#22c55e":"#334155"}`, borderRadius:10, padding:"8px 14px", color:continuous?"#4ade80":"#64748b", fontSize:12, cursor:"pointer" }}>
                {continuous?"✓ 連続配置ON":"連続配置OFF"}
              </button>
              <button onClick={handleUndo} disabled={!pinHistory.length}
                style={{ background:"#1e293b", border:"1px solid #334155", borderRadius:10, padding:"8px 14px", color:pinHistory.length?"#94a3b8":"#334155", fontSize:12, cursor:pinHistory.length?"pointer":"default" }}>↩ 取り消し</button>
              <div style={{ flex:1 }} />
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ background:"#1e293b", borderRadius:20, height:8, width:100, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:pct===100?"#22c55e":"#3b82f6", borderRadius:20, transition:"width 0.3s" }} />
                </div>
                <span style={{ fontSize:12, color:pct===100?"#22c55e":"#64748b", fontWeight:700 }}>{pins.length}/{barns.length}</span>
              </div>
              <span style={{ fontSize:11, color:"#334155" }}>×{scale.toFixed(1)}</span>
            </div>

            <div style={{ flex:1, position:"relative", overflow:"hidden", marginTop:44, cursor:placing?"crosshair":(dragging?"grabbing":"grab") }}
              onWheel={onWheel} onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}>
              {!mapImage ? (
                <div onClick={()=>fileMapRef.current.click()} style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, cursor:"pointer" }}>
                  <div style={{ fontSize:64, opacity:0.15 }}>🗺</div>
                  <div style={{ fontSize:15, color:"#334155" }}>タップして農場地図をアップロード</div>
                  <input ref={fileMapRef} type="file" accept="image/*" onChange={handleMapUpload} style={{ display:"none" }} />
                </div>
              ) : (
                <>
                  <div style={{ position:"absolute", inset:0, transformOrigin:"0 0", transform, transition:dragging?"none":"transform 0.18s ease" }}>
                    <img ref={imgRef} src={mapImage} alt="農場マップ" style={{ width:"100%", height:"100%", objectFit:"contain", display:"block", userSelect:"none" }}
                      onClick={handleMapClick} />
                    {pins.map(pin=>{
                      const pc=pinColor(pin.barn,cattle);
                      return (
                        <div key={pin.barn} style={{ position:"absolute", left:`${pin.x*100}%`, top:`${pin.y*100}%`, transform:"translate(-50%,-100%)", zIndex:10, pointerEvents:"none" }}>
                          <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                            <div style={{ background:pc.color, border:"2px solid #fff", width:22, height:22, borderRadius:"50% 50% 50% 0", transform:"rotate(-45deg)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10 }}>
                              <span style={{ transform:"rotate(45deg)" }}>⌂</span>
                            </div>
                            {scale>=2 && (
                              <div style={{ background:"#0f172add", color:"#e2e8f0", fontSize:9, borderRadius:5, padding:"1px 5px", marginTop:1, whiteSpace:"nowrap", display:"flex", gap:4, alignItems:"center", pointerEvents:"all" }}>
                                {pin.barn}
                                <span onClick={()=>removePin(pin.barn)} style={{ color:"#f87171", cursor:"pointer" }}>×</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {pendingPos && (
                      <div style={{ position:"absolute", left:`${pendingPos.x*100}%`, top:`${pendingPos.y*100}%`, transform:"translate(-50%,-100%)", zIndex:30 }}
                        onClick={e=>e.stopPropagation()}>
                        <div style={{ background:"#0b1524", border:"1.5px solid #fbbf24", borderRadius:14, padding:"12px 14px", boxShadow:"0 4px 24px #00000099", minWidth:180, marginBottom:6, pointerEvents:"all" }}>
                          <div style={{ fontSize:12, color:"#fbbf24", fontWeight:700, marginBottom:8 }}>どの牛舎を配置？</div>
                          <select value={pendingBarn} onChange={e=>setPendingBarn(e.target.value)}
                            style={{ width:"100%", background:"#060d18", border:"1px solid #1e293b", borderRadius:8, padding:"7px 10px", color:"#f1f5f9", fontSize:12, outline:"none", marginBottom:10 }}>
                            {barns.map(b=><option key={b} value={b}>{b}{placed.has(b)&&b!==pendingBarn?" (配置済)":""}</option>)}
                          </select>
                          <div style={{ display:"flex", gap:8 }}>
                            <button onClick={confirmPin} style={{ flex:1, background:"#1d4ed8", border:"none", borderRadius:8, padding:8, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>配置</button>
                            <button onClick={()=>setPendingPos(null)} style={{ flex:1, background:"#1e293b", border:"none", borderRadius:8, padding:8, color:"#94a3b8", fontSize:13, cursor:"pointer" }}>キャンセル</button>
                          </div>
                        </div>
                        <div style={{ display:"flex", justifyContent:"center" }}>
                          <div style={{ background:"#fbbf24", border:"3px solid #fff", width:22, height:22, borderRadius:"50% 50% 50% 0", transform:"rotate(-45deg)" }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ position:"absolute", right:16, bottom:16, display:"flex", flexDirection:"column", gap:6, zIndex:100 }}>
                    {[["＋",0.5],["－",-0.5]].map(([l,d])=>(
                      <button key={l} onClick={()=>doZoom(d)} style={{ background:"#0b1524", border:"1px solid #1e293b", borderRadius:10, width:40, height:40, color:"#e2e8f0", fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>{l}</button>
                    ))}
                    <button onClick={()=>setZoom({scale:1,x:0,y:0})} style={{ background:"#0b1524", border:"1px solid #1e293b", borderRadius:10, width:40, height:40, color:"#64748b", fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>⟲</button>
                  </div>
                </>
              )}
            </div>

            <div style={{ width:220, background:"#0b1524", borderLeft:"1px solid #1e293b", display:"flex", flexDirection:"column", overflow:"hidden", marginTop:44 }}>
              <div style={{ padding:"12px 12px 8px", borderBottom:"1px solid #1e293b" }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#f1f5f9", marginBottom:8 }}>未配置 <span style={{ color:"#f87171" }}>{unplaced.length}</span></div>
                <input value={pinSearch} onChange={e=>setPinSearch(e.target.value)} placeholder="🔍 絞り込み"
                  style={{ width:"100%", background:"#060d18", border:"1px solid #1e293b", borderRadius:8, padding:"7px 10px", color:"#f1f5f9", fontSize:12, outline:"none", boxSizing:"border-box" }} />
              </div>
              <div style={{ flex:1, overflowY:"auto", padding:"6px 8px" }}>
                {filteredUnplaced.length===0&&<div style={{ color:"#22c55e", textAlign:"center", padding:20, fontSize:12 }}>✓ 全牛舎配置済み</div>}
                {filteredUnplaced.map(b=>(
                  <div key={b} onClick={()=>{ if(placing) setPendingBarn(b); }}
                    style={{ padding:"6px 10px", borderRadius:8, marginBottom:2, fontSize:12, color:placing?"#94a3b8":"#475569", background:pendingBarn===b&&placing?"#1e3a5f":"transparent", cursor:placing?"pointer":"default", borderLeft:pendingBarn===b&&placing?"2px solid #3b82f6":"2px solid transparent" }}>
                    {b}
                  </div>
                ))}
              </div>
              {pins.length>0 && (
                <div style={{ borderTop:"1px solid #1e293b", padding:"8px 12px", maxHeight:140, overflowY:"auto" }}>
                  <div style={{ fontSize:11, color:"#475569", marginBottom:5 }}>配置済み {pins.length}</div>
                  {[...pins].reverse().map(p=>{
                    const pc=pinColor(p.barn,cattle);
                    return (
                      <div key={p.barn} style={{ fontSize:11, color:pc.color, padding:"2px 0", display:"flex", alignItems:"center", gap:4 }}>
                        <div style={{ width:6,height:6,borderRadius:"50%",background:pc.color,flexShrink:0 }} />
                        {p.barn}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ══ データ管理 ══ */}
        {tab==="data" && (
          <div style={{ maxWidth:520, display:"flex", flexDirection:"column", gap:18 }}>
            <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:18, padding:28 }}>
              <div style={{ fontSize:15, fontWeight:800, color:"#f1f5f9", marginBottom:8 }}>エクスポート</div>
              <div style={{ fontSize:13, color:"#475569", marginBottom:20 }}>全データ（個体・牛舎・飼料マスター・地図・ピン）をJSONファイルとして保存します。</div>
              <button onClick={handleExport} style={{ background:"#0f2d4a", border:"1px solid #1e6fa0", borderRadius:12, padding:"12px 26px", color:"#60a5fa", fontSize:14, fontWeight:700, cursor:"pointer" }}>
                ↓ JSONエクスポート（{cattle.length}頭）
              </button>
            </div>
            <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:18, padding:28 }}>
              <div style={{ fontSize:15, fontWeight:800, color:"#f1f5f9", marginBottom:8 }}>インポート</div>
              <div style={{ fontSize:12, color:"#f87171", background:"#2a1010", border:"1px solid #7f1d1d", borderRadius:8, padding:"8px 14px", marginBottom:18 }}>⚠ 現在のデータは全て上書きされます</div>
              <input ref={fileDataRef} type="file" accept=".json" onChange={handleImport} style={{ display:"none" }} />
              <button onClick={()=>fileDataRef.current.click()} style={{ background:"#14291a", border:"1px solid #166534", borderRadius:12, padding:"12px 26px", color:"#4ade80", fontSize:14, fontWeight:700, cursor:"pointer" }}>↑ JSONインポート</button>
            </div>
            <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:18, padding:28 }}>
              <div style={{ fontSize:15, fontWeight:800, color:"#f1f5f9", marginBottom:8 }}>地図の変更</div>
              <input ref={fileMapRef} type="file" accept="image/*" onChange={handleMapUpload} style={{ display:"none" }} />
              <button onClick={()=>fileMapRef.current.click()} style={{ background:"#1e293b", border:"1px solid #334155", borderRadius:12, padding:"12px 26px", color:"#94a3b8", fontSize:14, fontWeight:700, cursor:"pointer" }}>🖼 地図を再アップロード</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────
export default function App() {
  const [db, setDb]       = useState(loadDB);
  const [mode, setMode]   = useState("view");
  const [toast, setToast] = useState("");
  function update(patch) { const next={...db,...patch}; setDb(next); saveDB(next); }
  return (
    <>
      <style>{`* { box-sizing:border-box; -webkit-tap-highlight-color:transparent; margin:0; padding:0; } body { overflow:hidden; }`}</style>
      {mode==="view"
        ? <ViewMode  db={db} onSwitchAdmin={()=>setMode("admin")} />
        : <AdminMode db={db} update={update} onSwitchView={()=>setMode("view")} setToast={setToast} />
      }
      {toast && <Toast msg={toast} onDone={()=>setToast("")} />}
    </>
  );
}
