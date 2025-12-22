/* SerCucTech - app.js v99 (robusto / no-crash) */
(() => {
  "use strict";

  // ✅ Anti-cache aggressivo (Pages + Android)
  const FETCH_OPTS = { cache: "no-store" };

  // ✅ Helpers
  const $ = (id) => document.getElementById(id);
  const pad2 = (n) => String(n).padStart(2, "0");

  // ✅ Elementi (se manca qualcuno NON deve crashare)
  const pageTitle = $("pageTitle");
  const pageDesc = $("pageDesc");
  const badgeId = $("badgeId");

  const voicePanel = $("voicePanel");
  const voicePanelInner = $("voicePanelInner");
  const voiceTextEl = $("voiceText");
  const contactsRow = $("contactsRow");

  const indexPanel = $("indexPanel");
  const indexList = $("indexList");
  const refreshIndexBtn = $("refreshIndexBtn");

  const prevBtn = $("prevBtn");
  const nextBtn = $("nextBtn");
  const heroImg = $("heroImg");
  const imgCounter = $("imgCounter");
  const imgBadge = $("imgBadge");
  const thumbRow = $("thumbRow");
  const imgWrap = $("imgWrap");
  const pinsLayer = $("pinsLayer");

  const waInfoBtn = $("waInfoBtn");
  const waModal = $("waModal");
  const waModalText = $("waModalText");
  const waModalBtns = $("waModalBtns");
  const waCloseBtn = $("waCloseBtn");

  const shareBtn = $("shareBtn");

  const homeBtn = $("homeBtn");
  const voiceBtn = $("voiceBtn");
  const stopBtn = $("stopBtn");
  const fullBtn = $("fullBtn");
  const themeBtn = $("themeBtn");
  const kioskBtn = $("kioskBtn");

  // Numerini editor
  const labelCard = $("labelCard");
  const labelModeBadge = $("labelModeBadge");
  const labelUndoBtn = $("labelUndoBtn");
  const labelClearBtn = $("labelClearBtn");
  const pinSizeRange = $("pinSizeRange");
  const pinSizeValue = $("pinSizeValue");
  const pinsJsonBox = $("pinsJsonBox");
  const exportPinsBtn = $("exportPinsBtn");
  const copyPinsBtn = $("copyPinsBtn");
  const closeLabelBtn = $("closeLabelBtn");
  const downloadPngBtn = $("downloadPngBtn");

  // Audio gate
  const audioGate = $("audioGate");
  const enableAudioBtn = $("enableAudioBtn");
  const skipAudioBtn = $("skipAudioBtn");

  // Stato
  let vetrina = null;
  let media = [];
  let idx = 0;

  // Audio TTS
  let utter = null;
  let audioUnlocked = false;

  // Fullscreen toggle
  let fs = false;

  // Modalità segreta numerini
  let secretTapCount = 0;
  let secretTapTimer = null;
  let labelMode = false;

  // Pins per immagine: { [mediaIndex]: [{x,y,n,size}] }
  let pinsByImage = {};
  let nextPinNumber = 1;

  // ==============================
  // BOOT
  // ==============================
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const id = getIdFromUrl();
      if (!id) return showError("Manca id in URL. Esempio: vetrina.html?id=renzo11");

      if (badgeId) badgeId.textContent = `id: ${id}`;

      // Carica vetrina
      vetrina = await loadVetrina(id);
      if (!vetrina) return showError(`Non riesco a leggere data/${id}.json`);

      // UI base
      if (pageTitle) pageTitle.textContent = vetrina.title || id;
      if (pageDesc) pageDesc.textContent = vetrina.description || "";

      // Media
      media = Array.isArray(vetrina.media) ? vetrina.media.filter(m => m && m.type === "image" && m.url) : [];
      if (!media.length) return showError("Nessuna immagine trovata in media[]");

      // Voice panel
      setupVoicePanel(vetrina);

      // Indice altre vetrine
      await renderIndex();

      // Pins
      pinsByImage = loadPinsLocal(id);
      nextPinNumber = computeNextPinNumber(pinsByImage);

      // Gallery
      idx = 0;
      renderThumbs();
      showImage(0);

      // Listeners bottoni
      wireButtons(id);

      // Segreto: 5 tap sul titolo
      if (pageTitle) {
        pageTitle.addEventListener("click", () => {
          secretTapCount++;
          clearTimeout(secretTapTimer);
          secretTapTimer = setTimeout(() => (secretTapCount = 0), 1200);
          if (secretTapCount >= 5) {
            secretTapCount = 0;
            toggleLabelMode();
          }
        });
      }
    } catch (e) {
      console.error(e);
      showError("Errore JS: controlla Console. (Ora ho stampato l’errore)");
    }
  });

  // ==============================
  // DATA LOAD
  // ==============================
  function getIdFromUrl() {
    const u = new URL(location.href);
    return u.searchParams.get("id");
  }

  async function loadVetrina(id) {
    // Percorso standard: /data/<id>.json
    const url = `data/${encodeURIComponent(id)}.json?v=${Date.now()}`;
    try {
      const r = await fetch(url, FETCH_OPTS);
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  }

  async function loadIndex() {
    // Indice: /data/vetrine.json (come nel tuo repo)
    const url = `data/vetrine.json?v=${Date.now()}`;
    try {
      const r = await fetch(url, FETCH_OPTS);
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  }

  // ==============================
  // UI - Voice + Contacts
  // ==============================
  function setupVoicePanel(v) {
    const voice = v.voice || {};
    const text = (voice.text || "").trim();
    const contacts = Array.isArray(v.contacts) ? v.contacts : [];

    if (text && voiceTextEl) {
      voiceTextEl.textContent = text;
      if (voicePanel) voicePanel.hidden = false;

      // clicca OVUNQUE nel pannello per parlare
      if (voicePanelInner) {
        voicePanelInner.addEventListener("click", (ev) => {
          // se clicchi un link contatto non deve far partire doppio
          const a = ev.target && ev.target.closest && ev.target.closest("a");
          if (a) return;
          speakText(text, voice.lang || "it-IT");
        });
      }
    }

    if (contactsRow) {
      contactsRow.innerHTML = "";
      for (const c of contacts) {
        const name = c.name || "Contatto";
        const phone = normalizePhone(c.phone || "");
        if (!phone) continue;

        // WhatsApp
        const wa = document.createElement("a");
        wa.className = "contactChip";
        wa.href = `https://wa.me/${phone.replace(/\+/g, "")}`;
        wa.target = "_blank";
        wa.rel = "noopener";
        wa.innerHTML = `🟢 <b>${escapeHtml(name)}</b> <span>${escapeHtml(formatPhoneForView(phone))}</span>`;
        contactsRow.appendChild(wa);

        // Call
        const call = document.createElement("a");
        call.className = "contactChip";
        call.href = `tel:${phone}`;
        call.innerHTML = `📞 <b>${escapeHtml(name)}</b> <span>Chiama</span>`;
        contactsRow.appendChild(call);
      }
    }
  }

  // ==============================
  // UI - Index
  // ==============================
  async function renderIndex() {
    const idxData = await loadIndex();
    if (!idxData || !Array.isArray(idxData.vetrine) || !indexList) return;

    if (indexPanel) indexPanel.hidden = false;

    indexList.innerHTML = "";
    for (const item of idxData.vetrine) {
      if (!item || !item.id) continue;
      const a = document.createElement("a");
      a.className = "indexLink";
      a.href = `vetrina.html?id=${encodeURIComponent(item.id)}&v=${Date.now()}`;
      a.innerHTML = `<span class="dot"></span> ${escapeHtml(item.title || item.id)}`;
      indexList.appendChild(a);
    }

    if (refreshIndexBtn) {
      refreshIndexBtn.onclick = () => location.reload();
    }
  }

  // ==============================
  // UI - Gallery
  // ==============================
  function renderThumbs() {
    if (!thumbRow) return;
    thumbRow.innerHTML = "";
    media.forEach((m, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "thumb" + (i === idx ? " active" : "");
      b.title = m.label || `Foto ${i + 1}`;
      b.addEventListener("click", () => showImage(i));
      const im = document.createElement("img");
      im.src = m.url;
      im.alt = m.label || `Foto ${i + 1}`;
      b.appendChild(im);
      thumbRow.appendChild(b);
    });
  }

  function showImage(i) {
    idx = Math.max(0, Math.min(media.length - 1, i));

    // thumb active
    if (thumbRow) {
      [...thumbRow.querySelectorAll(".thumb")].forEach((t, k) => {
        t.classList.toggle("active", k === idx);
      });
    }

    const m = media[idx];
    if (heroImg) {
      heroImg.src = m.url;
      heroImg.onload = () => renderPinsForCurrentImage();
    }

    if (imgCounter) imgCounter.textContent = `${pad2(idx + 1)}/${pad2(media.length)}`;
    if (imgBadge) imgBadge.textContent = pad2(idx + 1);

    renderPinsForCurrentImage();
  }

  // Tap foto = fullscreen (solo foto!)
  function wirePhotoFullscreen() {
    if (!heroImg) return;
    heroImg.addEventListener("click", () => toggleFullscreen());
  }

  function toggleFullscreen() {
    fs = !fs;
    document.body.classList.toggle("fs", fs);
  }

  // ==============================
  // WhatsApp richiesta info (scegli contatto o entrambi)
  // ==============================
  function openWaModalForCurrentPhoto() {
    if (!vetrina) return;

    const contacts = Array.isArray(vetrina.contacts) ? vetrina.contacts : [];
    const photoLabel = (media[idx] && (media[idx].label || media[idx].url)) ? (media[idx].label || media[idx].url) : `Foto ${idx + 1}`;

    const msg =
      `Ciao! Vorrei chiedere informazioni su questa foto (${photoLabel}) della vetrina "${vetrina.title || vetrina.id}".\n` +
      `Numero foto: ${idx + 1}\n` +
      `Grazie!`;

    if (!waModal || !waModalText || !waModalBtns) {
      // fallback: se manca la modale, apre il primo contatto
      const first = contacts[0];
      if (first && first.phone) {
        const p = normalizePhone(first.phone);
        window.open(`https://wa.me/${p.replace(/\+/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
      }
      return;
    }

    waModalText.textContent = msg;
    waModalBtns.innerHTML = "";

    // bottoni per ogni contatto
    for (const c of contacts) {
      const name = c.name || "Contatto";
      const phone = normalizePhone(c.phone || "");
      if (!phone) continue;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "primary";
      btn.textContent = `Invia a ${name}`;
      btn.addEventListener("click", () => {
        const url = `https://wa.me/${phone.replace(/\+/g, "")}?text=${encodeURIComponent(msg)}`;
        window.open(url, "_blank");
        closeWaModal();
      });
      waModalBtns.appendChild(btn);
    }

    // “Entrambi”: apre due tab (limite WhatsApp)
    if (contacts.length >= 2) {
      const both = document.createElement("button");
      both.type = "button";
      both.textContent = "Invia a entrambi (2 tab)";
      both.addEventListener("click", () => {
        for (const c of contacts.slice(0, 2)) {
          const phone = normalizePhone(c.phone || "");
          if (!phone) continue;
          const url = `https://wa.me/${phone.replace(/\+/g, "")}?text=${encodeURIComponent(msg)}`;
          window.open(url, "_blank");
        }
        closeWaModal();
      });
      waModalBtns.appendChild(both);
    }

    waModal.hidden = false;
  }

  function closeWaModal() {
    if (waModal) waModal.hidden = true;
  }

  // ==============================
  // Buttons
  // ==============================
  function wireButtons(id) {
    // Prev/Next
    if (prevBtn) prevBtn.addEventListener("click", () => showImage(idx - 1));
    if (nextBtn) nextBtn.addEventListener("click", () => showImage(idx + 1));

    // Full
    if (fullBtn) fullBtn.addEventListener("click", () => toggleFullscreen());

    // Voice button
    if (voiceBtn && vetrina && vetrina.voice && vetrina.voice.text) {
      voiceBtn.addEventListener("click", () => speakText(vetrina.voice.text, (vetrina.voice.lang || "it-IT")));
    }

    // Stop
    if (stopBtn) stopBtn.addEventListener("click", stopSpeak);

    // WA under photo
    if (waInfoBtn) waInfoBtn.addEventListener("click", openWaModalForCurrentPhoto);
    if (waCloseBtn) waCloseBtn.addEventListener("click", closeWaModal);

    // Share
    if (shareBtn) {
      shareBtn.addEventListener("click", async () => {
        const url = location.href;
        const text = `Guarda questa vetrina: ${url}`;
        try {
          if (navigator.share) {
            await navigator.share({ title: document.title, text, url });
          } else {
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
          }
        } catch {}
      });
    }

    // Home
    if (homeBtn) homeBtn.addEventListener("click", () => location.href = `vetrina.html?id=${encodeURIComponent(id)}&v=${Date.now()}`);

    // Theme / kiosk (placeholder)
    if (themeBtn) themeBtn.addEventListener("click", () => document.body.classList.toggle("theme2"));
    if (kioskBtn) kioskBtn.addEventListener("click", () => alert("Kiosk: funzione opzionale (la abilitiamo dopo)."));

    // Fullscreen tap on photo
    wirePhotoFullscreen();

    // Audio gate
    if (enableAudioBtn) enableAudioBtn.addEventListener("click", () => unlockAudioAndSpeak());
    if (skipAudioBtn) skipAudioBtn.addEventListener("click", () => {
      if (audioGate) audioGate.hidden = true;
    });

    // Label editor buttons
    if (labelUndoBtn) labelUndoBtn.addEventListener("click", undoPin);
    if (labelClearBtn) labelClearBtn.addEventListener("click", clearPins);
    if (pinSizeRange) pinSizeRange.addEventListener("input", () => {
      if (pinSizeValue) pinSizeValue.textContent = String(pinSizeRange.value);
      renderPinsForCurrentImage();
    });
    if (exportPinsBtn) exportPinsBtn.addEventListener("click", exportPinsJson);
    if (copyPinsBtn) copyPinsBtn.addEventListener("click", copyPinsJson);
    if (closeLabelBtn) closeLabelBtn.addEventListener("click", () => {
      if (labelCard) labelCard.hidden = true;
      labelMode = false;
      if (labelModeBadge) labelModeBadge.textContent = "OFF";
    });
    if (downloadPngBtn) downloadPngBtn.addEventListener("click", downloadPngWithPins);

    // Add pin on image when labelMode
    if (heroImg) {
      heroImg.addEventListener("click", (ev) => {
        if (!labelMode) return;
        // coordinate relative all’immagine visualizzata
        const rect = heroImg.getBoundingClientRect();
        const x = (ev.clientX - rect.left) / rect.width;
        const y = (ev.clientY - rect.top) / rect.height;
        addPin(x, y);
      });
    }
  }

  // ==============================
  // Speech
  // ==============================
  function unlockAudioAndSpeak() {
    audioUnlocked = true;
    if (audioGate) audioGate.hidden = true;
    if (vetrina && vetrina.voice && vetrina.voice.text) {
      speakText(vetrina.voice.text, vetrina.voice.lang || "it-IT");
    }
  }

  function speakText(text, lang) {
    stopSpeak();

    // su Android spesso serve gesto: se non sbloccato mostra gate
    if (!audioUnlocked && audioGate) {
      audioGate.hidden = false;
      return;
    }

    if (!("speechSynthesis" in window)) {
      alert("Sintesi vocale non disponibile su questo browser.");
      return;
    }

    utter = new SpeechSynthesisUtterance(String(text));
    utter.lang = lang || "it-IT";

    // ✅ numeri letti meglio: li “spazi” (3 3 3 ...)
    utter.text = makeNumbersSpeakBetter(utter.text);

    window.speechSynthesis.speak(utter);
  }

  function stopSpeak() {
    try {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    } catch {}
    utter = null;
  }

  function makeNumbersSpeakBetter(t) {
    // trasforma sequenze lunghe di cifre in cifre separate
    return t.replace(/\b(\+?\d[\d\s]{6,}\d)\b/g, (m) => {
      const only = m.replace(/[^\d+]/g, "");
      // +39...
      if (only.startsWith("+")) {
        return "+ " + only.slice(1).split("").join(" ");
      }
      return only.split("").join(" ");
    });
  }

  // ==============================
  // Label mode (pins)
  // ==============================
  function toggleLabelMode() {
    labelMode = !labelMode;
    if (labelCard) labelCard.hidden = !labelMode;
    if (labelModeBadge) labelModeBadge.textContent = labelMode ? "ON" : "OFF";
    if (pinsJsonBox) pinsJsonBox.value = "";
    renderPinsForCurrentImage();
  }

  function addPin(x, y) {
    const size = Number(pinSizeRange ? pinSizeRange.value : 28) || 28;
    const p = { x, y, n: nextPinNumber++, size };
    if (!pinsByImage[idx]) pinsByImage[idx] = [];
    pinsByImage[idx].push(p);
    savePinsLocal(vetrina.id, pinsByImage);
    renderPinsForCurrentImage();
  }

  function undoPin() {
    if (!pinsByImage[idx] || !pinsByImage[idx].length) return;
    pinsByImage[idx].pop();
    savePinsLocal(vetrina.id, pinsByImage);
    nextPinNumber = computeNextPinNumber(pinsByImage);
    renderPinsForCurrentImage();
  }

  function clearPins() {
    pinsByImage[idx] = [];
    savePinsLocal(vetrina.id, pinsByImage);
    nextPinNumber = computeNextPinNumber(pinsByImage);
    renderPinsForCurrentImage();
  }

  function renderPinsForCurrentImage() {
    if (!pinsLayer) return;
    pinsLayer.innerHTML = "";
    const pins = pinsByImage[idx] || [];

    pins.forEach((p) => {
      const d = document.createElement("div");
      d.className = "pin";
      d.textContent = String(p.n);

      const s = Number(p.size || (pinSizeRange ? pinSizeRange.value : 28)) || 28;
      d.style.width = `${s}px`;
      d.style.height = `${s}px`;

      d.style.left = `${p.x * 100}%`;
      d.style.top = `${p.y * 100}%`;
      pinsLayer.appendChild(d);
    });
  }

  function exportPinsJson() {
    const out = { imageIndex: idx, pins: (pinsByImage[idx] || []) };
    if (pinsJsonBox) pinsJsonBox.value = JSON.stringify(out, null, 2);
  }

  async function copyPinsJson() {
    exportPinsJson();
    if (!pinsJsonBox) return;
    try {
      await navigator.clipboard.writeText(pinsJsonBox.value);
      alert("Copiato!");
    } catch {
      pinsJsonBox.select();
      document.execCommand("copy");
      alert("Copiato!");
    }
  }

  function savePinsLocal(vetrinaId, data) {
    try {
      localStorage.setItem(`pins_${vetrinaId}`, JSON.stringify(data));
    } catch {}
  }

  function loadPinsLocal(vetrinaId) {
    try {
      const s = localStorage.getItem(`pins_${vetrinaId}`);
      return s ? JSON.parse(s) : {};
    } catch {
      return {};
    }
  }

  function computeNextPinNumber(all) {
    let max = 0;
    for (const k of Object.keys(all || {})) {
      for (const p of (all[k] || [])) max = Math.max(max, Number(p.n) || 0);
    }
    return max + 1;
  }

  // ==============================
  // PNG export (con numerini disegnati)
  // ==============================
  async function downloadPngWithPins() {
    if (!heroImg || !heroImg.src) return;

    try {
      // canvas con dimensione immagine reale
      const img = await loadImageCross(heroImg.src);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      const pins = pinsByImage[idx] || [];
      pins.forEach((p) => {
        const x = p.x * canvas.width;
        const y = p.y * canvas.height;
        const size = Math.max(14, Number(p.size || 28));

        // cerchio
        ctx.beginPath();
        ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.stroke();

        // numero
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.floor(size * 0.75)}px system-ui, Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(p.n), x, y);
      });

      const a = document.createElement("a");
      a.download = `${(vetrina && vetrina.id) ? vetrina.id : "vetrina"}_${pad2(idx + 1)}_numerini.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    } catch (e) {
      console.error(e);
      alert("Non riesco a creare il PNG (controlla Console).");
    }
  }

  function loadImageCross(src) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = src + (src.includes("?") ? "&" : "?") + "v=" + Date.now();
    });
  }

  // ==============================
  // Errors
  // ==============================
  function showError(msg) {
    if (pageTitle) pageTitle.textContent = "Errore";
    if (pageDesc) pageDesc.textContent = msg;
    alert(msg);
  }

  // ==============================
  // Utils
  // ==============================
  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function normalizePhone(p) {
    const x = String(p || "").trim();
    if (!x) return "";
    // mantiene + e numeri
    let out = x.replace(/[^\d+]/g, "");
    // se parte con 00 -> +
    if (out.startsWith("00")) out = "+" + out.slice(2);
    // se è italiano senza +, aggiunge +39
    if (!out.startsWith("+") && out.length >= 9) out = "+39" + out;
    return out;
  }

  function formatPhoneForView(p) {
    // +39 333 123 4567
    const s = String(p || "");
    if (!s.startsWith("+")) return s;
    const cc = s.slice(0, 3); // +39
    const rest = s.slice(3);
    return `${cc} ${rest.replace(/(\d{3})(?=\d)/g, "$1 ")}`.trim();
  }
})();
