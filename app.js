const KEY = "sercuctech_vetrine";
const PINKEY = "sercuctech_pin";

function initPin(){
  if(!localStorage.getItem(PINKEY))
    localStorage.setItem(PINKEY,"1234");
}
function getPin(){ return localStorage.getItem(PINKEY); }

function loadAll(){
  return JSON.parse(localStorage.getItem(KEY)||"{}");
}
function saveAll(o){
  localStorage.setItem(KEY,JSON.stringify(o));
}

function toBase64(file){
  return new Promise((res, rej)=>{
    const r=new FileReader();
    r.onload=()=>res(r.result);
    r.onerror=rej;
    r.readAsDataURL(file);
  });
}

// Speech (voce)
function speakText(text, opts={}){
  if(!text) return false;
  if(!("speechSynthesis" in window)) return false;

  try{
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
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
