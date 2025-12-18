const PINKEY = "sercuctech_pin";

// ===== PIN =====
function initPin(){
  if(!localStorage.getItem(PINKEY)) localStorage.setItem(PINKEY,"1234");
}
function getPin(){ return localStorage.getItem(PINKEY); }
function setPin(newPin){ localStorage.setItem(PINKEY, String(newPin||"")); }

// ===== Speech =====
function speakText(text, opts={}){
  if(!text) return false;
  if(!("speechSynthesis" in windowFS)) return false;
  try{
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = opts.lang || navigator.language || "it-IT";
    u.rate = Number(opts.rate ?? 1);
    u.pitch = Number(opts.pitch ?? 1);
    u.volume = Number(opts.volume ?? 1);
    speechSynthesis.speak(u);
    return true;
  }catch(e){ return false; }
}

// ===== IndexedDB =====
const DB_NAME = "sercuctech_vetrine_db";
const DB_VER  = 1;
const STORE_V = "vetrine";

function idbOpen(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = ()=>{
      const db = req.result;
      if(!db.objectStoreNames.contains(STORE_V)){
        db.createObjectStore(STORE_V, { keyPath: "id" });
      }
    };
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  });
}

async function idbPutVetrina(obj){
  const db = await idbOpen();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(STORE_V, "readwrite");
    tx.objectStore(STORE_V).put(obj);
    tx.oncomplete = ()=>resolve(true);
    tx.onerror = ()=>reject(tx.error);
  });
}

async function idbGetVetrina(id){
  const db = await idbOpen();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(STORE_V, "readonly");
    const req = tx.objectStore(STORE_V).get(id);
    req.onsuccess = ()=>resolve(req.result || null);
    req.onerror = ()=>reject(req.error);
  });
}

async function idbDeleteVetrina(id){
  const db = await idbOpen();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(STORE_V, "readwrite");
    tx.objectStore(STORE_V).delete(id);
    tx.oncomplete = ()=>resolve(true);
    tx.onerror = ()=>reject(tx.error);
  });
}

async function idbListIds(){
  const db = await idbOpen();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(STORE_V, "readonly");
    const req = tx.objectStore(STORE_V).getAllKeys();
    req.onsuccess = ()=>resolve(req.result || []);
    req.onerror = ()=>reject(req.error);
  });
}

// ===== Export helpers =====
function blobToDataURL(blob){
  return new Promise((res, rej)=>{
    const r = new FileReader();
    r.onload = ()=>res(r.result);
    r.onerror = ()=>rej(r.error);
    r.readAsDataURL(blob);
  });
}

async function downloadJson(filename, obj){
  const blob = new Blob([JSON.stringify(obj,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function escapeHtml(s){
  return String(s||"")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;");
  }
