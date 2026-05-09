/* Vanilla tweaks panel — three expressive knobs:
   mood (palette), voice (display font personality), density (spacing scale).
   Follows the host edit-mode protocol: register listener BEFORE announcing. */

(function () {
  const html = document.documentElement;
  const defaults = window.TWEAK_DEFAULTS || { mood: "cream", voice: "editorial", density: "cozy" };
  let state = { ...defaults };

  const SCHEMA = [
    {
      key: "mood",
      label: "Mood",
      sub: "palette · paper · accent",
      options: [
        { value: "cream",    label: "Cream",    swatch: ["#f5ecd6", "#a36b2b"] },
        { value: "midnight", label: "Midnight", swatch: ["#1d2230", "#e0bf76"] },
        { value: "sage",     label: "Sage",     swatch: ["#dde6d9", "#a04a32"] }
      ]
    },
    {
      key: "voice",
      label: "Voice",
      sub: "display typography",
      options: [
        { value: "editorial",  label: "Editorial",  preview: "Aa", style: "font-family:'Instrument Serif',serif;font-style:italic;" },
        { value: "modernist",  label: "Modernist",  preview: "Aa", style: "font-family:'Geist',sans-serif;font-weight:600;letter-spacing:-0.04em;" },
        { value: "antique",    label: "Antique",    preview: "Aa", style: "font-family:'Newsreader',serif;font-style:italic;font-weight:500;" }
      ]
    },
    {
      key: "density",
      label: "Density",
      sub: "rhythm · spacing",
      options: [
        { value: "airy",     label: "Airy",     icon: "≡" },
        { value: "cozy",     label: "Cozy",     icon: "≣" },
        { value: "compact",  label: "Compact",  icon: "▤" }
      ]
    }
  ];

  function applyTweaks(s) {
    if (s.mood)    html.dataset.mood = s.mood;
    if (s.voice)   html.dataset.voice = s.voice;
    if (s.density) html.dataset.density = s.density;
  }

  function persist(edits) {
    state = { ...state, ...edits };
    applyTweaks(state);
    syncButtons();
    try {
      window.parent.postMessage({ type: "__edit_mode_set_keys", edits }, "*");
    } catch (_) {}
  }

  // ── Build panel ─────────────────────────────────────────────
  const panel = document.createElement("aside");
  panel.className = "tweaks-panel";
  panel.setAttribute("hidden", "");
  panel.setAttribute("aria-label", "Design tweaks");

  const head = document.createElement("header");
  head.className = "tweaks-head";
  head.innerHTML = `
    <div class="tweaks-titlewrap">
      <span class="tweaks-title">Tweaks</span>
      <span class="tweaks-eyebrow">design knobs</span>
    </div>
    <button type="button" class="tweaks-close" aria-label="Close panel">×</button>
  `;
  panel.appendChild(head);

  const body = document.createElement("div");
  body.className = "tweaks-body";
  panel.appendChild(body);

  for (const section of SCHEMA) {
    const wrap = document.createElement("div");
    wrap.className = "tweaks-section";

    const lab = document.createElement("div");
    lab.className = "tweaks-section-head";
    lab.innerHTML = `<span class="tweaks-label">${section.label}</span><span class="tweaks-sub">${section.sub}</span>`;
    wrap.appendChild(lab);

    const row = document.createElement("div");
    row.className = "tweaks-row";
    row.dataset.tweak = section.key;
    for (const opt of section.options) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.value = opt.value;
      btn.className = "tweaks-opt";
      btn.title = opt.label;

      let inner = "";
      if (opt.swatch) {
        inner += `<span class="sw" style="background:linear-gradient(135deg, ${opt.swatch[0]} 50%, ${opt.swatch[1]} 50%);"></span>`;
      } else if (opt.preview) {
        inner += `<span class="preview" style="${opt.style || ""}">${opt.preview}</span>`;
      } else if (opt.icon) {
        inner += `<span class="ico" aria-hidden="true">${opt.icon}</span>`;
      }
      inner += `<span class="lbl">${opt.label}</span>`;
      btn.innerHTML = inner;
      btn.addEventListener("click", () => {
        if (state[section.key] === opt.value) return;
        persist({ [section.key]: opt.value });
      });
      row.appendChild(btn);
    }
    wrap.appendChild(row);
    body.appendChild(wrap);
  }

  function syncButtons() {
    panel.querySelectorAll(".tweaks-row").forEach((row) => {
      const key = row.dataset.tweak;
      row.querySelectorAll("button").forEach((b) => {
        b.classList.toggle("active", b.dataset.value === state[key]);
      });
    });
  }

  head.querySelector(".tweaks-close").addEventListener("click", () => {
    panel.setAttribute("hidden", "");
    try { window.parent.postMessage({ type: "__edit_mode_dismissed" }, "*"); } catch (_) {}
  });

  document.body.appendChild(panel);

  // ── Protocol: listener BEFORE announce ──────────────────────
  window.addEventListener("message", (e) => {
    if (!e.data || typeof e.data !== "object") return;
    if (e.data.type === "__activate_edit_mode")   panel.removeAttribute("hidden");
    if (e.data.type === "__deactivate_edit_mode") panel.setAttribute("hidden", "");
  });

  applyTweaks(state);
  syncButtons();

  try {
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
  } catch (_) {}
})();
