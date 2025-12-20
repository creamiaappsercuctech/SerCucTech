(function(){
  const $ = (id)=>document.getElementById(id);

  const elFiles  = $("files");
  const elPrefix = $("prefix");
  const elFolder = $("folder");
  const elStart  = $("start");
  const elPad    = $("pad");
  const elSep    = $("sep");
  const elList   = $("list");
  const elOut    = $("jsonOut");
  const elWhere  = $("where");

  const previewBtn = $("previewBtn");
  const zipBtn     = $("zipBtn");
  const jsonBtn    = $("jsonBtn");
  const copyBtn    = $("copyBtn");
  const clearBtn   = $("clearBtn");

  let selectedFiles = [];

  function getParam(name){
    const url = new URL(location.href);
    return url.searchParams.get(name);
  }

  function safeText(s){ return String(s||"").trim(); }

  function getCfg(){
    const prefix = safeText(elPrefix.value);
    const folder = safeText(elFolder.value) || "media";
    const start  = Math.max(0, parseInt(elStart.value || "1", 10));
    const pad    = Math.max(0, parseInt(elPad.value || "2", 10));
    const sep    = (elSep.value ?? "-");
    return { prefix, folder, start, pad, sep };
  }

  function buildNewName(file, i, cfg){
    const ext = (file.name.includes(".") ? file.name.split(".").pop() : "").toLowerCase();
    const num = String(cfg.start + i).padStart(cfg.pad, "0");
    const base = `${cfg.prefix}${cfg.sep}${num}`;
    return ext ? `${base}.${ext}` : base;
  }

  function buildPath(newName, cfg){
    const folder = cfg.folder.replace(/^\/+|\/+$/g,""); // no / start/end
    return folder ? `${folder}/${newName}` : newName;
  }

  function renderPreview(){
    const cfg = getCfg();
    elWhere.textContent = `data/${cfg.prefix || "ID"}.json`;
    elList.innerHTML = "";

    if(!cfg.prefix){
      elList.innerHTML = `<li>❗ Inserisci un ID/prefisso (es: renzo11)</li>`;
      return;
    }
    if(selectedFiles.length === 0){
      elList.innerHTML = `<li>📌 Seleziona prima i file.</li>`;
      return;
    }

    selectedFiles.forEach((f,i)=>{
      const newName = buildNewName(f,i,cfg);
      const li = document.createElement("li");
      li.textContent = `${f.name}  →  ${newName}`;
      elList.appendChild(li);
    });
  }

  async function downloadZip(){
    const cfg = getCfg();
    if(!cfg.prefix){ alert("Inserisci un ID/prefisso (es: renzo11)"); return; }
    if(selectedFiles.length === 0){ alert("Seleziona prima i file"); return; }

    const zip = new JSZip();
    for(let i=0; i<selectedFiles.length; i++){
      const f = selectedFiles[i];
      const newName = buildNewName(f,i,cfg);
      zip.file(newName, f);
    }

    const blob = await zip.generateAsync({type:"blob"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${cfg.prefix}_rinominati.zip`;
    a.click();
  }

  function generateMediaJson(){
    const cfg = getCfg();
    if(!cfg.prefix){ alert("Inserisci un ID/prefisso (es: renzo11)"); return; }
    if(selectedFiles.length === 0){ alert("Seleziona prima i file"); return; }

    // media: lista di oggetti {type,url,name}
    const arr = selectedFiles.map((f,i)=>{
      const newName = buildNewName(f,i,cfg);
      const url = buildPath(newName, cfg);

      const isImg = f.type.startsWith("image/");
      const isVid = f.type.startsWith("video/");
      const type  = isImg ? "image" : (isVid ? "video" : "file");

      return {
        type,
        url,
        name: newName
      };
    });

    elOut.value = JSON.stringify(arr, null, 2);
  }

  function copyJson(){
    if(!elOut.value.trim()){
      alert("Prima genera il JSON.");
      return;
    }
    elOut.select();
    document.execCommand("copy");
    alert("JSON copiato ✅");
  }

  function init(){
    // auto prefix da ?id=
    const id = getParam("id");
    if(id) elPrefix.value = id;

    elWhere.textContent = `data/${elPrefix.value || "ID"}.json`;

    elFiles.addEventListener("change", (e)=>{
      selectedFiles = Array.from(e.target.files || []);
      elOut.value = "";
      renderPreview();
    });

    previewBtn.addEventListener("click", renderPreview);
    zipBtn.addEventListener("click", downloadZip);
    jsonBtn.addEventListener("click", generateMediaJson);
    copyBtn.addEventListener("click", copyJson);
    clearBtn.addEventListener("click", ()=>{
      elOut.value = "";
      elList.innerHTML = "";
      elFiles.value = "";
      selectedFiles = [];
    });

    // preview iniziale
    renderPreview();
  }

  init();
})();
