/* app.js — UNIVERSALE SerCucTech
   - carica vetrina da data/vetrine.json
   - trova automaticamente le immagini (anche se partono da 010)
   - gallery, swipe, thumbs
   - WhatsApp per foto corrente con modale chiudibile al TAP
   - overlay audio non blocca i tasti
*/

(() => {
  "use strict";

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function getParam(name, def = "") {
    const u = new URL(location.href);
    return u.searchParams.get(name) ?? def;
  }

  function pad3(n) {
    return String(n).padStart(3, "0");
  }

  function safeText(el, text) {
    if (!el) return;
    el.textContent = text ?? "";
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function normalizePhone(phoneRaw) {
    if (!phoneRaw) return "";
    // Mantieni + e numeri
    return String(phoneRaw).trim().replace(/[^\d+]/g, "");
  }

  function waLink(phone, message) {
    const p = normalizePhone(phone).replace(/^\+/, "");
    const txt = encodeURIComponent(message || "");
    // wa.me funziona bene su mobile
    return `https://wa.me/${p}?text=${txt}`;
  }

  function telLink(phone) {
    return `tel:${normalizePhone(phone)}`;
  }

  async function fetchJSON(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} su ${url}`);
    return await res.json();
  }

  // Prova se un'immagine esiste davvero (carica solo header via <img>)
  function probeImage(url, timeoutMs = 6000) {
    return new Promise((resolve) => {
      const img = new Image();
      let done = false;
      const t = setTimeout(() => {
        if (done) return;
        done = true;
        try { img.src = ""; } catch {}
        resolve(false);
      }, timeoutMs);

      img.onload = () => {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve(true);
      };
      img.onerror = () => {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve(false);
      };
      img.src = url + (url.includes("?") ? "&" : "?") + "cb=" + Date.now();
    });
  }

  // ---------- DOM refs ----------
  const pageTitle = $("pageTitle");
  const pageDesc = $("pageDesc");
  const badgeId = $("badgeId");

  const heroImg = $("heroImg");
  const imgCounter = $("imgCounter");
  const imgBadge = $("imgBadge");
  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");
  const thumbRow = $("thumbRow");
  const imgWrap = $("imgWrap");

  const voicePanel = $("voicePanel");
  const voicePanelInner = $("voicePanelInner");
  const voiceText = $("voiceText");
  const contactsRow = $("contactsRow");

  const indexPanel = $("indexPanel");
  const indexList = $("indexList");
  const refreshIndexBtn = $("refreshIndexBtn");

  const waInfoBtn = $("waInfoBtn");
  const shareBtn = $("shareBtn");

  const waModal = $("waModal");
  const waModalText = $("waModalText");
  const waModalBtns = $("waModalBtns");
  const waCloseBtn = $("waCloseBtn");

  const homeBtn = $("homeBtn");
  const voiceBtn = $("voiceBtn");
  const stopBtn = $("stopBtn");
  const fullBtn = $("fullBtn");
  const themeBtn = $("themeBtn");
  const kioskBtn = $("kioskBtn");
  const bottombar = $("bottombar");

  // ---------- State ----------
  const vetrinaId = (getParam("id", "") || "").trim();
  const DATA_URL = "data/vetrine.json";

  let vetrine = [];
  let v = null;

  // images list: array di oggetti {url, label, idxNumber}
  let images = [];
  let current = 0; // index su images[]
  let isFs = false;
  let muted = false;

  // ---------- Audio (TTS) ----------
  function speak(text) {
    try {
      if (!text) return;
      if (muted) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "it-IT";
      window.speechSynthesis.speak(u);
    } catch {}
  }

  function stopSpeak() {
    try { window.speechSynthesis.cancel(); } catch {}
  }

  // Overlay audio gate (non blocca i tasti)
  function showAudioGateOnce() {
    // se già sbloccato, non mostrare
    const KEY = "sercuc_audio_ok";
    if (localStorage.getItem(KEY) === "1") return;

    // crea overlay non bloccante, ma con bottoni cliccabili
    const gate = document.createElement("div");
    gate.className = "audioGate";
    gate.innerHTML = `
      <div class="audioGateCard">
        <div class="audioGateTitle">Audio bloccato dal telefono</div>
        <div class="audioGateText">Tocca “Attiva audio”. Poi l’audio funzionerà normalmente.</div>
        <div class="audioGateBtns">
          <button class="primary" type="button" id="ag_ok">Attiva audio</button>
          <button class="ghost" type="button" id="ag_no">Non ora</button>
        </div>
      </div>
    `;
    document.body.appendChild(gate);

    const ok = gate.querySelector("#ag_ok");
    const no = gate.querySelector("#ag_no");

    const close = () => {
      gate.remove();
    };

    ok.addEventListener("click", () => {
      // “sblocca” audio facendo parlare una sillaba (molti telefoni richiedono gesto)
      localStorage.setItem(KEY, "1");
      try {
        const u = new SpeechSynthesisUtterance(" ");
        u.lang = "it-IT";
        window.speechSynthesis.speak(u);
      } catch {}
      close();
    }, { passive: true });

    no.addEventListener("click", () => close(), { passive: true });

    // IMPORTANTISSIMO: non bloccare resto pagina
    // (la CSS già fa pointer-events:none sull’overlay e pointer-events:auto sulla card)
  }

  // ---------- WhatsApp Modal ----------
  function openWaModal(msg, contacts = []) {
    if (!waModal || !waModalText || !waModalBtns) return;
    waModal.hidden = false;
    waModalText.textContent = msg || "";

    waModalBtns.innerHTML = "";
    contacts.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "primary";
      b.textContent = `Apri WhatsApp: ${c.name}`;
      b.addEventListener("click", () => {
        location.href = waLink(c.phone, msg);
      }, { passive: true });
      waModalBtns.appendChild(b);
    });

    // chiudi al TAP (non tenere premuto)
    if (waCloseBtn) {
      waCloseBtn.onclick = () => {
        waModal.hidden = true;
      };
    }
    // chiudi tappando fuori
    waModal.addEventListener("click", (e) => {
      if (e.target === waModal) waModal.hidden = true;
    }, { passive: true });
  }

  // ---------- Image system (UNIVERSALE) ----------
  function makeImgUrl(id, num) {
    return `media/${id}-${pad3(num)}.jpg`;
  }

  // Caso 1: vetrina ha images[] con url già pronti
  function imagesFromJson(vetrinaObj) {
    const arr = vetrinaObj?.images;
    if (!Array.isArray(arr) || arr.length === 0) return null;

    const out = [];
    for (const it of arr) {
      if (!it) continue;
      const url = it.url || it.src || it.path;
      if (!url) continue;
      // prova a estrarre numero tipo -010
      let idxNumber = null;
      const m = String(url).match(/-(\d{3})\.(jpg|jpeg|png|webp)/i);
      if (m) idxNumber = parseInt(m[1], 10);
      out.push({
        url: url,
        label: it.label || "",
        idxNumber
      });
    }
    return out.length ? out : null;
  }

  // Caso 2: scan immagini (trova start/end reali anche se partono da 010)
  async function scanImagesByProbing(id) {
    // strategia:
    // 1) prova alcuni "start comuni": 1, 10, 100
    // 2) se trovato un match, espandi avanti finché non trovi N errori consecutivi
    // 3) includi solo quelle che esistono
    const startsToTry = [1, 10, 100];
    let foundStart = null;

    for (const s of startsToTry) {
      const url = makeImgUrl(id, s);
      // eslint-disable-next-line no-await-in-loop
      const ok = await probeImage(url);
      if (ok) { foundStart = s; break; }
    }

    // se non trovato, prova a cercare tra 1..200 step 1
    if (foundStart == null) {
      for (let n = 1; n <= 200; n++) {
        // eslint-disable-next-line no-await-in-loop
        const ok = await probeImage(makeImgUrl(id, n));
        if (ok) { foundStart = n; break; }
      }
    }

    if (foundStart == null) return [];

    const out = [];
    let n = foundStart;
    let misses = 0;

    while (n <= 999) {
      const url = makeImgUrl(id, n);
      // eslint-disable-next-line no-await-in-loop
      const ok = await probeImage(url);
      if (ok) {
        out.push({ url, label: "", idxNumber: n });
        misses = 0;
      } else {
        misses++;
        // se trovi troppi buchi di fila, fermati
        if (misses >= 8) break;
      }
      n++;
    }

    return out;
  }

  // ---------- Gallery render ----------
  function setCurrent(i) {
    if (!images.length) return;
    current = clamp(i, 0, images.length - 1);
    renderCurrent();
    renderThumbs();
  }

  function renderCurrent() {
    if (!heroImg || !images.length) return;

    const it = images[current];
    heroImg.src = it.url + (it.url.includes("?") ? "&" : "?") + "v=" + Date.now();

    if (imgCounter) {
      const a = String(current + 1).padStart(2, "0");
      const b = String(images.length).padStart(2, "0");
      imgCounter.textContent = `${a}/${b}`;
    }
    if (imgBadge) {
      imgBadge.textContent = String(current + 1).padStart(2, "0");
    }
  }

  function renderThumbs() {
    if (!thumbRow) return;
    thumbRow.innerHTML = "";
    images.forEach((it, idx) => {
      const d = document.createElement("div");
      d.className = "thumb" + (idx === current ? " active" : "");
      d.innerHTML = `<img alt="thumb" loading="lazy">`;
      const im = d.querySelector("img");
      im.src = it.url;
      d.addEventListener("click", () => setCurrent(idx), { passive: true });
      thumbRow.appendChild(d);
    });
  }

  function bindNav() {
    if (prevBtn) prevBtn.addEventListener("click", () => setCurrent(current - 1), { passive: true });
    if (nextBtn) nextBtn.addEventListener("click", () => setCurrent(current + 1), { passive: true });

    // Swipe su imgWrap (touch)
    if (imgWrap) {
      let x0 = null;
      imgWrap.addEventListener("touchstart", (e) => {
        x0 = e.touches?.[0]?.clientX ?? null;
      }, { passive: true });

      imgWrap.addEventListener("touchend", (e) => {
        if (x0 == null) return;
        const x1 = e.changedTouches?.[0]?.clientX ?? x0;
        const dx = x1 - x0;
        x0 = null;
        if (Math.abs(dx) < 35) return;
        if (dx < 0) setCurrent(current + 1);
        else setCurrent(current - 1);
      }, { passive: true });

      // Tap per fullscreen
      imgWrap.addEventListener("click", () => toggleFullscreen(), { passive: true });
    }
  }

  function toggleFullscreen() {
    isFs = !isFs;
    document.body.classList.toggle("fullscreenMode", isFs);
  }

  // ---------- Voice panel / Contacts ----------
  function renderVoiceAndContacts(vetrinaObj) {
    if (!voicePanel || !voiceText || !contactsRow) return;

    const txt = vetrinaObj.voiceText || vetrinaObj.description || "";
    const contacts = Array.isArray(vetrinaObj.contacts) ? vetrinaObj.contacts : [];

    if (!txt && !contacts.length) {
      voicePanel.hidden = true;
      return;
    }
    voicePanel.hidden = false;
    voiceText.textContent = txt || "—";

    contactsRow.innerHTML = "";
    contacts.forEach((c) => {
      const phone = normalizePhone(c.phone);
      if (!phone) return;

      const wa = document.createElement("a");
      wa.className = "contactChip";
      wa.href = waLink(phone, `Ciao! Info vetrina ${vetrinaId}. Foto ${current + 1}/${images.length}.`);
      wa.innerHTML = `💬 <b>${c.name || "WhatsApp"}</b> <span>${phone}</span>`;
      wa.target = "_blank";
      wa.rel = "noopener";

      const tel = document.createElement("a");
      tel.className = "contactChip";
      tel.href = telLink(phone);
      tel.innerHTML = `📞 <b>${c.name || "Chiama"}</b> <span>Chiama</span>`;

      contactsRow.appendChild(wa);
      contactsRow.appendChild(tel);
    });

    // Tappa sul riquadro messaggio per parlare
    if (voicePanelInner) {
      voicePanelInner.addEventListener("click", () => {
        showAudioGateOnce();
        speak(txt);
      }, { passive: true });
    }
  }

  // ---------- Index altre vetrine ----------
  function renderIndex(list) {
    if (!indexPanel || !indexList) return;
    if (!Array.isArray(list) || list.length <= 1) {
      indexPanel.hidden = true;
      return;
    }
    indexPanel.hidden = false;
    indexList.innerHTML = "";
    list.forEach((x) => {
      if (!x?.id) return;
      if (x.id === vetrinaId) return;

      const a = document.createElement("a");
      a.className = "indexLink";
      a.href = `vetrina.html?id=${encodeURIComponent(x.id)}`;
      a.innerHTML = `<span class="dot"></span> ${x.title || x.id}`;
      indexList.appendChild(a);
    });
  }

  // ---------- WhatsApp per foto corrente ----------
  function bindWhatsappButtons(vetrinaObj) {
    const contacts = Array.isArray(vetrinaObj.contacts) ? vetrinaObj.contacts : [];

    function buildMsgForCurrent() {
      const title = vetrinaObj.title || vetrinaId;
      const photoNum = `${String(current + 1).padStart(2, "0")}/${String(images.length).padStart(2, "0")}`;
      const imgUrl = location.origin + location.pathname.replace(/\/[^/]+$/, "/") + images[current].url;
      return `Ciao! Vorrei info su questa foto (${photoNum}) della vetrina "${title}".\nFoto: ${imgUrl}\nPagina: ${location.href}`;
    }

    if (waInfoBtn) {
      waInfoBtn.addEventListener("click", () => {
        const msg = buildMsgForCurrent();
        if (!contacts.length) {
          openWaModal(msg, [{ name: "WhatsApp", phone: "" }]);
          // se non hai numero, almeno copia testo
          try { navigator.clipboard.writeText(msg); } catch {}
          return;
        }
        openWaModal(msg, contacts);
      }, { passive: true });
    }

    if (shareBtn) {
      shareBtn.addEventListener("click", () => {
        const txt = `Guarda questa vetrina: ${location.href}`;
        // share nativo se disponibile
        if (navigator.share) {
          navigator.share({ text: txt, url: location.href }).catch(() => {});
        } else {
          // fallback: se c'è almeno un contatto usa il primo
          if (contacts[0]?.phone) {
            location.href = waLink(contacts[0].phone, txt);
          } else {
            try { navigator.clipboard.writeText(txt); } catch {}
            alert("Link copiato negli appunti (se permesso).");
          }
        }
      }, { passive: true });
    }
  }

  // ---------- Bottom bar ----------
  function bindBottomBar() {
    if (homeBtn) homeBtn.addEventListener("click", () => location.href = "index.html", { passive: true });
    if (voiceBtn) voiceBtn.addEventListener("click", () => {
      showAudioGateOnce();
      if (v?.voiceText) speak(v.voiceText);
    }, { passive: true });
    if (stopBtn) stopBtn.addEventListener("click", () => stopSpeak(), { passive: true });
    if (fullBtn) fullBtn.addEventListener("click", () => toggleFullscreen(), { passive: true });

    if (themeBtn) themeBtn.addEventListener("click", () => {
      document.body.classList.toggle("themeAlt");
      localStorage.setItem("sercuc_themeAlt", document.body.classList.contains("themeAlt") ? "1" : "0");
    }, { passive: true });

    if (kioskBtn) kioskBtn.addEventListener("click", () => {
      // kiosk: nasconde barra e tocchi “lunghi” non richiesti
      bottombar?.classList.toggle("hideKiosk");
      document.body.classList.toggle("kioskMode");
    }, { passive: true });

    if (localStorage.getItem("sercuc_themeAlt") === "1") {
      document.body.classList.add("themeAlt");
    }
  }

  // ---------- Init ----------
  async function init() {
    if (!vetrinaId) {
      safeText(pageTitle, "Manca id vetrina");
      safeText(pageDesc, "Apri: vetrina.html?id=xxx");
      return;
    }
    safeText(badgeId, `id: ${vetrinaId}`);

    // 1) carica json vetrine
    try {
      const data = await fetchJSON(DATA_URL);
      vetrine = Array.isArray(data) ? data : (Array.isArray(data?.vetrine) ? data.vetrine : []);
    } catch (e) {
      safeText(pageTitle, "Errore dati");
      safeText(pageDesc, String(e?.message || e));
      return;
    }

    // 2) trova vetrina
    v = vetrine.find((x) => String(x.id || "").trim() === vetrinaId) || null;
    if (!v) {
      safeText(pageTitle, "Vetrina non trovata");
      safeText(pageDesc, `Nessuna vetrina con id=${vetrinaId} in ${DATA_URL}`);
      return;
    }

    safeText(pageTitle, v.title || vetrinaId);
    safeText(pageDesc, v.desc || v.description || "");

    // 3) immagini: prima da json, altrimenti scan
    const fromJson = imagesFromJson(v);
    if (fromJson) {
      images = fromJson;
    } else {
      images = await scanImagesByProbing(vetrinaId);
    }

    if (!images.length) {
      // fallback: mostra almeno una immagine “diretta” se esiste media/id-001
      safeText(pageDesc, (pageDesc?.textContent || "") + "\n(Nessuna immagine trovata in /media)");
      return;
    }

    // 4) render
    bindNav();
    bindBottomBar();
    renderVoiceAndContacts(v);
    renderIndex(vetrine);

    // refresh index (solo ricostruzione, dati già in memoria)
    if (refreshIndexBtn) {
      refreshIndexBtn.addEventListener("click", () => renderIndex(vetrine), { passive: true });
    }

    // 5) whatsapp
    bindWhatsappButtons(v);

    // 6) start
    setCurrent(0);

    // 7) audio gate hint (una volta)
    showAudioGateOnce();
  }

  // Start
  init().catch((e) => {
    safeText(pageTitle, "Errore");
    safeText(pageDesc, String(e?.message || e));
  });
})();
