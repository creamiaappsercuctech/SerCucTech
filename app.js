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
  return new Promise(res=>{
    const r=new FileReader();
    r.onload=()=>res(r.result);
    r.readAsDataURL(file);
  });
}
