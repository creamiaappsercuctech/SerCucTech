/* =========================================================
   SerCucTech Vetrina - app.js
   - Carica data/<id>.json
   - Galleria immagini + thumbs
   - Voice panel (tap per audio)
   - WhatsApp per foto corrente (messaggio con numero foto)
   - Editor numerini su foto: canvas + export PNG
   - Salvataggio su GitHub (OPZIONALE) via API con token
   ========================================================= */

const qs = new URLSearchParams(location.search);
const vId = (qs.get("id") || "").trim();

const $ = (s) => document.querySelector(s);

const pageTitle = $("#pageTitle");
const pageDesc  = $("#pageDesc");
const badgeId   = $("#badgeId");

const voicePanel = $("#voicePanel");
const voicePanelInner = $("#voicePanelInner");
const voiceTextEl = $("#voiceText");
const contactsRow = $("#contactsRow");

const indexPanel = $("#indexPanel");
const indexList  = $("#indexList");
const indexReloadBtn = $("#indexReloadBtn");

const heroImg = $("#heroImg");
const imgCounter = $("#imgCounter");
const imgBadge = $("#imgBadge");
const prevBtn = $("#prevBtn");
const nextBtn = $("#nextBtn");
const thumbRow = $("#thumbRow");
const pinsLayer = $("#pinsLayer");

const shareBtn = $("#shareBtn");
const waOnPhotoBtn = $("#waOnPhotoBtn");
const editPhotoBtn = $("#editPhotoBtn");
const openImgBtn = $("#openImgBtn");

const homeBtn = $("#homeBtn");
const voiceBtn = $("#voiceBtn");
const stopBtn = $("#stopBtn");
const fullBtn = $("#fullBtn");
const themeBtn = $("#themeBtn");
const kioskBtn = $("#kioskBtn");

const audioGate = $("#audioGate");
const enableAudioBtn = $("#enableAudioBtn");
const skipAudioBtn = $("#skipAudioBtn");

/* Editor */
const editModal = $("#editModal");
const editCanvas = $("#editCanvas");
const undoPinBtn = $("#undoPinBtn");
const clearPinsBtn = $("#clearPinsBtn");
const pinSizeRange = $("#pinSize");
const pinSizeVal = $("#pinSizeVal");
const downloadPngBtn = $("#downloadPngBtn");
const saveGithubBtn = $("#saveGithubBtn");
const closeEditBtn = $("#closeEditBtn");
const saveResult = $("#saveResult");

let data = null;
let media = [];
let currentIndex = 0;
let theme = localStorage.getItem("sercuctech_theme") || "dark";
let kiosk = localStorage.getItem("sercuctech_kiosk") === "1";

/* ===== Speech (Android gate) ===== */
let canSpeak = ("speechSynthesis" in window) && ("SpeechSynthesisUtterance" in window);
let audioUnlocked = localStorage.getItem("sercuctech_audio_unlocked") === "1";
let lastSpokenText = "";

/* ===== Pins data per foto (local) =====
   - Non modifica l'immagine originale
   - Per esportare PNG: disegniamo su canvas
*/
function pinKeyFor(url){ return `pins:${vId}:${url}`; }
function getPins(url){
  try{ return JSON.parse(localStorage.getItem(pinKeyFor(url))) || []; }catch{ return []; }
}
function setPins(url, arr){
  localStorage.setItem(pinKeyFor(url), JSON.stringify(arr || []));
}

/* ===== Helpers ===== */
function pad2(n){ return String(n).padStart(2,"0"); }
function baseUrl(){
  return location.origin + location.pathname.replace(/\/[^\/]*$/, "/");
}
function vetrinaLink(id){
  return baseUrl() + `vetrina.html?id=${encodeURIComponent(id)}`;
}
function speak(text, lang){
  if(!text) return;
  lastSpokenText = text;

  // se audio non sbloccato, mostra gate
  if(!audioUnlocked){
    audioGate.hidden = false;
    return;
  }

  if(!canSpeak) return;

  try{
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(formatPhonesForSpeech(text));
    u.lang = lang || (navigator.language || "it-IT");
    u.rate = 1;
    speechSynthesis.speak(u);
  }catch(e){}
}

function stopSpeak(){
  try{ speechSynthesis.cancel(); }catch(e){}
}

/* Migliora pronuncia telefono: spazia cifre */
function formatPhonesForSpeech(text){
  return String(text).replace(/(\+?\d[\d\s]{8,}\d)/g, (m) => {
    const n = String(m).trim().replace(/[^\d+]/g,"");
    if(n.length < 9) return m;
    const digits = n.replace("+","").split("").join(" ");
    return n.startsWith("+") ? "+ " + digits : digits;
  });
}

function parsePhonesFromText(text){
  // trova numeri tipo +39... o 333...
  const matches = String(text||"").match(/(\+?\d[\d\s]{8,}\d)/g) || [];
  return matches.map(m => m.trim().replace(/[^\d+]/g,""));
}

function waLink(phone, message){
  const p = String(phone||"").replace(/[^\d]/g,"");
  const txt = encodeURIComponent(message || "");
  return `https://wa.me/${p}?text=${txt}`;
}

function telLink(phone){
  const p = String(phone||"").replace(/[^\d+]/g,"");
  return `tel:${p}`;
}

function safeText(t){ return String(t||"").trim(); }

/* ===== Load data ===== */
async function loadVetrina(){
  if(!vId){
    pageTitle.textContent = "Manca id";
    pageDesc.textContent = "Apri con ?id=renzo11";
    return;
  }
  badgeId.textContent = "id: " + vId;

  try{
    const r = await fetch(`data/${encodeURIComponent(vId)}.json`, { cache:"no-store" });
    if(!r.ok) throw new Error("HTTP " + r.status);
    data = await r.json();
  }catch(e){
    pageTitle.textContent = "Errore caricamento";
    pageDesc.textContent = `Non trovo data/${vId}.json`;
    return;
  }

  pageTitle.textContent = data.title || vId;
  pageDesc.textContent  = data.description || "";

  // voice panel
  const vtext = safeText(data?.voice?.text);
  if(vtext){
    voicePanel.hidden = false;
    voiceTextEl.textContent = vtext;
    const lang = data?.voice?.lang || "it-IT";
    voicePanelInner.onclick = () => speak(vtext, lang);
  }else{
    voicePanel.hidden = true;
  }

  // contacts
  renderContacts();

  // media
  media = Array.isArray(data.media) ? data.media.filter(m => m && m.url) : [];
  if(!media.length){
    media = [];
    heroImg.alt = "Nessuna immagine";
    pageDesc.textContent = (pageDesc.textContent ? pageDesc.textContent + " " : "") + "(Nessuna immagine nel JSON)";
    return;
  }

  // inizializza index
  renderIndexLinks();
  indexReloadBtn.onclick = renderIndexLinks;

  // start
  currentIndex = 0;
  renderGallery();
  attachGalleryEvents();

  // share
  shareBtn.onclick = shareVetrina;
  homeBtn.onclick = () => location.href = baseUrl() + "link.html";
  voiceBtn.onclick = () => speak(vtext, data?.voice?.lang || "it-IT");
  stopBtn.onclick = () => stopSpeak();

  fullBtn.onclick = toggleFullscreenMode;
  themeBtn.onclick = toggleTheme;
  kioskBtn.onclick = toggleKiosk;

  applyTheme();
  applyKiosk();

  // auto audio (tenta)
  if(vtext){
    // prova subito: se bloccato, appare gate
    setTimeout(()=>speak(vtext, data?.voice?.lang || "it-IT"), 350);
  }
}

/* ===== Contacts UI ===== */
function renderContacts(){
  contactsRow.innerHTML = "";
  const contacts = Array.isArray(data?.contacts) ? data.contacts : [];

  if(!contacts.length){
    // fallback: cerca numeri nel voice text
    const nums = parsePhonesFromText(data?.voice?.text || "");
    if(nums.length){
      nums.forEach((p, i) => {
        const a = document.createElement("a");
        a.className = "contactChip";
        a.href = waLink(p, "Ciao! Ti contatto dalla vetrina " + (data?.title || vId));
        a.target = "_blank";
        a.rel = "noopener";
        a.innerHTML = `<b>WhatsApp</b> <span>${p}</span>`;
        contactsRow.appendChild(a);
      });
    }
    return;
  }

  contacts.forEach(c => {
    const name = c?.name || "Contatto";
    const phone = String(c?.phone || "").trim();
    if(!phone) return;

    const a = document.createElement("a");
    a.className = "contactChip";
    a.href = waLink(phone, `Ciao ${name}! Ti contatto dalla vetrina "${data?.title || vId}".`);
    a.target = "_blank";
    a.rel = "noopener";
    a.innerHTML = `<b>${name}</b> <span>${phone}</span>`;
    contactsRow.appendChild(a);

    // long-press? non gestiamo: ma aggiungiamo anche tel con click secondario non possibile qui.
  });
}

/* ===== Index links ===== */
async function renderIndexLinks(){
  try{
    const r = await fetch("data/vetrine.json", { cache:"no-store" });
    if(!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    const list = Array.isArray(j) ? j : (j.vetrine || []);
    indexList.innerHTML = "";

    list.forEach(v => {
      if(!v?.id) return;
      const a = document.createElement("a");
      a.className = "indexLink";
      a.href = `vetrina.html?id=${encodeURIComponent(v.id)}`;
      a.innerHTML = `<span class="dot"></span>${v.title || v.id}`;
      indexList.appendChild(a);
    });

    indexPanel.hidden = !(indexList.children.length > 0);
  }catch(e){
    indexPanel.hidden = true;
  }
}

/* ===== Gallery ===== */
function attachGalleryEvents(){
  prevBtn.onclick = () => { if(!media.length) return; currentIndex = (currentIndex-1+media.length)%media.length; renderGallery(); };
  nextBtn.onclick = () => { if(!media.length) return; currentIndex = (currentIndex+1)%media.length; renderGallery(); };

  // click immagine => fullscreen
  heroImg.onclick = () => toggleFullscreenMode();

  // open image
  openImgBtn.onclick = () => {
    const url = currentMediaUrlAbs();
    window.open(url, "_blank");
  };

  // whatsapp on photo
  waOnPhotoBtn.onclick = () => openWhatsAppForCurrentPhoto();

  // editor
  editPhotoBtn.onclick = () => openEditorForCurrentPhoto();
}

function renderGallery(){
  const m = media[currentIndex];
  const url = m.url;
  heroImg.src = url;
  heroImg.alt = m.label || `Foto ${currentIndex+1}`;

  imgBadge.textContent = pad2(currentIndex+1);
  imgCounter.textContent = `${pad2(currentIndex+1)}/${pad2(media.length)}`;

  // thumbs
  thumbRow.innerHTML = "";
  media.forEach((x, idx) => {
    const t = document.createElement("div");
    t.className = "thumb" + (idx===currentIndex ? " active" : "");
    const im = document.createElement("img");
    im.src = x.url;
    im.alt = x.label || ("Foto " + (idx+1));
    t.appendChild(im);
    t.onclick = () => { currentIndex = idx; renderGallery(); };
    thumbRow.appendChild(t);
  });

  // pins overlay (solo visualizzazione)
  renderPinsOverlayForCurrent();
}

/* overlay pins (solo view) */
function renderPinsOverlayForCurrent(){
  pinsLayer.innerHTML = "";
  const url = media[currentIndex]?.url;
  const pins = getPins(url);
  pins.forEach(p => {
    const d = document.createElement("div");
    d.className = "pin";
    d.textContent = String(p.n);
    d.style.left = (p.x*100) + "%";
    d.style.top  = (p.y*100) + "%";
    d.style.width = p.size + "px";
    d.style.height = p.size + "px";
    pinsLayer.appendChild(d);
  });
}

/* ===== WhatsApp foto corrente ===== */
function openWhatsAppForCurrentPhoto(){
  const m = media[currentIndex];
  if(!m) return;

  const photoNum = currentIndex + 1;
  const photoUrl = currentMediaUrlAbs();

  const contacts = Array.isArray(data?.contacts) ? data.contacts.filter(c=>c?.phone) : [];
  if(!contacts.length){
    alert("Mancano contatti nel JSON (contacts[])");
    return;
  }

  const msg = `Ciao! Vorrei informazioni sulla FOTO #${photoNum} della vetrina "${data?.title || vId}".\nLink foto: ${photoUrl}`;

  // Qui NON si può mandare “a due numeri insieme” con un solo click:
  // WhatsApp apre 1 chat alla volta. Quindi scegliamo un contatto.
  if(contacts.length === 1){
    window.open(waLink(contacts[0].phone, msg), "_blank");
    return;
  }

  // mini scelta
  const choice = prompt(
    `A chi vuoi scrivere?\n1 = ${contacts[0].name}\n2 = ${contacts[1].name}\nScrivi 1 o 2`,
    "1"
  );
  const idx = (choice === "2") ? 1 : 0;
  window.open(waLink(contacts[idx].phone, msg), "_blank");
}

function currentMediaUrlAbs(){
  const rel = media[currentIndex]?.url || "";
  if(rel.startsWith("http")) return rel;
  return baseUrl() + rel.replace(/^\//,"");
}

/* ===== Share vetrina ===== */
async function shareVetrina(){
  const link = vetrinaLink(vId);
  const title = data?.title || "Vetrina";
  const text = (data?.voice?.text || data?.description || "").slice(0,140);

  try{
    if(navigator.share){
      await navigator.share({ title, text, url: link });
    }else{
      await navigator.clipboard.writeText(link);
      alert("Link copiato:\n" + link);
    }
  }catch(e){
    // fallback
    try{
      await navigator.clipboard.writeText(link);
      alert("Link copiato:\n" + link);
    }catch(_){
      prompt("Copia link:", link);
    }
  }
}

/* ===== Fullscreen CSS-mode ===== */
function toggleFullscreenMode(){
  document.body.classList.toggle("fs");
}

/* ===== Theme ===== */
function applyTheme(){
  // semplice: salva preferenza (tu puoi espandere)
  localStorage.setItem("sercuctech_theme", theme);
}
function toggleTheme(){
  theme = (theme === "dark") ? "light" : "dark";
  // qui non cambio i colori (già gestiti in css), ma salvo lo stato
  applyTheme();
  alert("Tema salvato: " + theme + " (se vuoi lo rendiamo reale con variabili CSS)");
}

/* ===== Kiosk ===== */
function applyKiosk(){
  localStorage.setItem("sercuctech_kiosk", kiosk ? "1" : "0");
  // in kiosk: blocchiamo gesture indietro? no. solo indicazione
}
function toggleKiosk(){
  kiosk = !kiosk;
  applyKiosk();
  alert("Kiosk: " + (kiosk ? "ON" : "OFF"));
}

/* ===== Audio gate ===== */
enableAudioBtn.onclick = () => {
  audioUnlocked = true;
  localStorage.setItem("sercuctech_audio_unlocked","1");
  audioGate.hidden = true;
  if(lastSpokenText) speak(lastSpokenText, data?.voice?.lang || "it-IT");
};
skipAudioBtn.onclick = () => {
  audioGate.hidden = true;
};

/* =========================================================
   EDITOR NUMERINI su CANVAS
   ========================================================= */
let ed = {
  img: null,
  url: "",
  pins: [],
  size: 28
};

function openEditorForCurrentPhoto(){
  const m = media[currentIndex];
  if(!m) return;

  ed.url = m.url;
  ed.pins = getPins(ed.url);
  ed.size = Number(pinSizeRange.value || 28);

  pinSizeVal.textContent = ed.size + "px";
  saveResult.textContent = "";

  editModal.hidden = false;
  loadImageToCanvas(currentMediaUrlAbs());
}

closeEditBtn.onclick = () => {
  editModal.hidden = true;
};

pinSizeRange.oninput = () => {
  ed.size = Number(pinSizeRange.value || 28);
  pinSizeVal.textContent = ed.size + "px";
  redrawCanvas();
};

undoPinBtn.onclick = () => {
  ed.pins.pop();
  setPins(ed.url, ed.pins);
  redrawCanvas();
  renderPinsOverlayForCurrent();
};
clearPinsBtn.onclick = () => {
  if(!confirm("Vuoi cancellare tutti i numerini su questa foto?")) return;
  ed.pins = [];
  setPins(ed.url, ed.pins);
  redrawCanvas();
  renderPinsOverlayForCurrent();
};

downloadPngBtn.onclick = async () => {
  try{
    const blob = await canvasToPngBlob(editCanvas);
    const filename = buildOutputName(ed.url, "labeled");
    downloadBlob(blob, filename);
    saveResult.textContent = "✅ PNG scaricato: " + filename + " (ora caricalo tu in /media su GitHub).";
  }catch(e){
    alert("Errore export PNG.");
  }
};

saveGithubBtn.onclick = async () => {
  try{
    const token = getGithubToken();
    if(!token){
      const t = prompt("Incolla il tuo GitHub Token (PAT) con permesso repo (contents write). Verrà salvato SOLO sul tuo telefono.", "");
      if(!t) return;
      localStorage.setItem("sercuctech_github_token", t.trim());
    }

    const cfg = getGithubConfig();
    if(!cfg){
      const owner = prompt("GitHub owner (username):", "creamiaappsercuctech");
      const repo  = prompt("Repo name:", "SerCucTech");
      const branch= prompt("Branch:", "main") || "main";
      if(!owner || !repo) return;
      localStorage.setItem("sercuctech_github_cfg", JSON.stringify({ owner, repo, branch }));
    }

    const blob = await canvasToPngBlob(editCanvas);
    const b64 = await blobToBase64(blob);

    // nome nuovo: renzo11-010-labeled.png
    const outName = buildOutputName(ed.url, "labeled").replace(/\.jpg$/i,".png");

    const path = "media/" + outName.split("/").pop(); // forziamo in media/
    const res = await githubPutFile(path, b64);

    saveResult.textContent =
      "✅ Salvato su GitHub: " + path + "\n" +
      "Link immagine: " + (baseUrl() + path);

    // aggiorna overlay e rimani
  }catch(e){
    alert("Salvataggio su GitHub fallito.\n\n" + (e?.message || e));
  }
};

function buildOutputName(originalUrl, suffix){
  // media/renzo11-010.jpg => renzo11-010-labeled.png
  const base = originalUrl.split("/").pop() || "foto.jpg";
  const parts = base.split(".");
  const ext = parts.length>1 ? parts.pop() : "jpg";
  const name = parts.join(".");
  return `${name}-${suffix}.${ext}`;
}

function loadImageToCanvas(url){
  const img = new Image();
  img.crossOrigin = "anonymous"; // per GitHub raw va ok; se blocca, export può fallire
  img.onload = () => {
    ed.img = img;
    // canvas dimensioni reali
    editCanvas.width = img.naturalWidth;
    editCanvas.height = img.naturalHeight;

    // click/tap per aggiungere pin
    editCanvas.onclick = (ev) => {
      const rect = editCanvas.getBoundingClientRect();
      const x = (ev.clientX - rect.left) / rect.width;
      const y = (ev.clientY - rect.top) / rect.height;
      const n = (ed.pins.length ? ed.pins[ed.pins.length-1].n + 1 : 1);
      ed.pins.push({ n, x, y, size: ed.size });
      setPins(ed.url, ed.pins);
      redrawCanvas();
      renderPinsOverlayForCurrent();
    };

    redrawCanvas();
  };
  img.onerror = () => {
    alert("Non riesco a caricare l'immagine. Controlla che esista in /media.");
  };
  img.src = url;
}

function redrawCanvas(){
  if(!ed.img) return;
  const ctx = editCanvas.getContext("2d");
  ctx.clearRect(0,0,editCanvas.width, editCanvas.height);
  ctx.drawImage(ed.img, 0, 0);

  // disegna pins
  ed.pins.forEach(p => drawPin(ctx, p));
}

function drawPin(ctx, p){
  const x = p.x * editCanvas.width;
  const y = p.y * editCanvas.height;
  const r = (p.size || 28) / 2;

  // cerchio
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI*2);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fill();
  ctx.lineWidth = Math.max(2, r*0.14);
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.stroke();

  // numero
  ctx.fillStyle = "#fff";
  ctx.font = `900 ${Math.max(14, r*1.15)}px system-ui, Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(p.n), x, y);
  ctx.restore();
}

function canvasToPngBlob(canvas){
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if(!b) reject(new Error("toBlob failed"));
      else resolve(b);
    }, "image/png", 0.92);
  });
}

function downloadBlob(blob, filename){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 800);
}

function blobToBase64(blob){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const dataUrl = r.result; // data:image/png;base64,...
      const b64 = String(dataUrl).split(",")[1] || "";
      resolve(b64);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/* =========================================================
   GitHub API (OPZIONALE)
   - salva file in repo con commit
   ========================================================= */
function getGithubToken(){
  return localStorage.getItem("sercuctech_github_token") || "";
}
function getGithubConfig(){
  try{ return JSON.parse(localStorage.getItem("sercuctech_github_cfg") || "null"); }catch{ return null; }
}

async function githubGetSha(path){
  const cfg = getGithubConfig();
  const token = getGithubToken();
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${encodeURIComponent(cfg.branch)}`;
  const r = await fetch(url, {
    headers: {
      "Authorization": `token ${token}`,
      "Accept": "application/vnd.github+json"
    }
  });
  if(r.status === 404) return null;
  if(!r.ok) throw new Error("GitHub read error: " + r.status);
  const j = await r.json();
  return j.sha || null;
}

async function githubPutFile(path, base64Content){
  const cfg = getGithubConfig();
  const token = getGithubToken();
  const sha = await githubGetSha(path);

  const body = {
    message: `Update ${path} (labeled)`,
    content: base64Content,
    branch: cfg.branch
  };
  if(sha) body.sha = sha;

  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path}`;
  const r = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `token ${token}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if(!r.ok){
    const t = await r.text();
    throw new Error("GitHub write error: " + r.status + "\n" + t.slice(0,300));
  }
  return await r.json();
}

/* =========================================================
   BOOT
   ========================================================= */
loadVetrina();
