/* =========================================================
   SerCucTech – app.js (PWA + data/index.json)
   - Loader index.json + vetrine singole + groups
   - IndexedDB cache
   - TTS (con fix Android voci)
   - Admin Unlock 24h + Device Binding + Multi-device allowlist
   - Auto-voce SOLO prima volta per vetrina (per dispositivo)
   - Toggle globale Auto-Voce ON/OFF
========================================================= */

/* ===================== CONFIG ===================== */
const INDEX_PATH = "data/index.json";
const PINKEY = "sercuctech_pin";

/* ===================== PIN ===================== */
function initPin(){
  if(!localStorage.getItem(PINKEY)) localStorage.setItem(PINKEY, "1234");
}
function getPin(){ return localStorage.getItem(PINKEY); }
function setPin(newPin){ localStorage.setItem(PINKEY, String(newPin||"")); }

/* ===================== UTIL ===================== */
function qs(name){ return new URLSearchParams(location.search).get(name); }
function nowISO(){
  const d = new Date();
  const pad = n => String(n).padStart(2,"0");
  const offMin = -d.getTimezoneOffset();
  const sign = offMin >= 0 ? "+" : "-";
  const hh = pad(Math.floor(Math.abs(offMin)/60));
  const mm = pad(Math.abs(offMin)%60);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${hh}:${mm}`;
}
function sanitizeId(s){
  return (s||"").trim().toLowerCase().replace(/\s+/g,"").replace(/[^a-z0-9_-]/g,"");
}
function splitCSV(s){
  return (s||"").split(",").map(x=>x.trim()).filter(Boolean);
}
function escapeHtml(s){
  return String(s||"")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function isPdf(url){
  return String(url||"").toLowerCase().split("?")[0].endsWith(".pdf");
}
async function fetchJson(path){
  const res = await fetch(path + "?t=" + Date.now(), { cache:"no-store" });
  if(!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
  return await res.json();
}

/* ===================== SPEECH (TTS) ===================== */
function stopSpeak(){
  try{
    if("speechSynthesis" in window){
      window.speechSynthesis.cancel();
    }
  }catch(e){}
}

function speakText(text, opts={}){
  if(!text) return false;
  if(!("speechSynthesis" in window)) return false;
  try{
    stopSpeak();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = opts.lang || navigator.language || "it-IT";
    u.rate = Number(opts.rate ?? 1);
    u.pitch = Number(opts.pitch ?? 1);
    u.volume = Number(opts.volume ?? 1);
    window.speechSynthesis.speak(u);
    return true;
  }catch(e){
    return false;
  }
}

/* ===== ANDROID FIX: attesa voci ===== */
function waitVoicesReady(timeoutMs = 1500){
  return new Promise((resolve)=>{
    if(!("speechSynthesis" in window)) return resolve(false);

    const hasVoices = ()=>{
      try{ return speechSynthesis.getVoices().length > 0; }
      catch(e){ return false; }
    };

    if(hasVoices()) return resolve(true);

    let done = false;
    const finish = (ok)=>{
      if(done) return;
      done = true;
      try{ speechSynthesis.onvoiceschanged = null; }catch(e){}
      resolve(ok);
    };

    const t = setTimeout(()=>finish(hasVoices()), timeoutMs);

    try{
      speechSynthesis.onvoiceschanged = ()=>{
        clearTimeout(t);
        finish(hasVoices());
      };
      speechSynthesis.getVoices(); // trigger
    }catch(e){
      clearTimeout(t);
      finish(false);
    }
  });
}

async function speakTextReliable(text, opts={}){
  await waitVoicesReady(1500);
  await new Promise(r=>setTimeout(r, 120));
  return speakText(text, opts);
}

/* ===================== AUTO-VOICE (FIRST TIME ONLY + GLOBAL TOGGLE) ===================== */
const AUTO_VOICE_GLOBAL_KEY = "sercuctech_autovoice_global"; // "1"=ON, "0"=OFF

function isAutoVoiceEnabled(){
  const v = localStorage.getItem(AUTO_VOICE_GLOBAL_KEY);
  return (v === null) ? true : (v === "1");
}
function setAutoVoiceEnabled(on){
  localStorage.setItem(AUTO_VOICE_GLOBAL_KEY, on ? "1" : "0");
}

function autoVoiceKeyForVetrina(vetrinaId){
  return `sercuctech_autovoice_done_${sanitizeId(vetrinaId)}`;
}
function hasAutoVoiceDone(vetrinaId){
  return localStorage.getItem(autoVoiceKeyForVetrina(vetrinaId)) === "1";
}
function setAutoVoiceDone(vetrinaId){
  localStorage.setItem(autoVoiceKeyForVetrina(vetrinaId), "1");
}

function showAutoVoiceOverlay({lang, text, vetrinaId}){
  if(document.getElementById("autoSpeakOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "autoSpeakOverlay";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.background = "rgba(0,0,0,.55)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "99999";
  overlay.style.padding = "18px";

  overlay.innerHTML = `
    <div style="max-width:520px;width:100%;background:rgba(17,27,46,.95);
      border:1px solid #22345f;border-radius:16px;padding:16px;">
      <div style="font-weight:900;margin-bottom:6px;">Avvio audio</div>
      <div style="opacity:.85;font-size:13px;margin-bottom:12px;">
        Tocca per avviare la voce (il browser ha bloccato l’autoplay).
      </div>
      <div style="display:flex;gap:10px;">
        <button id="autoSpeakBtn"
          style="border:0;padding:10px 14px;border-radius:12px;
          font-weight:900;background:#5ee1a2;color:#052014;cursor:pointer;">
          🔊 Avvia audio
        </button>
        <button id="autoSpeakClose"
          style="border:0;padding:10px 14px;border-radius:12px;
          font-weight:900;background:#22345f;color:#e8eefc;cursor:pointer;">
          Chiudi
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("autoSpeakBtn").onclick = async ()=>{
    const ok = await speakTextReliable(text, { lang });
    if(ok){
      setAutoVoiceDone(vetrinaId);
    }
    overlay.remove();
  };

  document.getElementById("autoSpeakClose").onclick = ()=>{
    overlay.remove();
  };
}

async function autoSpeakFirstTime(v){
  // toggle globale
  if(!isAutoVoiceEnabled()) return;

  const vid = sanitizeId(v?.id);
  if(!vid) return;

  // solo prima volta
  if(hasAutoVoiceDone(vid)) return;

  const lang = (v.voice && v.voice.lang) ? v.voice.lang : "it-IT";
  const text =
    (v.voice && v.voice.text && v.voice.text.trim())
      ? v.voice.text.trim()
      : (v.title || v.id || "");

  if(!text) return;

  console.log("[AUTO-VOICE] enabled?", isAutoVoiceEnabled());
  console.log("[AUTO-VOICE] id:", vid, "done?", hasAutoVoiceDone(vid));
  console.log("[AUTO-VOICE] text:", text);

  // tentativo autoplay affidabile
  const ok = await speakTextReliable(text, { lang });

  if(ok){
    // aspetta se sta parlando davvero
    const started = await new Promise(res=>{
      const start = Date.now();
      const chk = ()=>{
        let speaking = false;
        try{ speaking = speechSynthesis.speaking; }catch(e){}
        if(speaking) return res(true);
        if(Date.now() - start > 1200) return res(false);
        setTimeout(chk, 100);
      };
      chk();
    });

    if(started){
      setAutoVoiceDone(vid);
      return;
    }
  }

  // autoplay bloccato → overlay 1 tap
  showAutoVoiceOverlay({ lang, text, vetrinaId: vid });
}

/* ===================== ADMIN UNLOCK (24h + device) ===================== */
const ADMIN_DEVICE_ID_KEY = "sercuctech_device_id";
const ADMIN_SESSION_KEY   = "sercuctech_admin_session_v1";
const ADMIN_DEVICES_KEY   = "sercuctech_admin_devices_v1";
const ADMIN_SESSION_HOURS = 24;

// parole segrete (case-insensitive) presenti nella frase
const UNLOCK_WORDS = ["sercuctech", "qualsiasi"];

function getOrCreateDeviceId(){
  let id = localStorage.getItem(ADMIN_DEVICE_ID_KEY);
  if(!id){
    id = "dev_" + crypto.getRandomValues(new Uint32Array(4)).join("-");
    localStorage.setItem(ADMIN_DEVICE_ID_KEY, id);
  }
  return id;
}
function loadAllowedDevices(){
  try{
    const raw = localStorage.getItem(ADMIN_DEVICES_KEY);
    if(!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  }catch(e){ return []; }
}
function saveAllowedDevices(arr){
  localStorage.setItem(ADMIN_DEVICES_KEY, JSON.stringify(arr));
}
function addAllowedDevice(deviceId){
  if(!deviceId) return false;
  const arr = loadAllowedDevices();
  if(!arr.includes(deviceId)){
    arr.push(deviceId);
    saveAllowedDevices(arr);
  }
  return true;
}
function isThisDeviceAllowed(){
  const myId = getOrCreateDeviceId();
  const arr = loadAllowedDevices();
  return arr.includes(myId);
}
function setAdminSession24h(){
  const deviceId = getOrCreateDeviceId();
  const exp = Date.now() + ADMIN_SESSION_HOURS * 60 * 60 * 1000;
  const session = { deviceId, exp };
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}
function clearAdminSession(){
  localStorage.removeItem(ADMIN_SESSION_KEY);
}
function isAdminSessionValid(){
  try{
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if(!raw) return false;
    const s = JSON.parse(raw);
    if(!s || !s.deviceId || !s.exp) return false;
    if(Date.now() > Number(s.exp)) return false;
    if(s.deviceId !== getOrCreateDeviceId()) return false;
    if(!isThisDeviceAllowed()) return false;
    return true;
  }catch(e){
    return false;
  }
}
function matchesUnlockWords(text){
  const t = String(text||"").toLowerCase();
  return UNLOCK_WORDS.every(w => t.includes(w));
}
function adminUnlockSuccess(){
  addAllowedDevice(getOrCreateDeviceId());
  setAdminSession24h();
}

// codice device da condividere (copi/incolli)
function getMyDeviceShareCode(){
  const payload = { v:1, deviceId: getOrCreateDeviceId(), createdAt: new Date().toISOString() };
  const json = JSON.stringify(payload);
  return btoa(unescape(encodeURIComponent(json))).replaceAll("+","-").replaceAll("/","_");
}
function parseDeviceShareCode(code){
  try{
    const clean = String(code||"").trim().replaceAll("-","+").replaceAll("_","/");
    const json = decodeURIComponent(escape(atob(clean)));
    const obj = JSON.parse(json);
    if(!obj || obj.v !== 1 || !obj.deviceId) return null;
    return obj;
  }catch(e){ return null; }
}

/* ===================== INDEXEDDB CACHE ===================== */
const DB_NAME = "sercuctech_vetrine_db";
const DB_VER  = 2;
const STORE_V = "vetrine";
const STORE_M = "meta";

function idbOpen(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = ()=>{
      const db = req.result;
      if(!db.objectStoreNames.contains(STORE_V)){
        db.createObjectStore(STORE_V, { keyPath: "id" });
      }
      if(!db.objectStoreNames.contains(STORE_M)){
        db.createObjectStore(STORE_M, { keyPath: "key" });
      }
    };
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
}
async function idbPut(store, obj){
  const db = await idbOpen();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(obj);
    tx.oncomplete = ()=>resolve(true);
    tx.onerror = ()=>reject(tx.error);
  });
}
async function idbGet(store, key){
  const db = await idbOpen();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = ()=>resolve(req.result || null);
    req.onerror = ()=>reject(req.error);
  });
}
async function idbGetAllKeys(store){
  const db = await idbOpen();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAllKeys();
    req.onsuccess = ()=>resolve(req.result || []);
    req.onerror = ()=>reject(req.error);
  });
}
async function idbDelete(store, key){
  const db = await idbOpen();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = ()=>resolve(true);
    tx.onerror = ()=>reject(tx.error);
  });
}

/* ===================== DATA LOADER ===================== */
function normalizeIndex(idx){
  const out = (idx && typeof idx==="object") ? idx : {};
  out.meta = out.meta || { version:1, updatedAt:null };
  out.groups = out.groups || {};
  out.vetrine = out.vetrine || {};
  return out;
}
async function loadIndexOnline(){
  const idx = normalizeIndex(await fetchJson(INDEX_PATH));
  await idbPut(STORE_M, { key:"index", value: idx, savedAt: nowISO() });
  return idx;
}
async function loadIndexCached(){
  const row = await idbGet(STORE_M, "index");
  return row && row.value ? normalizeIndex(row.value) : null;
}
async function loadIndexSmart(){
  try{
    return await loadIndexOnline();
  }catch(e){
    const cached = await loadIndexCached();
    if(cached) return cached;
    throw e;
  }
}

/* ===================== VETRINA LOADER ===================== */
function normalizeVetrina(v, id){
  const o = (v && typeof v==="object") ? v : {};
  o.id = o.id || id;
  o.title = o.title || "";
  o.description = o.description || "";
  o.voice = o.voice || { lang: "it-IT", text: "" };
  o.tags = Array.isArray(o.tags) ? o.tags : [];
  o.media = Array.isArray(o.media) ? o.media : [];
  o.files = Array.isArray(o.files) ? o.files : [];
  o.createdAt = o.createdAt || nowISO();
  o.updatedAt = o.updatedAt || nowISO();
  return o;
}
async function cacheVetrina(v){
  await idbPut(STORE_V, { ...v, _cachedAt: nowISO() });
}
async function getCachedVetrina(id){
  const v = await idbGet(STORE_V, id);
  return v ? normalizeVetrina(v, id) : null;
}
async function loadVetrinaById(id){
  const vid = sanitizeId(id);
  if(!vid) throw new Error("ID vetrina non valido");
  try{
    const idx = await loadIndexSmart();
    const rec = idx.vetrine[vid];
    if(!rec || !rec.file) throw new Error(`ID '${vid}' non presente in data/index.json`);
    const v = normalizeVetrina(await fetchJson(rec.file), vid);
    await cacheVetrina(v);
    return { vetrina: v, source:"online" };
  }catch(e){
    const cached = await getCachedVetrina(vid);
    if(cached) return { vetrina: cached, source:"cache" };
    throw e;
  }
}

/* ===================== RENDER HELPERS ===================== */
function el(id){ return document.getElementById(id); }

function renderIndexList(targetId, idx){
  const box = el(targetId);
  if(!box) return;

  const vetrine = idx.vetrine || {};
  const ids = Object.keys(vetrine).sort();

  if(ids.length === 0){
    box.innerHTML = `<div class="mut">Nessuna vetrina trovata in <b>data/index.json</b></div>`;
    return;
  }

  box.innerHTML = ids.map(id=>{
    const r = vetrine[id] || {};
    const title = escapeHtml(r.title || id);
    const tags = Array.isArray(r.tags) ? r.tags.join(", ") : "";
    const url = `vetrina.html?id=${encodeURIComponent(id)}`;
    return `
      <div class="item">
        <div>
          <div><b>${title}</b></div>
          <div class="mut">${escapeHtml(id)} ${tags ? "• " + escapeHtml(tags) : ""}</div>
        </div>
        <div class="btns">
          <a class="btn" href="${url}">Apri</a>
        </div>
      </div>
    `;
  }).join("");
}

function renderGroupList(targetId, idx, groupKey){
  const box = el(targetId);
  if(!box) return;

  const g = (idx.groups || {})[groupKey];
  if(!g){
    box.innerHTML = `<div class="mut">Gruppo <b>${escapeHtml(groupKey)}</b> non trovato.</div>`;
    return;
  }
  const items = Array.isArray(g.items) ? g.items : [];
  if(items.length === 0){
    box.innerHTML = `<div class="mut">Gruppo vuoto.</div>`;
    return;
  }

  box.innerHTML = items.map(id=>{
    const r = (idx.vetrine||{})[id] || {};
    const title = escapeHtml(r.title || id);
    const url = `vetrina.html?id=${encodeURIComponent(id)}`;
    return `
      <div class="item">
        <div><b>${title}</b><div class="mut">${escapeHtml(id)}</div></div>
        <div class="btns"><a class="btn" href="${url}">Apri</a></div>
      </div>
    `;
  }).join("");
}

function renderVetrina(v, opts={}){
  if(el("title")) el("title").textContent = v.title || v.id;
  if(el("desc"))  el("desc").textContent  = v.description || "";
  if(el("hint")){
    el("hint").textContent = opts.source === "cache" ? "📦 Offline: dati da cache" : "";
  }

  const mBox = el("media");
  if(mBox){
    const media = v.media || [];
    if(media.length === 0){
      mBox.innerHTML = `<div class="mut">Nessun media.</div>`;
    }else{
      mBox.innerHTML = media.map(m=>{
        const url = escapeHtml(m.url || "");
        const title = escapeHtml(m.title || "");
        const note = escapeHtml(m.note || "");
        if(m.type === "video"){
          return `
            <div class="item">
              <div><b>${title || "Video"}</b>${note ? `<div class="mut">${note}</div>` : ""}</div>
              <video controls style="width:100%;border-radius:14px;border:1px solid #22345f;margin-top:8px;" src="${url}"></video>
            </div>
          `;
        }
        return `
          <div class="item">
            <div><b>${title || "Immagine"}</b>${note ? `<div class="mut">${note}</div>` : ""}</div>
            <img alt="" style="width:100%;border-radius:14px;border:1px solid #22345f;margin-top:8px;" src="${url}">
          </div>
        `;
      }).join("");
    }
  }

  const fBox = el("files");
  if(fBox){
    const files = v.files || [];
    if(files.length === 0){
      fBox.innerHTML = `<div class="mut">Nessun file.</div>`;
    }else{
      fBox.innerHTML = files.map(f=>{
        const label = escapeHtml(f.label || "File");
        const url = escapeHtml(f.url || "#");
        const isP = isPdf(f.url);
        return `
          <div class="item">
            <div>
              <b>${label}</b>
              <div class="mut">${escapeHtml(f.url || "")}</div>
            </div>
            <div class="btns">
              <a class="btn" href="${url}" target="_blank" rel="noopener">Apri</a>
              ${isP ? `<a class="btn" href="${url}" target="_blank" rel="noopener">PDF</a>` : ""}
            </div>
          </div>
        `;
      }).join("");
    }
  }

  const speakBtn = el("speakBtn");
  if(speakBtn){
    speakBtn.onclick = ()=>{
      const lang = (v.voice && v.voice.lang) ? v.voice.lang : "it-IT";
      const text = (v.voice && v.voice.text) ? v.voice.text : (v.title || v.id);
      speakTextReliable(text, { lang });
    };
  }
  const stopBtn = el("stopBtn");
  if(stopBtn){
    stopBtn.onclick = ()=> stopSpeak();
  }
}

/* ===================== BOOT ===================== */
async function boot(){
  initPin();

  const listEl = el("list");
  const id = qs("id");
  const group = qs("group");

  // Pagina vetrina singola
  if(id){
    try{
      const { vetrina, source } = await loadVetrinaById(id);
      renderVetrina(vetrina, { source });

      // AUTO VOCE: SOLO PRIMA VOLTA + toggle globale
      autoSpeakFirstTime(vetrina);

      return;
    }catch(e){
      console.error(e);
      if(el("hint")) el("hint").textContent = "❌ Errore: " + (e.message || e);
      if(el("desc")) el("desc").textContent = "Controlla data/index.json e il file data/<id>.json";
      return;
    }
  }

  // Lista gruppo
  if(group && listEl){
    try{
      const idx = await loadIndexSmart();
      renderGroupList("list", idx, sanitizeId(group));
      return;
    }catch(e){
      console.error(e);
      listEl.innerHTML = `<div class="mut">❌ Errore caricamento index: ${escapeHtml(e.message||String(e))}</div>`;
      return;
    }
  }

  // Lista index
  if(listEl){
    try{
      const idx = await loadIndexSmart();
      renderIndexList("list", idx);
      return;
    }catch(e){
      console.error(e);
      listEl.innerHTML = `
        <div class="item">
          <div>
            <b>Errore caricamento</b>
            <div class="mut">
              Non riesco a leggere <span class="mono">data/index.json</span>.<br>
              Controlla che esista: <span class="mono">/data/index.json</span>
            </div>
          </div>
        </div>`;
      return;
    }
  }
}
document.addEventListener("DOMContentLoaded", boot);

/* ===================== EXPORT ===================== */
window.SerCucTech = {
  // loader
  loadIndexSmart,
  loadVetrinaById,

  // cache ops
  cacheVetrina,
  getCachedVetrina,
  idbDeleteVetrina: (id)=>idbDelete(STORE_V, sanitizeId(id)),
  idbListCachedIds: ()=>idbGetAllKeys(STORE_V),

  // utils
  speakText,
  speakTextReliable,
  stopSpeak,
  sanitizeId,
  splitCSV,
  nowISO,

  // admin unlock
  UNLOCK_WORDS,
  matchesUnlockWords,
  adminUnlockSuccess,
  isAdminSessionValid,
  clearAdminSession,
  getOrCreateDeviceId,
  getMyDeviceShareCode,
  parseDeviceShareCode,
  addAllowedDevice,
  loadAllowedDevices,

  // auto voice helpers
  hasAutoVoiceDone,
  setAutoVoiceDone,
  isAutoVoiceEnabled,
  setAutoVoiceEnabled
};
