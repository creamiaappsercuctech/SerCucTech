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
  const elIdSpan = $("idSpan");

  const previewBtn = $("previewBtn");
  const zipBtn     = $("zipBtn");
  const jsonBtn    = $("jsonBtn");
  const doAllBtn   = $("doAllBtn");

  const copyBtn      = $("copyBtn");
  const clearBtn     = $("clearBtn");
  const openGithubBtn= $("openGithubBtn");

  const publicLinkInput = $("publicLink");
  const publicLinkTop   = $("publicLinkTop");
  const copyLinkBtn     = $("copyLinkBtn");
  const shareBtn        = $("shareBtn");
  const whatsBtn        = $("whatsBtn");

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
    const folder = cfg.folder.replace(/^\/+|\/+$/g,"");
    return folder ? `${folder}/${newName}` : newName;
  }

  function highlight(el){
    el.classList.add("highlight");
    setTimeout(()=>el.classList.remove("highlight"), 1200);
    el.scrollIntoView({behavior:"smooth", block:"center"});
  }

  function getPublicVetrinaLink(prefix){
    const base = location.origin + location.pathname.replace(/\/[^\/]*$/, "/");
    return base + `vetrina.html?id=${encodeURIComponent(prefix)}`;
  }

  function setPublicLinkUI(prefix){
    const link = prefix ? getPublicVetrinaLink(prefix) : "";
    publicLinkInput.value = link;
    if(publicLinkTop) publicLinkTop.href = link || "vetrina.html";
  }

  function renderPreview(){
    const cfg = getCfg();

    elWhere.textContent = `data/${cfg.prefix || "ID"}.json`;
    elIdSpan.textContent = (cfg.prefix || "ID");

    setPublicLinkUI(cfg.prefix);

    elList.innerHTML = "";
    if(!cfg.prefix){
      elList.innerHTML = `<li>❗ Inserisci un ID/prefisso (es: renzo11)</li>`;
      return false;
    }
    if(selectedFiles.length === 0){
      elList.innerHTML = `<li>📌 Seleziona prima i file.</li>`;
      return false;
    }

    selectedFiles.forEach((f,i)=>{
      const newName = buildNewName(f,i,cfg);
      const li = document.createElement("li");
      li.textContent = `${f.name}  →  ${newName}`;
      elList.appendChild(li);
    });
    return true;
  }

  async function downloadZip(){
    const cfg = getCfg();
    if(!cfg.prefix){ alert("Inserisci un ID/prefisso (es: renzo11)"); return false; }
    if(selectedFiles.length === 0){ alert("Seleziona prima i file"); return false; }

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
    return true;
  }

  function generateMediaJson(){
    const cfg = getCfg();
    if(!cfg.prefix){ alert("Inserisci un ID/prefisso (es: renzo11)"); return false; }
    if(selectedFiles.length === 0){ alert("Seleziona prima i file"); return false; }

    const arr = selectedFiles.map((f,i)=>{
      const newName = buildNewName(f,i,cfg);
      const url = buildPath(newName, cfg);

      const isImg = (f.type || "").startsWith("image/");
      const isVid = (f.type || "").startsWith("video/");
      const type  = isImg ? "image" : (isVid ? "video" : "file");

      return { type, url, name: newName };
    });

    elOut.value = JSON.stringify(arr, null, 2);
    return true;
  }

  async function copyToClipboard(text){
    try{
      await navigator.clipboard.writeText(text);
      return true;
    }catch(e){
      // fallback vecchio
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

  async function copyJson(){
    if(!elOut.value.trim()){
      alert("Prima genera il JSON.");
      return false;
    }
    const ok = await copyToClipboard(elOut.value);
    if(!ok){
      alert("Non riesco a copiare automaticamente. Seleziona e copia manualmente.");
      highlight(elOut);
      return false;
    }
    return true;
  }

  function openGithubDataFile(){
    const cfg = getCfg();
    if(!cfg.prefix){ alert("Inserisci un ID/prefisso (es: renzo11)"); return; }

    // Link “edit” su GitHub (utente → cambia OWNER/REPO)
    // Se il repo è quello giusto e la pagina è su GitHub Pages, spesso il path è /SerCucTech/
    // Qui non posso sapere il branch al 100%: uso "main" (se il tuo è diverso, cambia qui).
    const owner = "creamiaappsercuctech";
    const repo  = "SerCucTech";
    const branch= "main";
    const path  = `data/${cfg.prefix}.json`;
    const url = `https://github.com/${owner}/${repo}/edit/${branch}/${path}`;
    window.open(url, "_blank", "noopener");
  }

  async function copyPublicLink(){
    const cfg = getCfg();
    if(!cfg.prefix){ alert("Inserisci un ID/prefisso (es: renzo11)"); return false; }
    const link = getPublicVetrinaLink(cfg.prefix);
    const ok = await copyToClipboard(link);
    if(!ok){
      alert("Non riesco a copiare automaticamente. Copia manualmente il link evidenziato.");
      highlight(publicLinkInput);
      return false;
    }
    return true;
  }

  async function sharePublicLink(){
    const cfg = getCfg();
    if(!cfg.prefix){ alert("Inserisci un ID/prefisso (es: renzo11)"); return; }
    const link = getPublicVetrinaLink(cfg.prefix);
    const text = `Vetrina pubblica: ${cfg.prefix}\n${link}`;
    try{
      if(navigator.share){
        await navigator.share({ title:"SerCucTech Vetrina", text, url: link });
      }else{
        await copyToClipboard(text);
        alert("Condivisione non supportata: ho copiato testo+link negli appunti.");
      }
    }catch(e){}
  }

  function openWhatsApp(){
    const cfg = getCfg();
    if(!cfg.prefix){ alert("Inserisci un ID/prefisso (es: renzo11)"); return; }
    const link = getPublicVetrinaLink(cfg.prefix);
    const msg = `Vetrina pubblica: ${cfg.prefix}\n${link}`;
    const wa = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(wa, "_blank", "noopener");
  }

  async function doAll(){
    const okPreview = renderPreview();
    if(!okPreview) return;

    // 1) ZIP (come punto 4)
    const okZip = await downloadZip();
    if(!okZip) return;

    // 2) JSON (punto 5)
    const okJson = generateMediaJson();
    if(!okJson) return;

    // 3) Copia JSON (punto 6 “assistito”)
    const okCopy = await copyJson();
    highlight(elOut);

    // 4) Link pubblico + evidenzia + copia
    const okLink = await copyPublicLink();
    highlight(publicLinkInput);

    // 5) Messaggio finale
    let msg = "✅ Fatto!\n\n";
    msg += "- ZIP scaricato\n";
    msg += "- JSON media generato";
    msg += okCopy ? " + copiato\n" : "\n";
    msg += okLink ? "- Link pubblico copiato\n" : "- Link pubblico pronto\n";
    msg += "\nOra apri GitHub e incolla il JSON in data/" + getCfg().prefix + ".json";
    alert(msg);
  }

  function init(){
    // auto prefix da ?id=
    const id = getParam("id");
    if(id) elPrefix.value = id;

    setPublicLinkUI(elPrefix.value);

    elFiles.addEventListener("change", (e)=>{
      selectedFiles = Array.from(e.target.files || []);
      elOut.value = "";
      renderPreview();
    });

    previewBtn.addEventListener("click", renderPreview);
    zipBtn.addEventListener("click", async ()=>{ renderPreview(); await downloadZip(); });
    jsonBtn.addEventListener("click", ()=>{ renderPreview(); generateMediaJson(); highlight(elOut); });

    doAllBtn.addEventListener("click", doAll);

    copyBtn.addEventListener("click", async ()=>{
      const ok = await copyJson();
      if(ok) alert("JSON copiato ✅");
      highlight(elOut);
    });

    clearBtn.addEventListener("click", ()=>{
      elOut.value = "";
      elList.innerHTML = "";
      elFiles.value = "";
      selectedFiles = [];
      publicLinkInput.value = "";
    });

    openGithubBtn.addEventListener("click", openGithubDataFile);

    copyLinkBtn.addEventListener("click", async ()=>{
      const ok = await copyPublicLink();
      if(ok) alert("Link copiato ✅");
      highlight(publicLinkInput);
    });

    shareBtn.addEventListener("click", sharePublicLink);
    whatsBtn.addEventListener("click", openWhatsApp);

    // aggiornamento live se cambi prefix
    elPrefix.addEventListener("input", ()=>{ renderPreview(); });
    renderPreview();
  }

  init();
})();
