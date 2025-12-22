/* app.js - Vetrina SerCucTech (WhatsApp per foto + overlay)
   Funziona con: data/<id>.json e data/vetrine.json (o index.json se vuoi)
*/

(function () {
  const $ = (id) => document.getElementById(id);

  const els = {
    pageTitle: $("pageTitle"),
    pageDesc: $("pageDesc"),
    badgeId: $("badgeId"),

    heroImg: $("heroImg"),
    pinsLayer: $("pinsLayer"),
    imgCounter: $("imgCounter"),
    imgBadge: $("imgBadge"),

    prevBtn: $("prevBtn"),
    nextBtn: $("nextBtn"),
    thumbRow: $("thumbRow"),

    voicePanel: $("voicePanel"),
    voicePanelInner: $("voicePanelInner"),
    voiceText: $("voiceText"),
    contactsRow: $("contactsRow"),

    indexPanel: $("indexPanel"),
    refreshIndexBtn: $("refreshIndexBtn"),
    indexList: $("indexList"),

    waInfoBtn: $("waInfoBtn"),          // sotto foto
    waOnPhotoBtn: $("waOnPhotoBtn"),    // sulla foto

    shareBtn: $("shareBtn"),

    waModal: $("waModal"),
    waModalText: $("waModalText"),
    waModalBtns: $("waModalBtns"),
    waCloseBtn: $("waCloseBtn"),
  };

  const qs = new URLSearchParams(location.search);
  const vId = (qs.get("id") || "").trim();
  const basePath = ""; // repo root

  let data = null;
  let media = [];
  let idx = 0;

  // ---- Helpers
  function safeText(s) { return (s ?? "").toString(); }

  function formatPhoneForText(phoneRaw) {
    // +393332927842 -> +39 333 292 7842 (semplice, leggibile)
    const p = safeText(phoneRaw).replace(/\s+/g, "");
    if (!p) return "";
    if (p.startsWith("+39") && p.length >= 6) {
      const rest = p.slice(3);
      // prova a formattare 3-3-4 se possibile
      const a = rest.slice(0, 3);
      const b = rest.slice(3, 6);
      const c = rest.slice(6);
      return `+39 ${a} ${b}${c ? " " + c : ""}`.trim();
    }
    return p;
  }

  function waUrl(phone, text) {
    // wa.me funziona bene su Android
    const p = safeText(phone).replace(/[^\d+]/g, "").replace(/^\+/, "");
    return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
  }

  function ensureArray(x) {
    return Array.isArray(x) ? x : [];
  }

  function currentMedia() {
    return media[idx] || null;
  }

  function currentPhotoLabel() {
    // numero umano 1..N
    const n = idx + 1;
    const pad = String(n).padStart(2, "0");
    const m = currentMedia();
    const label = m?.label ? ` (${m.label})` : "";
    return { n, pad, label };
  }

  // ---- WhatsApp modal
  function openWaModal(message) {
    els.waModalText.textContent = message;
    els.waModalBtns.innerHTML = "";

    const contacts = ensureArray(data?.contacts);

    // se non configurati: mostra un bottone disabilitato
    if (!contacts.length) {
      const b = document.createElement("button");
      b.textContent = "Nessun contatto configurato";
      b.disabled = true;
      els.waModalBtns.appendChild(b);
      els.waModal.hidden = false;
      return;
    }

    // Bottone per ogni contatto
    contacts.forEach((c) => {
      const name = safeText(c.name || "Contatto");
      const phone = safeText(c.phone || "");
      const btn = document.createElement("button");
      btn.className = "primary";
      btn.type = "button";
      btn.textContent = `WhatsApp ${name}`;
      btn.onclick = () => {
        if (!phone) return;
        location.href = waUrl(phone, message);
      };
      els.waModalBtns.appendChild(btn);
    });

    // Bottone "Entrambi" (apre 2 chat una dopo l’altra)
    if (contacts.length >= 2) {
      const btnBoth = document.createElement("button");
      btnBoth.type = "button";
      btnBoth.textContent = "Invia a entrambi (apre 2 chat)";
      btnBoth.onclick = () => {
        const first = contacts[0]?.phone;
        const second = contacts[1]?.phone;
        if (first) window.open(waUrl(first, message), "_blank");
        // piccola pausa per non bloccare popup
        setTimeout(() => {
          if (second) window.open(waUrl(second, message), "_blank");
        }, 700);
      };
      els.waModalBtns.appendChild(btnBoth);
    }

    els.waModal.hidden = false;
  }

  function closeWaModal() {
    els.waModal.hidden = true;
  }

  // ---- Render
  function renderThumbs() {
    els.thumbRow.innerHTML = "";
    media.forEach((m, i) => {
      const t = document.createElement("button");
      t.type = "button";
      t.className = "thumb" + (i === idx ? " active" : "");
      const img = document.createElement("img");
      img.loading = "lazy";
      img.alt = m?.label || `Foto ${i + 1}`;
      img.src = basePath + (m?.url || "");
      t.appendChild(img);
      t.onclick = () => { idx = i; renderHero(); };
      els.thumbRow.appendChild(t);
    });
  }

  function renderHero() {
    const m = currentMedia();
    if (!m) return;

    els.heroImg.src = basePath + m.url;

    const total = media.length || 1;
    const human = idx + 1;
    els.imgCounter.textContent = `${String(human).padStart(2, "0")}/${String(total).padStart(2, "0")}`;
    els.imgBadge.textContent = String(human).padStart(2, "0");

    // aggiorna thumbs active
    [...els.thumbRow.querySelectorAll(".thumb")].forEach((b, i) => {
      b.classList.toggle("active", i === idx);
    });

    // aggiorna testo bottone (sotto e sopra foto) per essere chiaro
    const info = currentPhotoLabel();
    const btnText = `WhatsApp: chiedi info su questa foto (${info.pad}/${String(total).padStart(2, "0")})`;
    if (els.waInfoBtn) els.waInfoBtn.textContent = btnText;
    if (els.waOnPhotoBtn) els.waOnPhotoBtn.textContent = btnText;
  }

  // ---- Actions
  function nextPhoto() {
    if (!media.length) return;
    idx = (idx + 1) % media.length;
    renderHero();
  }
  function prevPhoto() {
    if (!media.length) return;
    idx = (idx - 1 + media.length) % media.length;
    renderHero();
  }

  function buildWaMessage() {
    const info = currentPhotoLabel();
    const m = currentMedia();

    // messaggio con foto e link
    const pageUrl = location.href.split("#")[0];
    const title = safeText(data?.title || "Vetrina");
    const photoUrl = m?.url ? (new URL(m.url, location.href)).href : "";

    return (
      `Ciao! Vorrei informazioni su questa foto.\n\n` +
      `Vetrina: ${title}\n` +
      `ID: ${vId}\n` +
      `Numero foto: ${info.n}${info.label}\n` +
      (photoUrl ? `Foto: ${photoUrl}\n` : "") +
      `Link vetrina: ${pageUrl}\n\n` +
      `Grazie!`
    );
  }

  function onWaClick() {
    if (!data) return;
    openWaModal(buildWaMessage());
  }

  // ---- Load JSON
  async function loadJson(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} su ${path}`);
    return await res.json();
  }

  async function init() {
    if (!vId) {
      els.pageTitle.textContent = "Errore";
      els.pageDesc.textContent = "Manca ?id=...";
      return;
    }
    els.badgeId.textContent = `id: ${vId}`;

    try {
      // ✅ nel tuo repo i json sono in /data e si chiamano renzo11.json ecc.
      data = await loadJson(`${basePath}data/${encodeURIComponent(vId)}.json`);

      els.pageTitle.textContent = safeText(data.title || vId);
      els.pageDesc.textContent = safeText(data.description || "");

      // Voice panel
      const voiceText = safeText(data?.voice?.text || "");
      if (voiceText) {
        els.voicePanel.hidden = false;
        els.voiceText.textContent = voiceText;
      }

      // Contacts
      els.contactsRow.innerHTML = "";
      const contacts = ensureArray(data?.contacts);
      contacts.forEach(c => {
        const name = safeText(c.name || "Contatto");
        const phone = safeText(c.phone || "");
        const chip = document.createElement("a");
        chip.className = "contactPill";
        chip.href = phone ? waUrl(phone, `Ciao ${name}!`) : "#";
        chip.target = "_blank";
        chip.rel = "noopener";
        chip.innerHTML = `<b>${name}</b> <span>${formatPhoneForText(phone)}</span>`;
        els.contactsRow.appendChild(chip);
      });

      // Media images only
      media = ensureArray(data.media).filter(x => x && x.type === "image" && x.url);
      if (!media.length) {
        els.pageDesc.textContent = (els.pageDesc.textContent ? els.pageDesc.textContent + " — " : "") + "Nessuna immagine trovata";
        return;
      }

      idx = 0;
      renderThumbs();
      renderHero();

      // ✅ bottoni
      if (els.prevBtn) els.prevBtn.onclick = prevPhoto;
      if (els.nextBtn) els.nextBtn.onclick = nextPhoto;

      if (els.waInfoBtn) els.waInfoBtn.onclick = onWaClick;
      if (els.waOnPhotoBtn) els.waOnPhotoBtn.onclick = onWaClick;

      // Chiudi modale
      if (els.waCloseBtn) els.waCloseBtn.onclick = closeWaModal;
      if (els.waModal) els.waModal.addEventListener("click", (e) => {
        if (e.target === els.waModal) closeWaModal();
      });

      // (Indice vetrine) prova vetrine.json
      try {
        const list = await loadJson(`${basePath}data/vetrine.json`);
        const vetrine = ensureArray(list?.vetrine);
        if (vetrine.length) {
          els.indexPanel.hidden = false;
          els.indexList.innerHTML = "";
          vetrine.forEach(v => {
            const a = document.createElement("a");
            a.className = "indexLink";
            a.href = `vetrina.html?id=${encodeURIComponent(v.id)}`;
            a.innerHTML = `<span class="dot"></span>${safeText(v.title || v.id)}`;
            els.indexList.appendChild(a);
          });
        }
      } catch (_) {
        // non bloccare se manca
      }

      if (els.refreshIndexBtn) {
        els.refreshIndexBtn.onclick = () => location.reload();
      }

    } catch (err) {
      els.pageTitle.textContent = "Errore";
      els.pageDesc.textContent = `Non riesco a leggere data/${vId}.json`;
      console.error(err);
    }
  }

  init();
})();
