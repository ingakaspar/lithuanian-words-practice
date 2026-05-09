/* Renders the frequency-band <select> as a chip rail.
   The hidden <select id="wordGroupSelect"> remains the source of truth
   so app.js continues to read .value and dispatch 'change' through it. */

(function () {
  const select = document.getElementById("wordGroupSelect");
  const chipsEl = document.getElementById("freqChips");
  const hintEl = document.getElementById("freqHint");
  if (!select || !chipsEl) return;

  const DESCRIPTIONS = {
    all: "All groups · mixed difficulty",
    0: "Helper words",
    100: "Most common",
    200: "Very common",
    300: "Common",
    400: "Mid-frequency",
    500: "Mid-frequency",
    600: "Less frequent",
    700: "Less frequent",
    800: "Advanced",
    900: "Rarest"
  };

  function chipLabel(value) {
    if (value === "all") return "All";
    const n = Number(value);
    return Number.isFinite(n) ? String(Math.floor(n / 100)) : String(value);
  }

  function describe(value) {
    if (value === "all") return DESCRIPTIONS.all;
    return DESCRIPTIONS[Number(value)] || `Group ${chipLabel(value)}`;
  }

  function render() {
    const opts = [...select.options];
    chipsEl.innerHTML = "";
    for (const opt of opts) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "freq-chip" + (opt.selected ? " active" : "");
      if (opt.value === "all") btn.classList.add("freq-chip-all");
      btn.dataset.value = opt.value;
      btn.textContent = chipLabel(opt.value);
      btn.title = describe(opt.value);
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", opt.selected ? "true" : "false");
      btn.addEventListener("click", () => {
        if (select.value === opt.value) return;
        select.value = opt.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      chipsEl.appendChild(btn);
    }
    syncActive();
  }

  function syncActive() {
    [...chipsEl.children].forEach((c) => {
      const on = c.dataset.value === select.value;
      c.classList.toggle("active", on);
      c.setAttribute("aria-checked", on ? "true" : "false");
    });
    if (hintEl) hintEl.textContent = describe(select.value);
  }

  // app.js rewrites <select>.innerHTML once data loads — re-render then.
  new MutationObserver(render).observe(select, { childList: true });
  select.addEventListener("change", syncActive);

  render();
})();
