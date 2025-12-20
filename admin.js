/* =========================================================
   SerCucTech – admin.js
   - Unlock con frase (parole: SerCucTech + qualsiasi)
   - Sessione 24h legata al dispositivo
   - Multi-device (max 3) + aggiunta via codice dispositivo
   - Recovery code (se si rompe il telefono)
   - Export Backup completo (index + tutte le vetrine)
   - Link pubblico evidenziato + WhatsApp
   - Link tool rinomina: rename.html?id=...
========================================================= */

(function(){
  const $ = (id)=>document.getElementById(id);

  /* ===================== CONFIG ===================== */
  // Parole richieste nella frase (case-insensitive):
  const UNLOCK_WORDS = ["sercuctech", "qualsiasi"];

  // 👉 CAMBIA QUI IL TUO RECOVERY CODE (conservalo fuori dal telefono)
  const MASTER_RECOVERY_CODE = "SERCUCTECH-RECOVER-8F29-77A1";

  // Repo (solo per aprire link di edit su GitHub)
  const GITHUB_OWNER  = "creamiaappsercuctech";
  const GITHUB_REPO   = "SerCucTech";
  const GITHUB_BRANCH = "main";

  /* ===================== STORAGE KEYS ===================== */
  const DEVICE_ID_KEY        = "sercuctech_device_id";
  const DEVICES_KEY          = "sercuctech_admin_devices";
  const ADMIN_SESSION_KEY    = "sercuctech_admin_session";
  const ADMIN_SESSION_HOURS  = 24;
  const MAX_DEVICES          = 3;

  /* ===================== UTILS ===================== */
  function safeText(s){ return String(s || "").trim(); }
  function lower(s){ return safeText(s).toLowerCase(); }
  function escapeHtml(s){
    return String(s||"")
      .replaceAll("&","&amp;").replaceAll("<","&lt;")
      .replaceAll(">","&gt;").replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }
  function nowISO(){ return new Date().toISOString(); }

  function getBaseUrl(){
    // es: https://creamiaappsercuctech.github.io/SerCucTech/
    return location.origin + location.pathname.replace(/\/[^\/]*$/, "/");
  }
  function publicVetrinaLink(id){
    return getBaseUrl() + "vetrina.html?id=" + encodeURIComponent(id);
  }
  function renameToolLink(id){
    return getBaseUrl() + "rename.html?id=" + encodeURIComponent(id);
  }

  async function copyToClipboard(text){
    try{
      await navigator.clipboard.writeText(text);
      return true;
    }catch(e){
      try{
        const tmp = document.createElement("textarea");
        tmp.value = text;
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand("copy");
        tmp.remove();
        return true;
      }catch(err){
        return false;
      }
    }
  }

  /* ===================== DEVICE ID ===================== */
  function getOrCreateDeviceId(){
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if(!id){
      // crypto.randomUUID supportato quasi ovunque; fallback se manca
      id = (crypto && crypto.randomUUID) ? ("dev_" + crypto.randomUUID()) : ("dev_" + Math.random().toString(16).slice(2) + "-" + Date.now());
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }

  /* ===================== DEVICE MANAGER ===================== */
  function getAllowedDevices(){
    try{
      return JSON.parse(localStorage.getItem(DEVICES_KEY)) || [];
    }catch(e){
      return [];
    }
  }

  function saveAllowedDevices(list){
    localStorage.setItem(DEVICES_KEY, JSON.stringify(list));
  }

  function addAllowedDevice(deviceId){
    let devices = getAllowedDevices();

    if(devices.includes(deviceId)) return true;

    if(devices.length >= MAX_DEVICES){
      alert("Limite dispositivi raggiunto (max " + MAX_DEVICES + "). Rimuovine uno prima.");
      return false;
    }

    devices.push(deviceId);
    saveAllowedDevices(devices);
    return true;
  }

  function removeAllowedDevice(deviceId){
    let devices = getAllowedDevices().filter(d => d !== deviceId);
    saveAllowedDevices(devices);
  }

  function isThisDeviceAllowed(){
    const id = getOrCreateDeviceId();
    return getAllowedDevices().includes(id);
  }

  /* ===================== DEVICE SHARE CODE ===================== */
  function getMyDeviceShareCode(){
    const payload = { v:1, deviceId: getOrCreateDeviceId(), createdAt: nowISO() };
    const json = JSON.stringify(payload);
    // base64 URL-safe
    return btoa(unescape(encodeURIComponent(json))).replaceAll("+","-").replaceAll("/","_");
  }

  function parseDeviceShareCode(code){
    try{
      const clean = String(code||"").trim().replaceAll("-","+").replaceAll("_","/");
      const json = decodeURIComponent(escape(atob(clean)));
      const obj = JSON.parse(json);
      if(!obj || obj.v !== 1 || !obj.deviceId) return null;
      return obj;
    }catch(e){
      return null;
    }
  }

  /* ===================== ADMIN SESSION 24H ===================== */
  function setAdminSession24h(){
    const exp = Date.now() + ADMIN_SESSION_HOURS * 60 * 60 * 1000;
    const session = { deviceId: getOrCreateDeviceId(), exp };
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

  /* ===================== UNLOCK RULES ===================== */
  function matchesUnlockWords(text){
    const t = lower(text);
    return UNLOCK_WORDS.every(w => t.includes(w));
  }

  function isValidRecovery(code){
    return safeText(code).toUpperCase() === String(MASTER_RECOVERY_CODE).toUpperCase();
  }

  function doUnlockSuccess(){
    addAllowedDevice(getOrCreateDeviceId());
    setAdminSession24h();
    renderLocked(false);
  }

  /* ===================== LOAD INDEX / VETRINE (from app.js) ===================== */
  function getApi(){
    // app.js espone window.SerCucTech
    return window.SerCucTech || null;
  }

  /* ===================== LOAD INDEX (fallback) ===================== */
async function loadIndexSmart(){
  // 1) prova API da app.js (se esiste)
  try{
    const api = getApi();
    if(api && typeof api.loadIndexSmart === "function"){
      return await api.loadIndexSmart();
    }
  }catch(e){}

  // 2) fallback: prova data/index.json
  try{
    const r = await fetch("data/index.json?t=" + Date.now(), { cache:"no-store" });
    if(r.ok){
      const j = await r.json();
      // deve contenere j.vetrine
      if(j && typeof j === "object" && j.vetrine) return j;
    }
  }catch(e){}

  // 3) fallback: prova data/vetrine.json (il tuo link)
  try{
    const r = await fetch("data/vetrine.json?t=" + Date.now(), { cache:"no-store" });
    if(!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();

    // accetta 2 formati:
    // A) { "vetrine": { "renzo11": {...}, ... } }
    if(j && j.vetrine) return j;

    // B) [ {id:"renzo11", ...}, {id:"scalvini10", ...} ]
    if(Array.isArray(j)){
      const vetrine = {};
      for(const it of j){
        if(it && it.id){
          vetrine[it.id] = {
            title: it.title || it.name || it.id,
            file: it.file || ("data/" + it.id + ".json")
          };
        }
      }
      return { vetrine };
    }

    // C) { "renzo11": {...}, "scalvini10": {...} }
    if(j && typeof j === "object"){
      const vetrine = {};
      for(const [id,val] of Object.entries(j)){
        if(!id) continue;
        vetrine[id] = {
          title: val?.title || val?.name || id,
          file: val?.file || ("data/" + id + ".json")
        };
      }
      return { vetrine };
    }

    throw new Error("Formato vetrine.json non riconosciuto");
  }catch(e){
    console.error(e);
    return { vetrine: {} };
  }
}

  async function loadVetrinaById(id){
    const api = getApi();
    if(!api || !api.loadVetrinaById) throw new Error("app.js non caricato.");
    return await api.loadVetrinaById(id);
  }

  /* ===================== BACKUP EXPORT ===================== */
  async function exportFullBackup(){
    const out = {
      app: "SerCucTech",
      createdAt: nowISO(),
      indexPath: "data/index.json",
      vetrine: [],
      publicLinks: []
    };

    const idx = await loadIndexSmart();
    const vmap = idx.vetrine || {};
    const ids = Object.keys(vmap).sort();

    for(const id of ids){
      const rec = vmap[id];
      if(!rec || !rec.file) continue;
      try{
        const v = await fetch(rec.file + "?t=" + Date.now(), { cache:"no-store" }).then(r=>{
          if(!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        });
        out.vetrine.push(v);
        out.publicLinks.push(publicVetrinaLink(id));
      }catch(e){
        // se manca un file, continuiamo
        out.vetrine.push({ id, error: String(e?.message || e), file: rec.file });
      }
    }

    const blob = new Blob([JSON.stringify(out, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sercuctech-backup-${Date.now()}.json`;
    a.click();
  }

  /* ===================== UI RENDER ===================== */
  function renderLocked(isLocked){
    const lockBox = $("lockBox");
    const adminBox = $("adminBox");
    if(lockBox) lockBox.style.display = isLocked ? "block" : "none";
    if(adminBox) adminBox.style.display = isLocked ? "none" : "block";
  }

  function renderDeviceInfo(){
    const myId = getOrCreateDeviceId();
    $("myDeviceId").textContent = myId;
    $("myDeviceCode").value = getMyDeviceShareCode();

    const list = getAllowedDevices();
    const ul = $("deviceList");
    ul.innerHTML = "";

    if(list.length === 0){
      ul.innerHTML = `<li class="mut">Nessun dispositivo autorizzato.</li>`;
      return;
    }

    list.forEach(d=>{
      const li = document.createElement("li");
      li.innerHTML = `
        <div style="display:flex;gap:10px;justify-content:space-between;align-items:center">
          <div class="mono">${escapeHtml(d)}</div>
          <button class="btn danger small" data-rm="${escapeHtml(d)}">Rimuovi</button>
        </div>
      `;
      ul.appendChild(li);
    });

    ul.querySelectorAll("button[data-rm]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.getAttribute("data-rm");
        if(!id) return;
        if(id === getOrCreateDeviceId()){
          if(!confirm("Stai rimuovendo QUESTO dispositivo. Vuoi continuare?")) return;
          removeAllowedDevice(id);
          clearAdminSession();
          renderDeviceInfo();
          renderLocked(true);
          return;
        }
        removeAllowedDevice(id);
        renderDeviceInfo();
      });
    });
  }

  function renderVetrineSelect(idx){
    const sel = $("vetrinaSelect");
    sel.innerHTML = "";
    const vmap = idx.vetrine || {};
    const ids = Object.keys(vmap).sort();

    if(ids.length === 0){
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Nessuna vetrina";
      sel.appendChild(opt);
      return;
    }

    ids.forEach(id=>{
      const r = vmap[id] || {};
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = `${r.title ? r.title + " — " : ""}${id}`;
      sel.appendChild(opt);
    });

    // seleziona da query ?id=
    const qid = new URLSearchParams(location.search).get("id");
    if(qid && ids.includes(qid)) sel.value = qid;
    updateSelectedVetrinaUI();
  }

  function updateSelectedVetrinaUI(){
    const id = $("vetrinaSelect").value;
    $("selectedId").textContent = id || "—";

    const link = id ? publicVetrinaLink(id) : "";
    $("publicLink").value = link;
    $("openPublicBtn").disabled = !id;
    $("copyPublicBtn").disabled = !id;
    $("waBtn").disabled = !id;
    $("openRenameBtn").disabled = !id;

    if(id){
      $("openPublicBtn").onclick = ()=> window.open(link, "_blank", "noopener");
      $("copyPublicBtn").onclick = async ()=>{
        const ok = await copyToClipboard(link);
        alert(ok ? "Link copiato ✅" : "Copia manualmente il link.");
      };
      $("waBtn").onclick = ()=>{
        const msg = `Vetrina pubblica: ${id}\n${link}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
      };
      $("openRenameBtn").onclick = ()=> window.open(renameToolLink(id), "_blank", "noopener");
      $("openGithubJsonBtn").onclick = ()=> openGithubEditJson(id);
    }
  }

  function openGithubEditJson(id){
    const path = `data/${id}.json`;
    const url = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/edit/${GITHUB_BRANCH}/${path}`;
    window.open(url, "_blank", "noopener");
  }

  /* ===================== EVENTS ===================== */
  function bindEvents(){
    // unlock
    $("unlockBtn").addEventListener("click", ()=>{
      const phrase = safeText($("unlockPhrase").value);
      const rec = safeText($("recoveryCode").value);

      // recovery vince sempre
      if(rec){
        if(!isValidRecovery(rec)){
          alert("Recovery code NON valido.");
          return;
        }
        doUnlockSuccess();
        alert("Recovery OK ✅ Dispositivo autorizzato per 24 ore.");
        return;
      }

      if(!matchesUnlockWords(phrase)){
        alert("Frase non valida. Deve contenere le parole: SerCucTech + qualsiasi");
        return;
      }

      doUnlockSuccess();
      alert("Accesso admin OK ✅ (24 ore su questo dispositivo)");
    });

    $("logoutBtn").addEventListener("click", ()=>{
      clearAdminSession();
      renderLocked(true);
    });

    // devices
    $("copyDeviceIdBtn").addEventListener("click", async ()=>{
      const ok = await copyToClipboard(getOrCreateDeviceId());
      alert(ok ? "Device ID copiato ✅" : "Copia manualmente.");
    });

    $("copyDeviceCodeBtn").addEventListener("click", async ()=>{
      const ok = await copyToClipboard(getMyDeviceShareCode());
      alert(ok ? "Codice dispositivo copiato ✅" : "Copia manualmente.");
    });

    $("addDeviceBtn").addEventListener("click", ()=>{
      const code = safeText($("addDeviceInput").value);
      if(!code){ alert("Incolla il codice dispositivo."); return; }
      const obj = parseDeviceShareCode(code);
      if(!obj){ alert("Codice non valido."); return; }
      const ok = addAllowedDevice(obj.deviceId);
      if(ok){
        $("addDeviceInput").value = "";
        renderDeviceInfo();
        alert("Dispositivo aggiunto ✅");
      }
    });

    // export backup
    $("exportBackupBtn").addEventListener("click", async ()=>{
      try{
        await exportFullBackup();
      }catch(e){
        console.error(e);
        alert("Errore export backup: " + (e?.message || e));
      }
    });

    // vetrine select
    $("vetrinaSelect").addEventListener("change", updateSelectedVetrinaUI);
  }

  /* ===================== BOOT ===================== */
  async function bootAdmin(){
    // se sessione valida → sblocca
    renderLocked(!isAdminSessionValid());

    // se è sbloccato ma questo device non è in lista, proviamo a rimetterlo (caso raro)
    if(isAdminSessionValid()){
      addAllowedDevice(getOrCreateDeviceId());
    }

    bindEvents();
    renderDeviceInfo();

    // carica index e popola select
    try{
      const idx = await loadIndexSmart();
      renderVetrineSelect(idx);
    }catch(e){
      console.error(e);
      $("vetrinaSelect").innerHTML = `<option value="">Errore index.json</option>`;
      alert("Errore caricamento data/index.json: " + (e?.message || e));
    }
  }

  document.addEventListener("DOMContentLoaded", bootAdmin);
})();
