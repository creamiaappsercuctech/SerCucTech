/* ===================== VETRINA APP (SerCucTech) ===================== */

const qs = (s, el=document) => el.querySelector(s);
const qsa = (s, el=document) => Array.from(el.querySelectorAll(s));

const els = {
  pageTitle: qs('#pageTitle'),
  pageDesc: qs('#pageDesc'),
  badgeId: qs('#badgeId'),

  voicePanel: qs('#voicePanel'),
  voiceText: qs('#voiceText'),
  voiceClickable: qs('#voiceClickable'),
  contactsRow: qs('#contactsRow'),

  indexPanel: qs('#indexPanel'),
  indexList: qs('#indexList'),
  indexRefreshBtn: qs('#indexRefreshBtn'),

  heroImg: qs('#heroImg'),
  imgWrap: qs('#imgWrap'),
  imgCounter: qs('#imgCounter'),
  imgBadge: qs('#imgBadge'),
  prevBtn: qs('#prevBtn'),
  nextBtn: qs('#nextBtn'),
  thumbRow: qs('#thumbRow'),
  pinsLayer: qs('#pinsLayer'),

  waPhotoBtn: qs('#waPhotoBtn'),
  shareBtn: qs('#shareBtn'),

  filesCard: qs('#filesCard'),
  filesList: qs('#filesList'),

  homeBtn: qs('#homeBtn'),
  voiceBtn: qs('#voiceBtn'),
  stopBtn: qs('#stopBtn'),
  fullBtn: qs('#fullBtn'),
  themeBtn: qs('#themeBtn'),
  kioskBtn: qs('#kioskBtn'),

  audioGate: qs('#audioGate'),
  enableAudioBtn: qs('#enableAudioBtn'),
  skipAudioBtn: qs('#skipAudioBtn'),

  waModal: qs('#waModal'),
  waModalText: qs('#waModalText'),
  waOpenSecondBtn: qs('#waOpenSecondBtn'),
  waCloseBtn: qs('#waCloseBtn'),

  labelCard: qs('#labelCard'),
  labelModeBadge: qs('#labelModeBadge'),
  labelToggleBtn: qs('#labelToggleBtn'),
  labelUndoBtn: qs('#labelUndoBtn'),
  labelClearBtn: qs('#labelClearBtn'),
  pinSizeRange: qs('#pinSizeRange'),
  pinSizeValue: qs('#pinSizeValue'),
  exportPinsBtn: qs('#exportPinsBtn'),
  copyPinsBtn: qs('#copyPinsBtn'),
  pinsJsonBox: qs('#pinsJsonBox'),

  adminCard: qs('#adminCard'),
  adminBadge: qs('#adminBadge'),
  exportRequestsBtn: qs('#exportRequestsBtn'),
  copyRequestsBtn: qs('#copyRequestsBtn'),
  clearRequestsBtn: qs('#clearRequestsBtn'),
  requestsBox: qs('#requestsBox'),

  errorCard: qs('#errorCard'),
  errorText: qs('#errorText'),
};

const params = new URLSearchParams(location.search);
const VETRINA_ID = (params.get('id') || 'renzo11').trim();

const DATA_URL = `data/${encodeURIComponent(VETRINA_ID)}.json?v=${Date.now()}`;
const INDEX_URL = `data/vetrine.json?v=${Date.now()}`; // formato A

const LS_PINS_KEY = (id)=> `sercuctech_pins_${id}`;
const LS_REQ_KEY  = (id)=> `sercuctech_requests_${id}`;
const LS_THEME_KEY = `sercuctech_theme`;
const LS_KIOSK_KEY = `sercuctech_kiosk`;
const LS_ADMIN_KEY = `sercuctech_admin_enabled`;

let state = {
  data: null,
  media: [],
  idx: 0,

  // audio
  speaking: false,
  audioUnlocked: false,

  // fullscreen
  isFull: false,

  // pins admin
  adminEnabled: false,
  labelMode: false,
  pinSize: 28,
  currentPins: {}, // per immagine: { "media/xxx.jpg": [{x,y,n,size}] }

  // whatsapp dual send
  pendingSecondWaUrl: null,
};

init().catch(err => showError(String(err || 'Errore sconosciuto')));

/* ===================== INIT ===================== */
async function init(){
  applyTheme(loadLS(LS_THEME_KEY, 'dark'));
  state.adminEnabled = loadLS(LS_ADMIN_KEY, '0') === '1';
  updateAdminUI();

  els.badgeId.textContent = `id: ${VETRINA_ID}`;

  // carico vetrina
  const data = await fetchJson(DATA_URL);
  state.data = data;

  // titolo + descrizione
  els.pageTitle.textContent = data.title || VETRINA_ID;
  els.pageDesc.textContent = data.description || '';
  document.title = data.title ? `Vetrina • ${data.title}` : `Vetrina • ${VETRINA_ID}`;

  // voice panel
  const voiceText = (data.voice && data.voice.text) ? String(data.voice.text) : '';
  if(voiceText.trim()){
    els.voicePanel.hidden = false;
    els.voiceText.textContent = voiceText.trim();
  }else{
    els.voicePanel.hidden = true;
  }

  // contatti
  renderContacts(data.contacts || []);

  // indice altre vetrine
  await loadIndex(); // non blocca se manca

  // media
  state.media = Array.isArray(data.media) ? data.media.filter(m => m && m.type === 'image' && m.url) : [];
  if(state.media.length === 0){
    showError(`Nessuna immagine trovata in media[].\nControlla il file data/${VETRINA_ID}.json`);
    return;
  }

  // pins (dal JSON se presenti, altrimenti da localStorage)
  state.currentPins = deepClone(data.pinsData || {});
  const lsPins = loadLS(LS_PINS_KEY(VETRINA_ID), null);
  if(lsPins && typeof lsPins === 'object' && !data.pinsData){
    // se non hai pinsData nel json, usa quelli locali (solo per te)
    state.currentPins = lsPins;
  }

  // files
  renderFiles(data.files || []);

  // galleria
  buildThumbs();
  setIndex(0);

  // handlers
  wireUI();

  // richieste info (solo tu)
  refreshRequestsBox();

  // kiosk
  const kiosk = loadLS(LS_KIOSK_KEY, '0') === '1';
  if(kiosk) document.body.classList.add('kioskMode');

  // hint: non autoplay, ma click su testo/Voice fa partire
}

/* ===================== FETCH ===================== */
async function fetchJson(url){
  const res = await fetch(url, {cache:'no-store'});
  if(!res.ok){
    throw new Error(`Non riesco a leggere ${url.replace(/\?.*$/,'')}\nHTTP ${res.status}`);
  }
  const txt = await res.text();
  try{
    return JSON.parse(txt);
  }catch(e){
    throw new Error(`JSON non valido in ${url.replace(/\?.*$/,'')}\n${e.message}`);
  }
}

/* ===================== UI WIRING ===================== */
function wireUI(){
  els.prevBtn.addEventListener('click', ()=> step(-1));
  els.nextBtn.addEventListener('click', ()=> step(+1));

  // swipe
  let startX = 0, startY = 0;
  els.imgWrap.addEventListener('touchstart', (e)=>{
    const t = e.touches[0];
    startX = t.clientX; startY = t.clientY;
  }, {passive:true});
  els.imgWrap.addEventListener('touchend', (e)=>{
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if(Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy)){
      step(dx < 0 ? +1 : -1);
    }
  }, {passive:true});

  // tap foto = fullscreen toggle
  els.heroImg.addEventListener('click', ()=> toggleFull());

  // bottoni barra
  els.homeBtn.addEventListener('click', ()=> scrollToTop());
  els.voiceBtn.addEventListener('click', ()=> speakVoice());
  els.stopBtn.addEventListener('click', ()=> stopVoice());
  els.fullBtn.addEventListener('click', ()=> toggleFull(true));
  els.themeBtn.addEventListener('click', ()=> toggleTheme());
  els.kioskBtn.addEventListener('click', ()=> toggleKiosk());

  // clic su testo audio = parte audio
  els.voiceClickable.addEventListener('click', ()=> speakVoice());

  // share vetrina su WhatsApp
  els.shareBtn.addEventListener('click', ()=> shareVetrinaWhatsApp());

  // WhatsApp su foto (unico) -> manda a 2 numeri (con passaggio anti-blocco)
  els.waPhotoBtn.addEventListener('click', ()=> askInfoWhatsAppForCurrentPhoto());

  // audio gate
  els.enableAudioBtn.addEventListener('click', ()=>{
    state.audioUnlocked = true;
    els.audioGate.hidden = true;
    speakVoice();
  });
  els.skipAudioBtn.addEventListener('click', ()=>{
    els.audioGate.hidden = true;
  });

  // modal per 2° numero
  els.waCloseBtn.addEventListener('click', ()=> closeWaModal());
  els.waOpenSecondBtn.addEventListener('click', ()=>{
    if(state.pendingSecondWaUrl){
      window.open(state.pendingSecondWaUrl, '_blank');
      state.pendingSecondWaUrl = null;
    }
    closeWaModal();
  });

  // indice refresh
  els.indexRefreshBtn.addEventListener('click', loadIndex);

  // admin: attiva con 5 tap sul titolo
  enableFiveTapAdmin();

  // label tool
  els.pinSizeRange.addEventListener('input', ()=>{
    state.pinSize = Number(els.pinSizeRange.value || 28);
    els.pinSizeValue.textContent = String(state.pinSize);
  });

  els.labelToggleBtn.addEventListener('click', ()=>{
    state.labelMode = !state.labelMode;
    updateLabelModeUI();
  });

  els.labelUndoBtn.addEventListener('click', undoPin);
  els.labelClearBtn.addEventListener('click', clearPinsForCurrentImage);

  els.exportPinsBtn.addEventListener('click', exportPinsData);
  els.copyPinsBtn.addEventListener('click', copyPinsData);

  // click su immagine per piazzare pin in label mode (solo admin)
  els.imgWrap.addEventListener('click', (e)=>{
    if(!state.adminEnabled || !state.labelMode) return;

    // evita che il click sul bottone WA o su altri overlay metta pin
    const target = e.target;
    if(target && (target.id === 'waPhotoBtn' || target.closest('.waOnPhoto'))) return;

    // click su immagine -> coordinate relative al wrap
    const rect = els.imgWrap.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    addPinForCurrentImage(x, y);
  });

  // richieste admin
  els.exportRequestsBtn.addEventListener('click', exportRequests);
  els.copyRequestsBtn.addEventListener('click', copyRequests);
  els.clearRequestsBtn.addEventListener('click', clearRequests);
}

/* ===================== GALLERY ===================== */
function buildThumbs(){
  els.thumbRow.innerHTML = '';
  state.media.forEach((m, i)=>{
    const b = document.createElement('button');
    b.className = 'thumb';
    b.type = 'button';
    b.title = m.label || `Foto ${i+1}`;
    b.addEventListener('click', ()=> setIndex(i));

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = m.url;
    img.alt = m.label || `Foto ${i+1}`;

    b.appendChild(img);
    els.thumbRow.appendChild(b);
  });
  markThumbActive();
}

function markThumbActive(){
  qsa('.thumb', els.thumbRow).forEach((t, i)=> t.classList.toggle('active', i === state.idx));
}

function setIndex(i){
  const n = state.media.length;
  state.idx = ((i % n) + n) % n;

  const item = state.media[state.idx];
  els.heroImg.src = item.url;
  els.heroImg.alt = item.label || `Foto ${state.idx+1}`;

  const a = String(state.idx + 1).padStart(2,'0');
  const b = String(n).padStart(2,'0');
  els.imgCounter.textContent = `${a}/${b}`;
  els.imgBadge.textContent = a;

  markThumbActive();
  renderPinsForCurrentImage();
}

function step(delta){
  setIndex(state.idx + delta);
}

/* ===================== FULLSCREEN ===================== */
async function toggleFull(forceOn){
  const wantOn = (typeof forceOn === 'boolean') ? forceOn : !state.isFull;

  // prefer Fullscreen API if available, else CSS fallback
  try{
    if(wantOn){
      state.isFull = true;
      document.body.classList.add('fullscreenMode');
      if(els.imgWrap.requestFullscreen) await els.imgWrap.requestFullscreen().catch(()=>{});
    }else{
      state.isFull = false;
      document.body.classList.remove('fullscreenMode');
      if(document.fullscreenElement) await document.exitFullscreen().catch(()=>{});
    }
  }catch(e){
    // fallback already applied
    state.isFull = wantOn;
    document.body.classList.toggle('fullscreenMode', wantOn);
  }
}

/* ===================== THEME / KIOSK ===================== */
function applyTheme(name){
  // semplice: dark only (ma lasciamo la struttura)
  saveLS(LS_THEME_KEY, name || 'dark');
}
function toggleTheme(){
  // (per ora teniamo dark, ma così non rompiamo nulla)
  applyTheme('dark');
}
function toggleKiosk(){
  const on = !document.body.classList.contains('kioskMode');
  document.body.classList.toggle('kioskMode', on);
  saveLS(LS_KIOSK_KEY, on ? '1' : '0');
}

/* ===================== VOICE ===================== */
function stopVoice(){
  try{
    window.speechSynthesis.cancel();
  }catch(e){}
  state.speaking = false;
}

function speakVoice(){
  const txt = (state.data && state.data.voice && state.data.voice.text) ? String(state.data.voice.text) : '';
  if(!txt.trim()) return;

  // se il telefono blocca, mostra gate SOLO se non sbloccato ancora
  if(!state.audioUnlocked){
    // proviamo comunque: se fallisce, mostriamo il gate
    const ok = trySpeak(txt);
    if(!ok){
      els.audioGate.hidden = false;
      return;
    }
    state.audioUnlocked = true;
    return;
  }

  trySpeak(txt);
}

function trySpeak(text){
  try{
    stopVoice();
    const u = new SpeechSynthesisUtterance(formatForPhoneSpeech(text));
    u.lang = (state.data && state.data.voice && state.data.voice.lang) ? state.data.voice.lang : 'it-IT';
    u.rate = 1.0;
    u.pitch = 1.0;
    u.onend = ()=> { state.speaking = false; };
    u.onerror = ()=> { state.speaking = false; };

    state.speaking = true;
    window.speechSynthesis.speak(u);
    return true;
  }catch(e){
    return false;
  }
}

/* Trasforma numeri telefono in “dette a cifra” */
function formatForPhoneSpeech(s){
  let out = String(s);

  // Normalizza: +39 333... / 333... -> spazio tra cifre
  out = out.replace(/(\+?\d[\d\s]{6,}\d)/g, (m)=>{
    const raw = m.replace(/\s+/g,'');
    if(raw.length < 7) return m;

    // +39...
    if(raw.startsWith('+')){
      const digits = raw.slice(1).replace(/\D/g,'').split('').join(' ');
      return `più ${digits}`;
    }
    // 333...
    const digits = raw.replace(/\D/g,'').split('').join(' ');
    return digits;
  });

  return out;
}

/* ===================== CONTACTS ===================== */
function renderContacts(list){
  els.contactsRow.innerHTML = '';

  if(!Array.isArray(list) || list.length === 0){
    // fallback: se non c'è array contacts, prova a estrarre numeri dal testo
    const fromText = extractPhonesFromText((state.data && state.data.voice && state.data.voice.text) ? state.data.voice.text : '');
    fromText.forEach((p, i)=> list.push({name:`Contatto ${i+1}`, phone:p}));
  }

  (list || []).forEach(c=>{
    const name = (c && c.name) ? String(c.name) : 'Contatto';
    const phone = (c && c.phone) ? String(c.phone) : '';
    if(!phone) return;

    const norm = normalizePhone(phone);
    const wa = `https://wa.me/${norm.replace(/^\+/, '')}`;
    const tel = `tel:${norm}`;

    const a = document.createElement('a');
    a.className = 'contactChip';
    a.href = wa;
    a.target = '_blank';
    a.rel = 'noopener';

    a.innerHTML = `<span>🟢</span><b>${escapeHtml(name)}</b><span>${escapeHtml(prettyPhone(norm))}</span>`;
    a.addEventListener('click', (e)=>{
      // tap breve -> WhatsApp
      // tap lungo -> user può copiare
    });

    // aggiungo anche chiamata (secondo chip)
    const b = document.createElement('a');
    b.className = 'contactChip';
    b.href = tel;
    b.innerHTML = `<span>📞</span><b>${escapeHtml(name)}</b><span>Chiama</span>`;

    els.contactsRow.appendChild(a);
    els.contactsRow.appendChild(b);
  });
}

function normalizePhone(p){
  let s = String(p).trim();
  if(!s) return '';
  s = s.replace(/[^\d+]/g,'');
  if(s.startsWith('00')) s = '+' + s.slice(2);
  if(!s.startsWith('+') && s.length >= 9){
    // se è italiano e non ha prefisso, metti +39
    if(s.startsWith('3') || s.startsWith('0')) s = '+39' + s;
  }
  return s;
}
function prettyPhone(p){
  // +393332... -> +39 333 292 7842
  const s = String(p);
  if(!s.startsWith('+')) return s;
  const cc = s.slice(0,3); // +39
  const rest = s.slice(3);
  if(rest.length <= 3) return s;
  const a = rest.slice(0,3);
  const b = rest.slice(3,6);
  const c = rest.slice(6);
  return `${cc} ${a} ${b} ${c}`.trim();
}

function extractPhonesFromText(t){
  const s = String(t || '');
  const matches = s.match(/(\+?\d[\d\s]{6,}\d)/g) || [];
  return matches.map(m=> normalizePhone(m)).filter(Boolean);
}

/* ===================== INDEX (ALTRE VETRINE) ===================== */
async function loadIndex(){
  els.indexList.innerHTML = '';
  els.indexPanel.hidden = true;

  try{
    const idx = await fetchJson(INDEX_URL);
    const arr = (idx && Array.isArray(idx.vetrine)) ? idx.vetrine : [];
    if(arr.length === 0) return;

    // render
    arr.forEach(v=>{
      if(!v || !v.id) return;
      const a = document.createElement('a');
      a.className = 'indexLink';
      a.href = `vetrina.html?id=${encodeURIComponent(v.id)}`;
      a.innerHTML = `<span class="dot"></span><span>${escapeHtml(v.title || v.id)}</span>`;
      els.indexList.appendChild(a);
    });

    els.indexPanel.hidden = false;
  }catch(e){
    // se manca il file, non mostriamo errore (solo silenzioso)
    els.indexPanel.hidden = true;
  }
}

/* ===================== FILES ===================== */
function renderFiles(files){
  const arr = Array.isArray(files) ? files : [];
  if(arr.length === 0){
    els.filesCard.hidden = true;
    return;
  }
  els.filesCard.hidden = false;
  els.filesList.innerHTML = '';
  arr.forEach(f=>{
    if(!f || !f.url) return;
    const a = document.createElement('a');
    a.className = 'fileLink';
    a.href = f.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML = `<span>${escapeHtml(f.label || f.url)}</span><span>Apri</span>`;
    els.filesList.appendChild(a);
  });
}

/* ===================== WHATSAPP (FOTO + DUE NUMERI) ===================== */
function askInfoWhatsAppForCurrentPhoto(){
  const contacts = Array.isArray(state.data.contacts) ? state.data.contacts : [];
  const renzo = contacts.find(c => (c.name||'').toLowerCase().includes('renzo')) || contacts[0];
  const sergio = contacts.find(c => (c.name||'').toLowerCase().includes('sergio')) || contacts[1];

  const item = state.media[state.idx];
  const photoUrl = absoluteUrl(item.url);
  const vLink = absoluteUrl(`vetrina.html?id=${encodeURIComponent(VETRINA_ID)}`);

  const msg =
`Ciao! Chiedo informazioni per questa foto.

Vetrina: ${vLink}
Foto: ${photoUrl}

Per favore dimmi prezzo/dettagli e disponibilità. Grazie!`;

  // salva richiesta (solo per te, ma l'evento viene registrato sempre nel tuo telefono)
  archiveRequest({
    id: VETRINA_ID,
    photoIndex: state.idx + 1,
    photoUrl,
    message: msg
  });

  const first = renzo ? makeWaUrl(renzo.phone, msg) : null;
  const second = sergio ? makeWaUrl(sergio.phone, msg) : null;

  // copia messaggio per sicurezza
  copyToClipboard(msg).catch(()=>{});

  // apri primo
  if(first){
    window.open(first, '_blank');
  }

  // prepara secondo con click “anti blocco”
  if(second){
    state.pendingSecondWaUrl = second;
    openWaModal(
      `Ho aperto WhatsApp per ${renzo ? renzo.name : 'primo contatto'}.\n\nOra tocca “Apri Sergio” per inviare lo stesso messaggio anche al secondo numero.\n\n(Messaggio già copiato negli appunti, se serve incollare.)`
    );
  }
}

function makeWaUrl(phone, message){
  const norm = normalizePhone(phone);
  const to = norm.replace(/^\+/, '');
  return `https://wa.me/${to}?text=${encodeURIComponent(message)}`;
}

function shareVetrinaWhatsApp(){
  const link = absoluteUrl(`vetrina.html?id=${encodeURIComponent(VETRINA_ID)}`);
  const title = state.data && state.data.title ? state.data.title : VETRINA_ID;
  const msg = `Guarda questa vetrina: ${title}\n${link}`;
  const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

function openWaModal(text){
  els.waModalText.textContent = text;
  els.waModal.hidden = false;
}
function closeWaModal(){
  els.waModal.hidden = true;
}

/* ===================== REQUESTS ARCHIVE (SOLO TU) ===================== */
function archiveRequest({id, photoIndex, photoUrl, message}){
  try{
    const now = new Date();
    const entry = {
      atISO: now.toISOString(),
      atLocal: now.toLocaleString(),
      id,
      photoIndex,
      photoUrl,
      message
    };

    const arr = loadLS(LS_REQ_KEY(id), []);
    arr.push(entry);
    saveLS(LS_REQ_KEY(id), arr);
    refreshRequestsBox();
  }catch(e){}
}

function refreshRequestsBox(){
  if(!state.adminEnabled) return;
  const arr = loadLS(LS_REQ_KEY(VETRINA_ID), []);
  els.requestsBox.value = JSON.stringify(arr, null, 2);
}

function exportRequests(){
  if(!state.adminEnabled) return;
  refreshRequestsBox();
  els.requestsBox.focus();
}
async function copyRequests(){
  if(!state.adminEnabled) return;
  refreshRequestsBox();
  await copyToClipboard(els.requestsBox.value || '[]');
  toast('Copiato ✅');
}
function clearRequests(){
  if(!state.adminEnabled) return;
  if(!confirm('Vuoi cancellare TUTTO l’archivio richieste su questo telefono?')) return;
  saveLS(LS_REQ_KEY(VETRINA_ID), []);
  refreshRequestsBox();
}

/* ===================== ADMIN: 5 TAP TITLE ===================== */
function enableFiveTapAdmin(){
  let taps = 0;
  let tmr = null;

  els.pageTitle.addEventListener('click', ()=>{
    taps++;
    clearTimeout(tmr);
    tmr = setTimeout(()=>{ taps = 0; }, 1200);

    if(taps >= 5){
      taps = 0;
      state.adminEnabled = !state.adminEnabled;
      saveLS(LS_ADMIN_KEY, state.adminEnabled ? '1' : '0');
      updateAdminUI();
      toast(state.adminEnabled ? 'Admin ON 🔒' : 'Admin OFF');
    }
  });
}

function updateAdminUI(){
  els.labelCard.hidden = !state.adminEnabled;
  els.adminCard.hidden = !state.adminEnabled;
  els.adminBadge.textContent = state.adminEnabled ? 'ON' : 'OFF';

  if(state.adminEnabled){
    // carica pins locali sempre (per te)
    const lsPins = loadLS(LS_PINS_KEY(VETRINA_ID), null);
    if(lsPins && typeof lsPins === 'object'){
      state.currentPins = lsPins;
    }
    refreshRequestsBox();
  }else{
    state.labelMode = false;
    updateLabelModeUI();
  }

  updateLabelModeUI();
  renderPinsForCurrentImage();
}

/* ===================== PINS (NUMERINI) ===================== */
function updateLabelModeUI(){
  els.labelModeBadge.textContent = state.labelMode ? 'ON' : 'OFF';
  els.pinSizeValue.textContent = String(state.pinSize);
  els.pinSizeRange.value = String(state.pinSize);
}

function currentMediaKey(){
  const item = state.media[state.idx];
  return item ? item.url : '';
}

function addPinForCurrentImage(x, y){
  const key = currentMediaKey();
  if(!key) return;

  if(!state.currentPins[key]) state.currentPins[key] = [];
  const list = state.currentPins[key];

  const n = list.length + 1;
  list.push({ x, y, n, size: state.pinSize });

  saveLS(LS_PINS_KEY(VETRINA_ID), state.currentPins);
  renderPinsForCurrentImage();
}

function undoPin(){
  const key = currentMediaKey();
  if(!key || !state.currentPins[key] || state.currentPins[key].length === 0) return;
  state.currentPins[key].pop();
  saveLS(LS_PINS_KEY(VETRINA_ID), state.currentPins);
  renderPinsForCurrentImage();
}

function clearPinsForCurrentImage(){
  const key = currentMediaKey();
  if(!key) return;
  if(!confirm('Vuoi rimuovere tutti i numerini da QUESTA foto?')) return;
  state.currentPins[key] = [];
  saveLS(LS_PINS_KEY(VETRINA_ID), state.currentPins);
  renderPinsForCurrentImage();
}

function renderPinsForCurrentImage(){
  els.pinsLayer.innerHTML = '';
  const key = currentMediaKey();
  if(!key) return;

  const list = Array.isArray(state.currentPins[key]) ? state.currentPins[key] : [];
  list.forEach(p=>{
    const d = document.createElement('div');
    d.className = 'pin';
    const size = Number(p.size || 28);
    d.style.width = `${size}px`;
    d.style.height = `${size}px`;
    d.style.left = `${(p.x * 100).toFixed(3)}%`;
    d.style.top = `${(p.y * 100).toFixed(3)}%`;
    d.style.fontSize = `${Math.max(10, Math.floor(size * 0.52))}px`;
    d.textContent = String(p.n || '');
    els.pinsLayer.appendChild(d);
  });
}

function exportPinsData(){
  if(!state.adminEnabled) return;
  const snippet = JSON.stringify({ pinsData: state.currentPins }, null, 2);
  els.pinsJsonBox.value = snippet;
}

async function copyPinsData(){
  if(!state.adminEnabled) return;
  const snippet = JSON.stringify({ pinsData: state.currentPins }, null, 2);
  els.pinsJsonBox.value = snippet; // ✅ “copia json” fa anche “incolla” automatico qui
  await copyToClipboard(snippet);
  toast('pinsData copiato ✅ (incollalo nel JSON)');
}

/* ===================== UTIL ===================== */
function scrollToTop(){
  window.scrollTo({top:0, behavior:'smooth'});
}

function absoluteUrl(rel){
  try{
    return new URL(rel, location.href).toString();
  }catch(e){
    return rel;
  }
}

function showError(msg){
  els.errorCard.hidden = false;
  els.errorText.textContent = msg;
}

function escapeHtml(s){
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function deepClone(o){
  return JSON.parse(JSON.stringify(o || {}));
}

function loadLS(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(raw == null) return fallback;
    return JSON.parse(raw);
  }catch(e){
    return fallback;
  }
}
function saveLS(key, val){
  try{
    localStorage.setItem(key, JSON.stringify(val));
  }catch(e){}
}

async function copyToClipboard(text){
  const t = String(text || '');
  if(navigator.clipboard && navigator.clipboard.writeText){
    return navigator.clipboard.writeText(t);
  }
  // fallback
  const ta = document.createElement('textarea');
  ta.value = t;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

function toast(msg){
  const d = document.createElement('div');
  d.textContent = msg;
  d.style.position = 'fixed';
  d.style.left = '50%';
  d.style.transform = 'translateX(-50%)';
  d.style.bottom = '120px';
  d.style.zIndex = '999';
  d.style.padding = '10px 12px';
  d.style.borderRadius = '14px';
  d.style.border = '1px solid rgba(255,255,255,.14)';
  d.style.background = 'rgba(0,0,0,.55)';
  d.style.color = '#fff';
  d.style.fontWeight = '900';
  d.style.boxShadow = '0 14px 30px rgba(0,0,0,.35)';
  document.body.appendChild(d);
  setTimeout(()=> d.remove(), 1200);
}
