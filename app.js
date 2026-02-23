const API = "https://script.google.com/macros/s/AKfycbxy6krdVnu3JrOGwiBdebnkRZeW4a_vbM76tzkwsW3xWA6YDHdhmuGZhhpMxaDiSLYScg/exec";

// === Countdown (UTC-03) ===
const DUE_DATE_ISO = "2026-05-18T00:00:00-03:00";

const elList = document.getElementById("list");
const elMsg = document.getElementById("msg");

function showMsg(html) {
  elMsg.innerHTML = html || "";
}

async function apiGetList() {
  const r = await fetch(`${API}?action=list`);
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "Error list");
  return j.items;
}

async function apiReserve(item_id, reserved_by, message) {
  const r = await fetch(API, {
    method: "POST",
    // Evita preflight CORS (Apps Script)
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "reserve", item_id, reserved_by, message })
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "Error reserve");
  return j.token;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[m]));
}

function escapeAttr(s){
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function pad2(n){ return String(n).padStart(2, "0"); }

function tickCountdown(){
  const target = new Date(DUE_DATE_ISO).getTime();
  const now = Date.now();
  const diff = target - now;

  const label = document.getElementById("cd_label");
  const elD = document.getElementById("cd_days");
  const elH = document.getElementById("cd_hours");
  const elM = document.getElementById("cd_mins");

  if (!elD || !elH || !elM) return;

  if (diff <= 0){
    elD.textContent = "0";
    elH.textContent = "00";
    elM.textContent = "00";
    if (label) label.textContent = "💚 ¡Llegó la Porota!";
    return;
  }

  const days  = Math.floor(diff / (1000*60*60*24));
  const hours = Math.floor((diff / (1000*60*60)) % 24);
  const mins  = Math.floor((diff / (1000*60)) % 60);

  elD.textContent = String(days);
  elH.textContent = pad2(hours);
  elM.textContent = pad2(mins);

  if (label) label.textContent = `Faltan ${days} días para el 18/05/2026`;
}

function hashStr_(s){
  s = String(s || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function categoryClass_(category){
  const idx = hashStr_(category) % 6; // 0..5
  return `cat-${idx}`;
}

function getPhotoUrl_(item){
  return (item.photo_url || "").trim();
}

function cardTemplate(item) {
  const reserved = !!item.reservation;
  const stateClass = reserved ? "bought" : "available";
  const catText = (item.category || "Sin categoría");
  const photoUrl = getPhotoUrl_(item);

  return `
    <div class="card ${stateClass}">
      <div class="row" style="align-items:center; justify-content:space-between;">
        <span class="badge ${categoryClass_(catText)}">${escapeHtml(catText)}</span>
        <span class="muted">Prioridad ${escapeHtml(String(item.priority || ""))}</span>
      </div>

      <h3 style="margin:8px 0 6px 0;">${escapeHtml(item.title || "")}</h3>
      <div class="muted">Precio est.: ${escapeHtml(String(item.price_est || ""))}</div>

      ${photoUrl ? `<img class="card__img" src="${escapeAttr(photoUrl)}" alt="${escapeAttr(item.title || "Foto")}" loading="lazy" onerror="this.style.display='none'">` : ""}

      ${item.url ? `<div style="margin:8px 0;"><a href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer">Ver link</a></div>` : ""}

      ${
        reserved
          ? `<div class="muted">✅ Reservado por <b>${escapeHtml(item.reservation.reserved_by)}</b></div>`
          : `
            <details style="margin-top:10px;">
              <summary>Reservar este regalo</summary>
              <div style="margin-top:8px;">
                <input placeholder="Tu nombre" data-name="${escapeAttr(item.id)}" />
                <textarea placeholder="Mensaje (opcional, solo lo ve el admin en Sheets)" rows="2" data-message="${escapeAttr(item.id)}"></textarea>
                <button class="primary" data-reserve="${escapeAttr(item.id)}" style="margin-top:8px;">Lo compro yo</button>
              </div>
            </details>
          `
      }
    </div>
  `;
}

async function render() {
  showMsg("");
  elList.innerHTML = "Cargando...";
  try {
    const items = await apiGetList();
    elList.innerHTML = items.map(cardTemplate).join("");
    wireEvents();
  } catch (e) {
    elList.innerHTML = "";
    showMsg(`<p style="color:#b00; font-weight:800;">${escapeHtml(e.message)}</p>`);
  }
}

function wireEvents() {
  document.querySelectorAll("[data-reserve]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const itemId = btn.getAttribute("data-reserve");
      const nameEl = document.querySelector(`[data-name="${CSS.escape(itemId)}"]`);
      const msgEl = document.querySelector(`[data-message="${CSS.escape(itemId)}"]`);

      const name = (nameEl ? nameEl.value : "").trim();
      const msg = (msgEl ? msgEl.value : "").trim();

      if (!name) return showMsg(`<p style="color:#b00; font-weight:800;">Poné tu nombre para reservar.</p>`);

      btn.disabled = true;
      try {
        const token = await apiReserve(itemId, name, msg);
        showMsg(`
          <div class="tokenbox">
            <b>Reserva confirmada.</b><br/>
            Tu código para cancelar es: <code>${escapeHtml(token)}</code><br/>
            Guardalo (si lo perdés, no vas a poder cancelar).
          </div>
        `);
        await render();
      } catch (e) {
        showMsg(`<p style="color:#b00; font-weight:800;">${escapeHtml(e.message)}</p>`);
      } finally {
        btn.disabled = false;
      }
    });
  });
}

// Init
tickCountdown();
setInterval(tickCountdown, 30_000);
render();
