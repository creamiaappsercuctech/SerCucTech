const LANG = {
 it:{
  admin:"Accesso amministratore",
  upload:"Carica file",
  save:"Salva vetrina",
  delete:"Cancella",
  open:"Apri vetrina"
 },
 uk:{
  admin:"Вхід адміністратора",
  upload:"Завантажити файл",
  save:"Зберегти вітрину",
  delete:"Видалити",
  open:"Відкрити вітрину"
 },
 en:{
  admin:"Admin access",
  upload:"Upload file",
  save:"Save showcase",
  delete:"Delete",
  open:"Open showcase"
 },
 ja:{
  admin:"管理者ログイン",
  upload:"ファイルをアップロード",
  save:"ショーケースを保存",
  delete:"削除",
  open:"ショーケースを開く"
 }
};

function getLang(){
 return localStorage.lang || navigator.language.slice(0,2) || "en";
}

function t(k){
 const l=getLang();
 return LANG[l]?.[k] || LANG.en[k];
}
