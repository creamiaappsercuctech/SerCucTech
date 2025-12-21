(function(){
"use strict";

/* =========================================================
   UTIL
========================================================= */
const qs  = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));
const params = new URLSearchParams(location.search);
const id = (params.get("id") || "renzo11").trim();

/* =========================================================
   ELEMENTI
========================================================= */
const pageTitle = qs("#pageTitle");
const pageDesc  = qs("#pageDesc");
const badgeId   = qs("#badgeId");

const voicePanel   = qs("#voicePanel");
const voiceTextEl  = qs("#voiceText");
const contactsRow  = qs("#contactsRow");

const heroImg   = qs("#heroImg");
const imgCounter= qs("#imgCounter");
const imgBadge  = qs("#imgBadge");
const thumbRow  = qs("#thumbRow");
const imgWrap   = qs("#imgWrap");
const pinsLayer = qs("#pinsLayer");

const prevBtn = qs("#prevBtn");
const nextBtn = qs("#nextBtn");

const filesCard = qs("#filesCard");
const filesList = qs("#filesList");

const shareBtn = qs("#shareBtn");

const homeBtn  = qs("#homeBtn");
const voiceBtn = qs("#voiceBtn");
const stopBtn  = qs("#stopBtn");
const fullBtn  = qs("#fullBtn");
const themeBtn = qs("#themeBtn");
const kioskBtn = qs("#kioskBtn");

const audioGate = qs("#audioGate");
const enableAudioBtn = qs("#enableAudioBtn");
const skipAudioBtn   = qs("#skipAudioBtn");

/* LABEL TOOL */
const labelCard       = qs("#labelCard");
const labelModeBadge  = qs("#labelModeBadge");
const labelToggleBtn  = qs("#labelToggleBtn");
const labelUndoBtn    = qs("#labelUndoBtn");
const labelClearBtn   = qs("#labelClearBtn");
const pinSizeRange    = qs("#pinSizeRange");
const pinSizeValue    = qs("#pinSizeValue");
const pinsJsonBox     = qs("#pinsJsonBox");
const exportPinsBtn   = qs("#exportPinsBtn");
const copyPinsBtn     = qs("#copyPinsBtn");

/* =========================================================
   STATO
========================================================= */
let data = null;
let media = [];
let current = 0;

/* =========================================================
   THEME
========================================================= */
const THEME_KEY = "sercuctech_theme";
function applyTheme(){
  const t = localStorage.getItem(THEME_KEY) || "dark";
  document.documentElement.setAttribute("data-theme", t);
}
function toggleTheme(){
  const cur = document.documentElement.getAttribute("data-theme") || "dark";
  localStorage.setItem(THEME_KEY, cur === "dark" ? "light" : "dark");
  applyTheme();
}
applyTheme();

/* =========================================================
   FULLSCREEN IMMAGINE
========================================================= */
let overlayEl = null;
function openImageFullscreen(src, alt){
  if(overlayEl) return;
  overlayEl = document.createElement("div");
  overlayEl.className = "fullOverlay";
  overlayEl.innerHTML = `<img src="${src}" alt="${alt||""}">`;
  overlayEl.onclick = closeImageFullscreen;
  document.body.appendChild(overlayEl);
}
function closeImageFullscreen(){
  if(!overlayEl) return;
  overlayEl.remove();
  overlayEl = null;
}
heroImg.addEventListener("click", ()=>{
  if(media[current]) openImageFullscreen(media[current].url, media[current].label);
});

/* =========================================================
   NAV
========================================================= */
prevBtn.onclick = ()=>{ current=(current-1+media.length)%media.length; renderHero(); };
nextBtn.onclick = ()=>{ current=(current+1)%media.length; renderHero(); };

/* =========================================================
   SHARE
========================================================= */
shareBtn.onclick = ()=>{
  const link = `${location.origin}${location.pathname.replace("index.html","")}vetrina.html?id=${id}`;
  const text = `${data?.title||id}\n${link}`;
  if(navigator.share){
    navigator.share({title:data?.title||id,text,url:link}).catch(()=>{});
  }else{
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,"_blank");
  }
};

/* =========================================================
   VOICE
========================================================= */
const VOICE_KEY="sercuctech_audio_enabled";
const stopSpeech=()=>{try{speechSynthesis.cancel();}catch(e){}};
function speak(txt,lang){
  stopSpeech();
  const u=new SpeechSynthesisUtterance(txt.replace(/\b\d{7,}\b/g,m=>m.split("").join(" ")));
  u.lang=lang||"it-IT";u.rate=1.03;
  speechSynthesis.speak(u);
}
function buildSpeech(){
  return [data?.description,data?.voice?.text].filter(Boolean).join(". ");
}
voiceBtn.onclick=()=>{
  if(localStorage.getItem(VOICE_KEY)!=="1"){audioGate.hidden=false;return;}
  speak(buildSpeech(),data?.voice?.lang);
};
enableAudioBtn.onclick=()=>{
  localStorage.setItem(VOICE_KEY,"1");
  audioGate.hidden=true;
  speak(buildSpeech(),data?.voice?.lang);
};
skipAudioBtn.onclick=()=>audioGate.hidden=true;
stopBtn.onclick=stopSpeech;

/* =========================================================
   CONTATTI
========================================================= */
function renderContacts(){
  const txt = buildSpeech();
  const nums = [...new Set((txt.match(/\b\d{7,}\b/g)||[]))];
  contactsRow.innerHTML="";
  nums.forEach((n,i)=>{
    const wa=`https://wa.me/39${n}`;
    const tel=`tel:${n}`;
    contactsRow.innerHTML+=`
      <div class="contactChip">
        <div>
          <div class="contactName">Contatto</div>
          <div class="contactNum">${n}</div>
        </div>
        <div>
          <a class="cBtn wa" href="${wa}" target="_blank">WhatsApp</a>
          <a class="cBtn tel" href="${tel}">Chiama</a>
        </div>
      </div>`;
  });
}

/* =========================================================
   PINS (PUBBLICI + PRIVATI)
========================================================= */
const LOCAL_PINS_KEY = img=>`pins_local_${id}_${img}`;
const LOCAL_SIZE_KEY = `pins_size_${id}`;
let pinSize = Number(localStorage.getItem(LOCAL_SIZE_KEY)||28);

function getPublicPins(img){ return data?.pinsData?.byImage?.[img]||[]; }
function getLocalPins(img){
  try{return JSON.parse(localStorage.getItem(LOCAL_PINS_KEY(img)))||[];}
  catch(e){return[];}
}
function saveLocalPins(img,p){localStorage.setItem(LOCAL_PINS_KEY(img),JSON.stringify(p));}

function renderPins(){
  pinsLayer.innerHTML="";
  const img=media[current]?.url;
  if(!img) return;
  [...getPublicPins(img),...getLocalPins(img)].forEach(p=>{
    const d=document.createElement("div");
    d.className="pin";
    d.textContent=p.n;
    d.style.left=p.xPct+"%";
    d.style.top=p.yPct+"%";
    d.style.width=d.style.height=pinSize+"px";
    d.style.fontSize=Math.round(pinSize*0.5)+"px";
    pinsLayer.appendChild(d);
  });
}

/* =========================================================
   LABEL UI (SOLO TU)
========================================================= */
let labelUnlocked=false,labelMode=false;
pageTitle.onclick=(()=>{
  let c=0,t;
  return()=>{
    c++;clearTimeout(t);
    t=setTimeout(()=>c=0,900);
    if(c>=5){
      labelUnlocked=!labelUnlocked;
      labelCard.hidden=!labelUnlocked;
      labelMode=labelUnlocked;
      labelModeBadge.textContent=labelMode?"ON":"OFF";
    }
  };
})();

imgWrap.onclick=e=>{
  if(!labelUnlocked||!labelMode) return;
  const r=imgWrap.getBoundingClientRect();
  const x=((e.clientX-r.left)/r.width)*100;
  const y=((e.clientY-r.top)/r.height)*100;
  const img=media[current].url;
  const loc=getLocalPins(img);
  const maxN=Math.max(0,...getPublicPins(img).map(p=>p.n),...loc.map(p=>p.n));
  loc.push({n:maxN+1,xPct:+x.toFixed(2),yPct:+y.toFixed(2)});
  saveLocalPins(img,loc);
  renderPins();
};

pinSizeRange.oninput=()=>{
  pinSize=+pinSizeRange.value;
  localStorage.setItem(LOCAL_SIZE_KEY,pinSize);
  pinSizeValue.textContent=pinSize;
  renderPins();
};

labelUndoBtn.onclick=()=>{
  const img=media[current]?.url;
  const loc=getLocalPins(img);
  loc.pop();saveLocalPins(img,loc);renderPins();
};
labelClearBtn.onclick=()=>{
  if(confirm("Cancello SOLO i tuoi numeri locali")){
    saveLocalPins(media[current].url,[]);
    renderPins();
  }
};

/* =========================================================
   EXPORT + AUTOMAZIONE
========================================================= */
function exportPinsData(){
  const byImage={};
  media.forEach(m=>{
    const pins=[...getPublicPins(m.url),...getLocalPins(m.url)];
    if(pins.length) byImage[m.url]=pins;
  });
  return { pinSize, byImage };
}

copyPinsBtn.onclick=async()=>{
  const pinsData=exportPinsData();
  const full={...data,pinsData,updatedAt:new Date().toISOString()};

  // copia pinsData
  try{await navigator.clipboard.writeText(JSON.stringify(pinsData,null,2));}catch(e){}

  // download JSON completo
  const blob=new Blob([JSON.stringify(full,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`${id}.json`;
  a.click();

  // apri GitHub sul file giusto
  window.open(`https://github.com/creamiaappsercuctech/SerCucTech/blob/main/data/${id}.json`,"_blank");

  alert("✅ File JSON pronto.\n1) incolla su GitHub\n2) Commit\nFatto.");
};

/* =========================================================
   RENDER
========================================================= */
function renderHero(){
  if(!media.length) return;
  const m=media[current];
  heroImg.src=m.url;
  imgBadge.textContent=String(current+1).padStart(2,"0");
  imgCounter.textContent=`${current+1}/${media.length}`;
  renderPins();
}
function renderThumbs(){
  thumbRow.innerHTML="";
  media.forEach((m,i)=>{
    const b=document.createElement("button");
    b.className="thumb"+(i===current?" active":"");
    b.innerHTML=`<img src="${m.url}">`;
    b.onclick=()=>{current=i;renderHero();};
    thumbRow.appendChild(b);
  });
}

/* =========================================================
   LOAD
========================================================= */
async function load(){
  badgeId.textContent=`id: ${id}`;
  const res=await fetch(`data/${id}.json`,{cache:"no-store"});
  data=res.ok?await res.json():{};
  pageTitle.textContent=data.title||id;
  pageDesc.textContent=data.description||"";
  voicePanel.hidden=false;
  voiceTextEl.textContent=buildSpeech();
  renderContacts();

  media=(data.media||[]).slice().sort((a,b)=>a.url.localeCompare(b.url,"it",{numeric:true}));
  current=media.length-1;
  renderThumbs();
  renderHero();
}
load();

})();
