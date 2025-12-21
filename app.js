/* ===================== HELPERS ===================== */
const $ = (id) => document.getElementById(id);

function qsParam(name){
  const u = new URL(location.href);
  return u.searchParams.get(name);
}
function pad2(n){ return String(n).padStart(2,"0"); }

function absUrl(rel){
  try{
    return new URL(rel, location.href).toString();
  }catch(e){
    return rel;
  }
}

function cleanPhone(phone){
  return String(phone || "").replace(/[^\d+]/g,"");
}
function phoneForSpeech(phone){
  // +3933329... -> +39 333 292 7842 (spazi = meno pause strane)
  const p = cleanPhone(phone);
  if(!p) return "";
  let s = p.startsWith("+") ? "+" : "";
  const digits = p.replace(/[^\d]/g,"");
  // se inizia con 39 metti +39
  let d = digits;
  if(d.startsWith("39")){ s = "+39 "; d = d.slice(2); }
  // raggruppa in blocchi 3-3-4 (italia mobile)
  const a = d.slice(0,3);
  const b = d.slice(3,6);
  const c = d.slice(6);
  return (s + [a,b,c].filter(Boolean).join(" ")).trim();
}

function waShareLink(text){
  return "https://wa.me/?text=" + encodeURIComponent(text);
}

/* ===================== STATE ===================== */
let currentId = qsParam("id") || "";
let vetrina = null;
let media = [];
let idx = 0;

let speechUnlocked = false;
let speaking = false;

/* ===================== ELEMENTS ===================== */
const pageTitle = $("pageTitle");
const pageDesc  = $("pageDesc");
const badgeId   = $("badgeId");

const voicePanel = $("voicePanel");
const voiceText  = $("voiceText");
const contactsRow = $("contactsRow");

const indexPanel = $("indexPanel");
const indexLinks = $("indexLinks");
const refreshIndexBtn = $("refreshIndexBtn");

const heroImg = $("heroImg");
const imgCounter = $("imgCounter");
const imgBadge = $("imgBadge");
const thumbRow = $("thumbRow");

const prevBtn = $("prevBtn");
const nextBtn = $("nextBtn");

const shareBtn = $("shareBtn");
const waPhotoBtn = $("waPhotoBtn");

const fullBtn = $("fullBtn");
const homeBtn = $("homeBtn");
const voiceBtn = $("voiceBtn");
const stopBtn = $("stopBtn");
const themeBtn = $("themeBtn");
const kioskBtn = $("kioskBtn");

const audioGate = $("audioGate");
const enableAudioBtn = $("enableAudioBtn");
const skipAudioBtn = $("skipAudioBtn");

const pinsLayer = $("pinsLayer");
const labelCard = $("labelCard");
const labelModeBadge = $("labelModeBadge");
const labelToggleBtn = $("labelToggleBtn");
const labelUndoBtn = $("labelUndoBtn");
const labelClearBtn = $("labelClearBtn");
const pinSizeRange = $("pinSizeRange");
const pinSizeValue = $("pinSizeValue");
const exportPinsBtn = $("exportPinsBtn");
const copyPinsBtn = $("copyPinsBtn");
const pinsJsonBox = $("pinsJsonBox");

/* ===================== SPEECH ===================== */
function canSpeak(){
  return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function speak(text, lang="it-IT"){
  if(!canSpeak()) return;
  window.speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang || "it-IT";
  u.rate = 1;
  u.pitch = 1;
  u.onstart = () => { speaking = true; };
  u.onend = () => { speaking = false; };
  u.onerror = () => { speaking = false; };
  window.speechSynthesis.speak(u);
}

function stopSpeak(){
  if(canSpeak()) window.speechSynthesis.cancel();
  speaking = false;
}

/* ===================== PINS (manual labels) ===================== */
function pinsKey(){
  const url = media[idx]?.url || "noimg";
  return `pins_${currentId}_${url}`;
}
function getPins(){
  try{ return JSON.parse(localStorage.getItem(pinsKey())) || []; }
  catch(e){ return []; }
}
function setPins(list){
  localStorage.setItem(pinsKey(), JSON.stringify(list));
}
function renderPins(){
  pinsLayer.innerHTML = "";
  const pins = (vetrina && vetrina.pinsData && vetrina.pinsData[media[idx]?.url]) ? vetrina.pinsData[media[idx]?.url] : getPins();
  for(const p of pins){
    const el = document.createElement("div");
    el.className = "pin";
    el.style.left = (p.x*100) + "%";
    el.style.top  = (p.y*100) + "%";
    el.textContent = p.n;
    pinsLayer.appendChild(el);
  }
}

let labelMode = false;
let titleTapCount = 0;
let titleTapTimer = null;

function setLabelMode(on){
  labelMode = !!on;
  labelModeBadge.textContent = labelMode ? "ON" : "OFF";
  labelModeBadge.style.opacity = labelMode ? "1" : ".7";
  labelCard.hidden = !labelMode;
}

function addPinAt(clientX, clientY){
  const rect = heroImg.getBoundingClientRect();
  if(rect.width < 50 || rect.height < 50) return;
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  if(x < 0 || x > 1 || y < 0 || y > 1) return;

  const pins = getPins();
  const n = pins.length + 1;
  pins.push({ n, x, y });
  setPins(pins);
  renderPins();
}

/* ===================== GALLERY ===================== */
function setIndex(newIdx){
  if(!media.length) return;
  idx = (newIdx + media.length) % media.length;

  const m = media[idx];
  heroImg.src = m.url;
  heroImg.alt = m.label || `Foto ${idx+1}`;

  imgCounter.textContent = `${pad2(idx+1)}/${pad2(media.length)}`;
  imgBadge.textContent = pad2(idx+1);

  [...thumbRow.children].forEach((t,i)=>{
    t.classList.toggle("active", i===idx);
  });

  renderPins();
  updateWaPhotoButton();
}

function buildThumbs(){
  thumbRow.innerHTML = "";
  media.forEach((m,i)=>{
    const b = document.createElement("button");
    b.className = "thumb";
    b.type = "button";
    b.innerHTML = `<img src="${m.url}" alt="${m.label || ("Foto " + (i+1))}">`;
    b.addEventListener("click", ()=> setIndex(i));
    thumbRow.appendChild(b);
  });
}

function next(){ setIndex(idx+1); }
function prev(){ setIndex(idx-1); }

/* Swipe */
let touchStartX = 0;
let touchStartY = 0;
let touchMoved = false;

heroImg.addEventListener("touchstart", (e)=>{
  if(!e.touches || !e.touches[0]) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchMoved = false;
}, {passive:true});

heroImg.addEventListener("touchmove", (e)=>{
  if(!e.touches || !e.touches[0]) return;
  const dx = e.touches[0].clientX - touchStartX;
  const dy = e.touches[0].clientY - touchStartY;
  if(Math.abs(dx) > 12 || Math.abs(dy) > 12) touchMoved = true;
}, {passive:true});

heroImg.addEventListener("touchend", ()=>{
  if(!touchMoved) return;
  const dx = (event.changedTouches && event.changedTouches[0]) ? (event.changedTouches[0].clientX - touchStartX) : 0;
  if(Math.abs(dx) > 40){
    dx < 0 ? next() : prev();
  }
});

/* Tap = fullscreen (ma se labelMode ON, tap mette un pin) */
heroImg.addEventListener("click", (e)=>{
  if(labelMode){
    addPinAt(e.clientX, e.clientY);
    return;
  }
  document.body.classList.toggle("fs");
});

/* ===================== WHATSAPP PHOTO BUTTON ===================== */
function updateWaPhotoButton(){
  const m = media[idx];
  if(!m){ waPhotoBtn.disabled = true; return; }
  waPhotoBtn.disabled = false;
}

function makePhotoMessage(){
  const m = media[idx];
  const title = vetrina?.title || currentId || "Vetrina";
  const photoNum = idx + 1;
  const photoLabel = m?.label ? ` (${m.label})` : "";
  const page = location.href;
  const img = m?.url ? absUrl(m.url) : "";
  const contacts = (vetrina?.contacts || []).map(c => `${c.name}: ${cleanPhone(c.phone)}`).join(" | ");

  return `Ciao! Vorrei informazioni.\nVetrina: ${title}\nFoto #${photoNum}${photoLabel}\nImmagine: ${img}\nLink vetrina: ${page}\nContatti: ${contacts}`;
}

/* ===================== INDEX (ALTRE VETRINE) ===================== */
async function loadIndex(){
  // prova data/vetrine.json e poi data/index.json
  const candidates = ["data/vetrine.json", "data/index.json"];
  let list = null;

  for(const path of candidates){
    try{
      const r = await fetch(path + `?v=${Date.now()}`, {cache:"no-store"});
      if(!r.ok) continue;
      const j = await r.json();
      if(Array.isArray(j?.vetrine)) { list = j.vetrine; break; }
    }catch(e){}
  }

  if(!list || !list.length){
    indexPanel.hidden = true;
    return;
  }

  indexLinks.innerHTML = "";
  list.forEach(v=>{
    const a = document.createElement("a");
    a.className = "indexLink";
    a.href = `vetrina.html?id=${encodeURIComponent(v.id)}`;
    a.textContent = v.title ? v.title : v.id;
    indexLinks.appendChild(a);
  });

  indexPanel.hidden = false;
}

/* ===================== LOAD VETRINA DATA ===================== */
async function loadVetrina(id){
  const path = `data/${id}.json?v=${Date.now()}`;
  const r = await fetch(path, {cache:"no-store"});
  if(!r.ok) throw new Error("Non riesco a leggere " + path);
  return await r.json();
}

function renderHeader(){
  const title = vetrina?.title || currentId;
  pageTitle.textContent = title;

  pageDesc.textContent = vetrina?.description || "";
  badgeId.textContent = `id: ${currentId}`;

  // Voice panel
  const vt = vetrina?.voice?.text || "";
  const lang = vetrina?.voice?.lang || "it-IT";

  if(vt.trim()){
    voiceText.textContent = vt;
    voicePanel.hidden = false;

    // click su qualunque parte del testo => parla
    voiceText.onclick = () => {
      if(!speechUnlocked){
        audioGate.hidden = false;
        return;
      }
      // sostituisci numeri contatti con formato “telefono” per parlare meglio
      let speakText = vt;
      (vetrina.contacts || []).forEach(c=>{
        const raw = cleanPhone(c.phone);
        if(raw){
          const spoken = phoneForSpeech(raw);
          // non sempre matcha, quindi aggiungo anche finale con numeri parlati
          speakText += ` ${c.name}: ${spoken}.`;
        }
      });
      speak(speakText, lang);
    };
  }else{
    voicePanel.hidden = true;
  }

  // Contacts
  contactsRow.innerHTML = "";
  const contacts = Array.isArray(vetrina?.contacts) ? vetrina.contacts : [];
  if(contacts.length){
    contacts.forEach(c=>{
      const p = cleanPhone(c.phone);
      const wa = document.createElement("a");
      wa.className = "contactPill";
      wa.href = `https://wa.me/${p.replace("+","")}`;
      wa.target = "_blank";
      wa.rel = "noopener";
      wa.innerHTML = `🟢 ${c.name} <span>${phoneForSpeech(p)}</span> (WhatsApp)`;

      const call = document.createElement("a");
      call.className = "contactPill";
      call.href = `tel:${p}`;
      call.innerHTML = `📞 ${c.name} <span>${phoneForSpeech(p)}</span> (Chiama)`;

      contactsRow.appendChild(wa);
      contactsRow.appendChild(call);
    });
  }
}

/* ===================== BUTTONS ===================== */
prevBtn.addEventListener("click", prev);
nextBtn.addEventListener("click", next);

shareBtn.addEventListener("click", async ()=>{
  const url = location.href;
  const title = vetrina?.title || "Vetrina";
  const text = `Guarda questa vetrina: ${title}\n${url}`;
  if(navigator.share){
    try{ await navigator.share({title, text, url}); return; }catch(e){}
  }
  window.open(waShareLink(text), "_blank");
});

waPhotoBtn.addEventListener("click", ()=>{
  const msg = makePhotoMessage();
  window.open(waShareLink(msg), "_blank");
});

fullBtn.addEventListener("click", ()=> document.body.classList.toggle("fs"));
homeBtn.addEventListener("click", ()=> window.scrollTo({top:0, behavior:"smooth"}));
voiceBtn.addEventListener("click", ()=> {
  if(!voicePanel.hidden) voiceText.click();
});
stopBtn.addEventListener("click", stopSpeak);
themeBtn.addEventListener("click", ()=> {
  document.body.classList.toggle("light");
});
kioskBtn.addEventListener("click", ()=> {
  // semplice “kiosk”: nasconde barra
  document.querySelector(".bottombar")?.classList.toggle("hide");
});

refreshIndexBtn.addEventListener("click", loadIndex);

enableAudioBtn.addEventListener("click", ()=>{
  speechUnlocked = true;
  audioGate.hidden = true;
  // fai partire subito il messaggio se c’è
  if(!voicePanel.hidden && vetrina?.voice?.text){
    voiceText.click();
  }
});
skipAudioBtn.addEventListener("click", ()=>{
  audioGate.hidden = true;
});

/* ===================== LABEL MODE (tap titolo 5 volte) ===================== */
pageTitle.addEventListener("click", ()=>{
  titleTapCount++;
  clearTimeout(titleTapTimer);
  titleTapTimer = setTimeout(()=>{ titleTapCount = 0; }, 900);

  if(titleTapCount >= 5){
    titleTapCount = 0;
    setLabelMode(!labelMode);
  }
});

labelToggleBtn?.addEventListener("click", ()=> setLabelMode(!labelMode));
labelUndoBtn?.addEventListener("click", ()=>{
  const pins = getPins();
  pins.pop();
  setPins(pins);
  renderPins();
});
labelClearBtn?.addEventListener("click", ()=>{
  if(!confirm("Vuoi cancellare TUTTI i numerini di questa foto?")) return;
  setPins([]);
  renderPins();
});
pinSizeRange?.addEventListener("input", ()=>{
  const v = Number(pinSizeRange.value || 28);
  pinSizeValue.textContent = String(v);
  document.documentElement.style.setProperty("--pinSize", v + "px");
});
exportPinsBtn?.addEventListener("click", ()=>{
  const url = media[idx]?.url;
  const pins = getPins();
  const out = { img: url, pins };
  pinsJsonBox.value = JSON.stringify(out, null, 2);
});
copyPinsBtn?.addEventListener("click", async ()=>{
  try{
    await navigator.clipboard.writeText(pinsJsonBox.value || "");
    alert("Copiato ✅");
  }catch(e){
    alert("Non riesco a copiare. Seleziona e copia manualmente.");
  }
});

/* ===================== INIT ===================== */
(async function init(){
  try{
    if(!currentId){
      // se non c’è id, prova a prendere il primo da data/vetrine.json
      try{
        const r = await fetch("data/vetrine.json?v="+Date.now(), {cache:"no-store"});
        const j = await r.json();
        if(j?.vetrine?.[0]?.id) currentId = j.vetrine[0].id;
      }catch(e){}
    }
    if(!currentId) currentId = "renzo11";

    vetrina = await loadVetrina(currentId);

    // media
    media = Array.isArray(vetrina?.media) ? vetrina.media.filter(x=>x && x.type==="image" && x.url) : [];
    if(!media.length){
      // fallback: se hai messo immagini in altro campo
      media = [];
    }

    renderHeader();
    await loadIndex();

    if(media.length){
      buildThumbs();
      setIndex(0);
    }else{
      heroImg.alt = "Nessuna immagine";
      imgCounter.textContent = "00/00";
      imgBadge.textContent = "--";
    }

  }catch(err){
    pageTitle.textContent = "Errore";
    pageDesc.textContent = (err && err.message) ? err.message : "Errore sconosciuto";
    badgeId.textContent = `id: ${currentId || "-"}`;
    console.error(err);
  }
})();
