import { useState, useEffect, useRef } from "react";

// ─── Local DB ───────────────────────────────────────────────
const STORAGE_KEY = "cattle_db_v2";
function loadDB() {
  try { const r = localStorage.getItem(STORAGE_KEY); if (r) return JSON.parse(r); } catch {}
  return {
    cattle: [
      { id: "1", earTag: "JP1234567", name: "はなこ", birthDate: "2022-03-15", arrivalDate: "2022-04-01", barn: "第1牛舎", gender: "female", memo: "" },
      { id: "2", earTag: "JP2345678", name: "たろう", birthDate: "2021-11-20", arrivalDate: "2021-12-10", barn: "第1牛舎", gender: "male",   memo: "" },
      { id: "3", earTag: "JP3456789", name: "くろ",   birthDate: "2023-01-05", arrivalDate: "2023-02-01", barn: "第2牛舎", gender: "female", memo: "要観察" },
      { id: "4", earTag: "JP4567890", name: "しろ",   birthDate: "2020-06-30", arrivalDate: "2020-08-01", barn: "第2牛舎", gender: "female", memo: "" },
      { id: "5", earTag: "JP5678901", name: "あか",   birthDate: "2023-07-12", arrivalDate: "2023-08-01", barn: "第3牛舎", gender: "male",   memo: "" },
      { id: "6", earTag: "JP6789012", name: "そら",   birthDate: "2022-09-01", arrivalDate: "2022-10-15", barn: "放牧場",  gender: "female", memo: "" },
    ],
    barns: ["第1牛舎", "第2牛舎", "第3牛舎", "放牧場"],
    mapImage: null,
    barnPins: [],
  };
}
function saveDB(db) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch {} }

// ─── Helpers ─────────────────────────────────────────────────
function getAgeMonths(d) {
  const b = new Date(d), n = new Date();
  return (n.getFullYear() - b.getFullYear()) * 12 + n.getMonth() - b.getMonth();
}
function formatAge(m) {
  if (m < 1) return "1ヶ月未満";
  if (m < 12) return `${m}ヶ月`;
  const y = Math.floor(m / 12), r = m % 12;
  return r ? `${y}歳${r}ヶ月` : `${y}歳`;
}
function ageColor(m) {
  if (m < 6)  return "#4ade80";
  if (m < 18) return "#fbbf24";
  if (m < 36) return "#fb923c";
  return "#f87171";
}
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

const EMPTY_FORM = { earTag: "", name: "", birthDate: "", arrivalDate: "", barn: "", gender: "female", memo: "" };

// ─── Sub-components ──────────────────────────────────────────
function AgeChip({ months }) {
  const c = ageColor(months);
  return <span style={{ background: c + "22", color: c, border: `1px solid ${c}44`, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{formatAge(months)}</span>;
}

function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2000); return () => clearTimeout(t); });
  return (
    <div style={{ position: "fixed", bottom: 40, left: "50%", transform: "translateX(-50%)", background: "#166534", border: "1px solid #22c55e", color: "#dcfce7", borderRadius: 14, padding: "12px 28px", fontSize: 14, fontWeight: 700, boxShadow: "0 8px 32px #00000088", zIndex: 9999, whiteSpace: "nowrap" }}>
      ✓ {msg}
    </div>
  );
}

function FieldInput({ label, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 5, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</label>}
      <input {...props}
        onFocus={e => { setFocused(true); props.onFocus?.(e); }}
        onBlur={e => { setFocused(false); props.onBlur?.(e); }}
        style={{ width: "100%", background: "#0f172a", border: `1.5px solid ${focused ? "#3b82f6" : "#1e293b"}`, borderRadius: 10, padding: "11px 14px", color: "#f1f5f9", fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }} />
    </div>
  );
}

function FieldSelect({ label, options, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 5, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</label>}
      <select {...props} style={{ width: "100%", background: "#0f172a", border: "1.5px solid #1e293b", borderRadius: 10, padding: "11px 14px", color: "#f1f5f9", fontSize: 14, outline: "none", boxSizing: "border-box" }}>
        {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
      </select>
    </div>
  );
}

// ─── VIEW MODE: Full-screen map ───────────────────────────────
function ViewMode({ db, onSwitchAdmin }) {
  const { cattle, barns, mapImage, barnPins = [] } = db;
  const [selectedPin, setSelectedPin] = useState(null);
  const [detailCattle, setDetailCattle] = useState(null);
  const mapRef = useRef();

  const selectedBarnCattle = selectedPin ? cattle.filter(c => c.barn === selectedPin) : [];

  return (
    <div style={{ position: "fixed", inset: 0, background: "#060d18", display: "flex", flexDirection: "column" }}>
      {/* ── Top bar ── */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 100, display: "flex", alignItems: "center", padding: "14px 20px", background: "linear-gradient(180deg, #060d18ee 0%, transparent 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>🐄</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9", letterSpacing: 1 }}>牧場マップ</div>
            <div style={{ fontSize: 10, color: "#334155", letterSpacing: 2 }}>FARM VIEW</div>
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          {/* 統計バッジ */}
          <div style={{ background: "#0f172add", border: "1px solid #1e293b", borderRadius: 12, padding: "6px 14px", display: "flex", gap: 12 }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>総頭数</span>
            <span style={{ fontSize: 14, fontWeight: 900, color: "#fbbf24" }}>{cattle.length}</span>
            <span style={{ fontSize: 12, color: "#334155" }}>|</span>
            <span style={{ fontSize: 12, color: "#64748b" }}>牛舎</span>
            <span style={{ fontSize: 14, fontWeight: 900, color: "#60a5fa" }}>{barns.length}</span>
          </div>
          <button onClick={onSwitchAdmin}
            style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "8px 18px", color: "#94a3b8", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            ⚙ 管理
          </button>
        </div>
      </div>

      {/* ── Map area ── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {!mapImage ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <div style={{ fontSize: 72, opacity: 0.15 }}>🗺</div>
            <div style={{ fontSize: 18, color: "#334155", fontWeight: 700 }}>地図が登録されていません</div>
            <div style={{ fontSize: 13, color: "#1e293b" }}>管理画面から地図をアップロードしてください</div>
            <button onClick={onSwitchAdmin} style={{ background: "#1e3a5f", border: "1px solid #2563eb", borderRadius: 12, padding: "12px 28px", color: "#60a5fa", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>
              管理画面へ →
            </button>
          </div>
        ) : (
          <>
            <img ref={mapRef} src={mapImage} alt="農場マップ"
              onClick={() => { setSelectedPin(null); setDetailCattle(null); }}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", cursor: "default" }} />

            {/* Pins */}
            {barnPins.map(pin => {
              const count = cattle.filter(c => c.barn === pin.barn).length;
              const isActive = selectedPin === pin.barn;
              const col = isActive ? "#fbbf24" : "#3b82f6";
              return (
                <div key={pin.barn}
                  onClick={e => { e.stopPropagation(); setSelectedPin(isActive ? null : pin.barn); setDetailCattle(null); }}
                  style={{ position: "absolute", left: `${pin.x * 100}%`, top: `${pin.y * 100}%`, transform: "translate(-50%, -100%)", cursor: "pointer", zIndex: isActive ? 50 : 20 }}>
                  {/* Pin marker */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", filter: isActive ? "drop-shadow(0 0 12px #fbbf2488)" : "drop-shadow(0 2px 6px #00000099)" }}>
                    <div style={{ background: col, border: "3px solid #fff", width: 40, height: 40, borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg)", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s, transform 0.2s", ...(isActive ? { transform: "rotate(-45deg) scale(1.2)" } : {}) }}>
                      <span style={{ transform: "rotate(45deg)", fontSize: 18 }}>⌂</span>
                    </div>
                    <div style={{ background: isActive ? "#fbbf24" : "#0f172add", color: isActive ? "#000" : "#e2e8f0", fontSize: 11, fontWeight: 800, borderRadius: 8, padding: "2px 8px", marginTop: 3, border: `1px solid ${isActive ? "#fbbf24" : "#1e293b"}`, whiteSpace: "nowrap" }}>
                      {pin.barn} · {count}頭
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* ── Side panel: barn detail ── */}
      {selectedPin && !detailCattle && (
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 320, background: "#0b1524f0", backdropFilter: "blur(12px)", borderLeft: "1px solid #1e293b", zIndex: 200, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid #1e293b" }}>
            <button onClick={() => setSelectedPin(null)} style={{ background: "none", border: "none", color: "#475569", fontSize: 13, cursor: "pointer", marginBottom: 14, padding: 0 }}>← 閉じる</button>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#f1f5f9" }}>⌂ {selectedPin}</div>
            <div style={{ fontSize: 13, color: "#fbbf24", marginTop: 4, fontWeight: 700 }}>{selectedBarnCattle.length} 頭在籍</div>
          </div>
          <div style={{ padding: "12px 16px", flex: 1 }}>
            {selectedBarnCattle.length === 0 ? (
              <div style={{ color: "#334155", textAlign: "center", padding: 32, fontSize: 13 }}>この牛舎に個体がいません</div>
            ) : selectedBarnCattle.map(c => {
              const months = getAgeMonths(c.birthDate);
              return (
                <div key={c.id} onClick={() => setDetailCattle(c)}
                  style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "12px 14px", marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, transition: "border-color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#3b82f6"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#1e293b"}>
                  <span style={{ fontSize: 22 }}>{c.gender === "female" ? "🐄" : "🐂"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{c.name || "—"}</div>
                    <div style={{ fontSize: 11, color: "#475569", fontFamily: "monospace" }}>{c.earTag}</div>
                  </div>
                  <AgeChip months={months} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Side panel: individual detail ── */}
      {detailCattle && (
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 320, background: "#0b1524f0", backdropFilter: "blur(12px)", borderLeft: "1px solid #1e293b", zIndex: 210, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid #1e293b" }}>
            <button onClick={() => setDetailCattle(null)} style={{ background: "none", border: "none", color: "#475569", fontSize: 13, cursor: "pointer", marginBottom: 14, padding: 0 }}>← {selectedPin} に戻る</button>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 44 }}>{detailCattle.gender === "female" ? "🐄" : "🐂"}</span>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#f1f5f9" }}>{detailCattle.name || "名前なし"}</div>
                <div style={{ fontSize: 11, color: "#475569", fontFamily: "monospace" }}>{detailCattle.earTag}</div>
              </div>
            </div>
          </div>
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            <AgeChip months={getAgeMonths(detailCattle.birthDate)} />
            {[["牛舎", detailCattle.barn], ["性別", detailCattle.gender === "female" ? "雌" : "雄"], ["生年月日", detailCattle.birthDate], ["導入日", detailCattle.arrivalDate], ...(detailCattle.memo ? [["メモ", detailCattle.memo]] : [])].map(([label, val]) => (
              <div key={label} style={{ background: "#0f172a", borderRadius: 10, padding: "10px 14px" }}>
                <div style={{ fontSize: 10, color: "#475569", marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 14, color: "#f1f5f9", fontWeight: 600 }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Bottom bar: unmapped barns hint ── */}
      {mapImage && barnPins.length < barns.length && (
        <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "#0f172add", border: "1px solid #1e293b", borderRadius: 12, padding: "8px 18px", fontSize: 12, color: "#64748b", zIndex: 50 }}>
          未配置の牛舎があります — 管理画面でピンを追加できます
        </div>
      )}
    </div>
  );
}

// ─── ADMIN MODE ───────────────────────────────────────────────
const ADMIN_TABS = [
  { id: "cattle",  label: "個体登録",   icon: "🐄" },
  { id: "barns",   label: "牛舎管理",   icon: "⌂" },
  { id: "mappin",  label: "ピン配置",   icon: "📍" },
  { id: "data",    label: "データ管理", icon: "↕" },
];

function AdminMode({ db, update, onSwitchView, toast, setToast }) {
  const [tab, setTab]         = useState("cattle");
  const { cattle, barns, mapImage, barnPins = [] } = db;

  // cattle
  const [form, setForm]       = useState(EMPTY_FORM);
  const [formErr, setFormErr] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [showList, setShowList]     = useState(false);

  // barns
  const [newBarn, setNewBarn] = useState("");

  // map
  const mapRef    = useRef();
  const imgRef    = useRef();
  const fileMapRef = useRef();
  const fileDataRef = useRef();
  const [placing, setPlacing]       = useState(false);
  const [pendingPos, setPendingPos] = useState(null);
  const [pendingBarn, setPendingBarn] = useState("");

  function handleRegister() {
    if (!form.earTag.trim())  return setFormErr("耳標番号は必須です");
    if (!form.birthDate)      return setFormErr("生年月日は必須です");
    if (!form.arrivalDate)    return setFormErr("導入日は必須です");
    if (!form.barn)           return setFormErr("牛舎を選択してください");
    if (cattle.find(c => c.earTag === form.earTag.trim())) return setFormErr("この耳標番号はすでに登録されています");
    update({ cattle: [...cattle, { ...form, earTag: form.earTag.trim(), id: uid() }] });
    setForm({ ...EMPTY_FORM, barn: form.barn });
    setFormErr("");
    setToast("個体を登録しました");
  }

  function handleDeleteCattle(id) {
    if (!window.confirm("この個体を削除しますか？")) return;
    update({ cattle: cattle.filter(c => c.id !== id) });
    setToast("削除しました");
  }

  function handleAddBarn() {
    const n = newBarn.trim();
    if (!n || barns.includes(n)) return;
    update({ barns: [...barns, n] });
    setNewBarn("");
    setToast(`「${n}」を追加しました`);
  }

  function handleDeleteBarn(barn) {
    if (!window.confirm(`「${barn}」を削除しますか？\nこの牛舎に紐づく個体の牛舎情報は空になります。`)) return;
    update({
      barns: barns.filter(b => b !== barn),
      barnPins: barnPins.filter(p => p.barn !== barn),
      cattle: cattle.map(c => c.barn === barn ? { ...c, barn: "" } : c),
    });
    setToast(`「${barn}」を削除しました`);
  }

  function handleMapUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { update({ mapImage: ev.target.result }); setToast("地図を更新しました"); };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleMapClick(e) {
    if (!placing) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top)  / rect.height;
    const defaultBarn = barns.find(b => !barnPins.find(p => p.barn === b)) || barns[0] || "";
    setPendingPos({ x, y });
    setPendingBarn(defaultBarn);
  }

  function confirmPin() {
    if (!pendingBarn || !pendingPos) return;
    update({ barnPins: [...barnPins.filter(p => p.barn !== pendingBarn), { barn: pendingBarn, x: pendingPos.x, y: pendingPos.y }] });
    setPendingPos(null);
    setPlacing(false);
    setToast(`「${pendingBarn}」のピンを配置しました`);
  }

  function removePin(barn) {
    update({ barnPins: barnPins.filter(p => p.barn !== barn) });
    setToast("ピンを削除しました");
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cattle_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setToast("エクスポートしました");
  }

  function handleImport(e) {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
      try {
        const p = JSON.parse(ev.target.result);
        if (!p.cattle || !p.barns) throw 0;
        update(p); setToast(`${p.cattle.length}頭のデータを読み込みました`);
      } catch { alert("ファイル形式が正しくありません"); }
    };
    r.readAsText(file); e.target.value = "";
  }

  const filteredCattle = cattle.filter(c => !listSearch || c.earTag.includes(listSearch) || c.name.includes(listSearch));

  return (
    <div style={{ position: "fixed", inset: 0, background: "#060d18", display: "flex", flexDirection: "column" }}>
      {/* ── Admin Header ── */}
      <div style={{ background: "#0b1524", borderBottom: "1px solid #1e293b", padding: "14px 24px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
        <button onClick={onSwitchView}
          style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "8px 16px", color: "#60a5fa", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          ← マップへ戻る
        </button>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9", letterSpacing: 1 }}>管理画面</div>
        <div style={{ marginLeft: "auto", fontSize: 13, color: "#334155" }}>
          {cattle.length}頭 · {barns.length}牛舎
        </div>
      </div>

      {/* ── Admin Tab bar ── */}
      <div style={{ background: "#0b1524", borderBottom: "1px solid #1e293b", display: "flex", padding: "0 20px", flexShrink: 0 }}>
        {ADMIN_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: "13px 20px", fontSize: 13, fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? "#fbbf24" : "#475569", background: "none", border: "none", borderBottom: `2px solid ${tab === t.id ? "#fbbf24" : "transparent"}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "color 0.15s" }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Admin Content ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>

        {/* ══ 個体登録 ══ */}
        {tab === "cattle" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, maxWidth: 900 }}>
            {/* 登録フォーム */}
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 18, padding: 28 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#f1f5f9", marginBottom: 22 }}>新規個体登録</div>
              <FieldInput label="耳標番号 *" value={form.earTag} onChange={e => setForm(f => ({ ...f, earTag: e.target.value }))} placeholder="例：JP1234567" />
              <FieldInput label="名前（任意）" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="例：はなこ" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FieldInput label="生年月日 *" type="date" value={form.birthDate} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} />
                <FieldInput label="導入日 *"   type="date" value={form.arrivalDate} onChange={e => setForm(f => ({ ...f, arrivalDate: e.target.value }))} />
              </div>
              <FieldSelect label="牛舎 *" value={form.barn} onChange={e => setForm(f => ({ ...f, barn: e.target.value }))}
                options={[{ value: "", label: "— 選択 —" }, ...barns]} />
              <FieldSelect label="性別" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                options={[{ value: "female", label: "雌" }, { value: "male", label: "雄" }]} />
              <FieldInput label="メモ（任意）" value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} placeholder="例：要観察" />
              {formErr && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 12 }}>⚠ {formErr}</div>}
              <button onClick={handleRegister} style={{ width: "100%", background: "linear-gradient(90deg,#1d4ed8,#2563eb)", border: "none", borderRadius: 12, padding: 14, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
                登録する
              </button>
            </div>

            {/* 個体一覧 */}
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 18, padding: 28, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#f1f5f9" }}>登録済み ({cattle.length}頭)</div>
                <button onClick={() => setShowList(v => !v)} style={{ background: "#1e293b", border: "none", borderRadius: 8, padding: "6px 12px", color: "#94a3b8", fontSize: 12, cursor: "pointer" }}>
                  {showList ? "隠す" : "一覧表示"}
                </button>
              </div>
              {showList && (
                <>
                  <input value={listSearch} onChange={e => setListSearch(e.target.value)} placeholder="🔍 検索"
                    style={{ background: "#060d18", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 12px", color: "#f1f5f9", fontSize: 13, outline: "none", marginBottom: 12 }} />
                  <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                    {filteredCattle.map(c => (
                      <div key={c.id} style={{ background: "#0b1524", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 18 }}>{c.gender === "female" ? "🐄" : "🐂"}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>{c.name || "—"}</div>
                          <div style={{ fontSize: 11, color: "#475569" }}>{c.barn} · {c.earTag}</div>
                        </div>
                        <AgeChip months={getAgeMonths(c.birthDate)} />
                        <button onClick={() => handleDeleteCattle(c.id)} style={{ background: "none", border: "none", color: "#475569", fontSize: 16, cursor: "pointer", padding: "0 4px" }}>×</button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {!showList && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  {barns.map(b => {
                    const n = cattle.filter(c => c.barn === b).length;
                    return (
                      <div key={b} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#0b1524", borderRadius: 8 }}>
                        <span style={{ fontSize: 13, color: "#94a3b8" }}>⌂ {b}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>{n}頭</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ 牛舎管理 ══ */}
        {tab === "barns" && (
          <div style={{ maxWidth: 720 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))", gap: 14, marginBottom: 24 }}>
              {barns.map(barn => {
                const list = cattle.filter(c => c.barn === barn);
                const avg  = list.length ? Math.round(list.reduce((s, c) => s + getAgeMonths(c.birthDate), 0) / list.length) : 0;
                const pinned = barnPins.find(p => p.barn === barn);
                return (
                  <div key={barn} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 16, padding: "20px 22px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#f1f5f9" }}>⌂ {barn}</div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: pinned ? "#4ade80" : "#475569", background: pinned ? "#14532d44" : "#1e293b", borderRadius: 6, padding: "2px 8px" }}>
                          {pinned ? "📍配置済" : "未配置"}
                        </span>
                        <button onClick={() => handleDeleteBarn(barn)} style={{ background: "none", border: "none", color: "#374151", fontSize: 16, cursor: "pointer" }}>×</button>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div style={{ background: "#060d18", borderRadius: 8, padding: "8px 12px" }}>
                        <div style={{ fontSize: 10, color: "#475569" }}>頭数</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: "#fbbf24" }}>{list.length}</div>
                      </div>
                      <div style={{ background: "#060d18", borderRadius: 8, padding: "8px 12px" }}>
                        <div style={{ fontSize: 10, color: "#475569" }}>平均月齢</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#60a5fa" }}>{formatAge(avg)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* 追加 */}
            <div style={{ background: "#0f172a", border: "1.5px dashed #1e293b", borderRadius: 16, padding: "20px 22px" }}>
              <div style={{ fontSize: 13, color: "#475569", marginBottom: 12 }}>新しい牛舎を追加</div>
              <div style={{ display: "flex", gap: 10 }}>
                <input value={newBarn} onChange={e => setNewBarn(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddBarn()} placeholder="牛舎名を入力"
                  style={{ flex: 1, background: "#060d18", border: "1.5px solid #1e293b", borderRadius: 10, padding: "10px 14px", color: "#f1f5f9", fontSize: 14, outline: "none" }} />
                <button onClick={handleAddBarn} style={{ background: "#1d4ed8", border: "none", borderRadius: 10, padding: "10px 22px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  追加
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ ピン配置 ══ */}
        {tab === "mappin" && (
          <div>
            <div style={{ display: "flex", gap: 12, marginBottom: 18, alignItems: "center", flexWrap: "wrap" }}>
              <input ref={fileMapRef} type="file" accept="image/*" onChange={handleMapUpload} style={{ display: "none" }} />
              <button onClick={() => fileMapRef.current.click()} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "10px 18px", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                🖼 地図を{mapImage ? "変更" : "アップロード"}
              </button>
              {mapImage && (
                <button onClick={() => { setPlacing(v => !v); setPendingPos(null); }}
                  style={{ background: placing ? "#1d4ed8" : "#0f172a", border: `1px solid ${placing ? "#3b82f6" : "#1e293b"}`, borderRadius: 10, padding: "10px 18px", color: placing ? "#fff" : "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  {placing ? "📍 地図をタップして配置…" : "＋ 牛舎を配置"}
                </button>
              )}
              {placing && <div style={{ fontSize: 12, color: "#64748b" }}>地図上のピンを立てたい場所をタップしてください</div>}
            </div>

            {!mapImage ? (
              <div onClick={() => fileMapRef.current.click()}
                style={{ background: "#0f172a", border: "2px dashed #1e293b", borderRadius: 18, height: 400, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 12 }}>
                <div style={{ fontSize: 56, opacity: 0.2 }}>🗺</div>
                <div style={{ fontSize: 15, color: "#334155" }}>農場の地図画像をアップロード</div>
                <div style={{ fontSize: 12, color: "#1e293b" }}>JPG・PNG 対応</div>
              </div>
            ) : (
              <div style={{ position: "relative", display: "inline-block", width: "100%", border: "1px solid #1e293b", borderRadius: 14, overflow: "hidden", cursor: placing ? "crosshair" : "default" }}
                ref={mapRef}>
                <img ref={imgRef} src={mapImage} alt="農場マップ" onClick={handleMapClick} style={{ width: "100%", display: "block", userSelect: "none" }} />

                {barnPins.map(pin => (
                  <div key={pin.barn} style={{ position: "absolute", left: `${pin.x * 100}%`, top: `${pin.y * 100}%`, transform: "translate(-50%,-100%)", zIndex: 10 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ background: "#3b82f6", border: "2px solid #fff", width: 32, height: 32, borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                        <span style={{ transform: "rotate(45deg)" }}>⌂</span>
                      </div>
                      <div style={{ background: "#0f172add", color: "#f1f5f9", fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "2px 6px", marginTop: 2, display: "flex", gap: 6, alignItems: "center", whiteSpace: "nowrap" }}>
                        {pin.barn}
                        <span onClick={() => removePin(pin.barn)} style={{ color: "#f87171", cursor: "pointer", fontSize: 13, lineHeight: 1 }}>×</span>
                      </div>
                    </div>
                  </div>
                ))}

                {pendingPos && (
                  <div style={{ position: "absolute", left: `${pendingPos.x * 100}%`, top: `${pendingPos.y * 100}%`, transform: "translate(-50%,-100%)", zIndex: 30 }}
                    onClick={e => e.stopPropagation()}>
                    <div style={{ background: "#0b1524", border: "1px solid #3b82f6", borderRadius: 14, padding: "14px 16px", boxShadow: "0 4px 24px #00000099", minWidth: 190, marginBottom: 6 }}>
                      <div style={{ fontSize: 12, color: "#60a5fa", fontWeight: 700, marginBottom: 10 }}>どの牛舎を配置しますか？</div>
                      <select value={pendingBarn} onChange={e => setPendingBarn(e.target.value)}
                        style={{ width: "100%", background: "#060d18", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 10px", color: "#f1f5f9", fontSize: 13, outline: "none", marginBottom: 10 }}>
                        {barns.map(b => <option key={b} value={b}>{b}{barnPins.find(p => p.barn === b) ? " (配置済)" : ""}</option>)}
                      </select>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={confirmPin} style={{ flex: 1, background: "#1d4ed8", border: "none", borderRadius: 8, padding: 9, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>配置</button>
                        <button onClick={() => setPendingPos(null)} style={{ flex: 1, background: "#1e293b", border: "none", borderRadius: 8, padding: 9, color: "#94a3b8", fontSize: 13, cursor: "pointer" }}>キャンセル</button>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <div style={{ background: "#fbbf24", border: "3px solid #fff", width: 32, height: 32, borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                        <span style={{ transform: "rotate(45deg)" }}>?</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 配置状況 */}
            {mapImage && (
              <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                {barns.map(b => {
                  const pinned = barnPins.find(p => p.barn === b);
                  return (
                    <div key={b} style={{ background: "#0f172a", border: `1px solid ${pinned ? "#166534" : "#1e293b"}`, borderRadius: 10, padding: "6px 14px", fontSize: 12, color: pinned ? "#4ade80" : "#475569", display: "flex", alignItems: "center", gap: 6 }}>
                      {pinned ? "📍" : "○"} {b}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ データ管理 ══ */}
        {tab === "data" && (
          <div style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 18, padding: 28 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#f1f5f9", marginBottom: 8 }}>エクスポート</div>
              <div style={{ fontSize: 13, color: "#475569", marginBottom: 20 }}>全データをJSONファイルとして保存します。端末の引き継ぎ・バックアップに利用してください。</div>
              <button onClick={handleExport} style={{ background: "#0f2d4a", border: "1px solid #1e6fa0", borderRadius: 12, padding: "12px 26px", color: "#60a5fa", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                ↓ JSONエクスポート（{cattle.length}頭）
              </button>
            </div>
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 18, padding: 28 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#f1f5f9", marginBottom: 8 }}>インポート</div>
              <div style={{ fontSize: 12, color: "#f87171", background: "#2a1010", border: "1px solid #7f1d1d", borderRadius: 8, padding: "8px 14px", marginBottom: 18 }}>
                ⚠ 現在のデータは全て上書きされます
              </div>
              <input ref={fileDataRef} type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
              <button onClick={() => fileDataRef.current.click()} style={{ background: "#14291a", border: "1px solid #166534", borderRadius: 12, padding: "12px 26px", color: "#4ade80", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                ↑ JSONインポート
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Root ────────────────────────────────────────────────────
export default function App() {
  const [db, setDb]       = useState(loadDB);
  const [mode, setMode]   = useState("view"); // "view" | "admin"
  const [toast, setToast] = useState("");

  function update(patch) {
    const next = { ...db, ...patch };
    setDb(next);
    saveDB(next);
  }

  return (
    <>
      <style>{`* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; margin: 0; padding: 0; } body { overflow: hidden; }`}</style>
      {mode === "view"
        ? <ViewMode  db={db} onSwitchAdmin={() => setMode("admin")} />
        : <AdminMode db={db} update={update} onSwitchView={() => setMode("view")} toast={toast} setToast={setToast} />
      }
      {toast && <Toast msg={toast} onDone={() => setToast("")} />}
    </>
  );
}
