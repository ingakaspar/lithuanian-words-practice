/* Renders the multi-select frequency band <select> as:
     [    All groups    ]      ← single full-width pill
     [0][1][2][3][4][5][6][7][8][9]   ← 10-col digit grid

   Multi-select rules:
     • Clicking "All groups" selects ONLY "all" (clears every digit).
     • Clicking a digit toggles that digit; if any digit is on, "all"
       is removed.
     • If the user toggles the last remaining digit off, we fall back
       to "all" so the practice queue never empties.
     • The whole row of digits acts dimmed/scale-like while "all" is
       the source of truth (styled in CSS via [data-all="true"]).

   The hidden <select id="wordGroupSelect" multiple> remains the source
   of truth so app.js keeps reading .selectedOptions and listening for
   'change'. */

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

  function digitLabel(value) {
    const n = Number(value);
    return Number.isFinite(n) ? String(Math.floor(n / 100)) : String(value);
  }

  function describe(value) {
    if (value === "all") return DESCRIPTIONS.all;
    return DESCRIPTIONS[Number(value)] || `Group ${digitLabel(value)}`;
  }

  function selectedValues() {
    return [...select.selectedOptions].map((o) => o.value);
  }

  function setSelection(values) {
    // values: array of option values to mark selected (others cleared).
    const set = new Set(values);
    for (const opt of select.options) {
      opt.selected = set.has(opt.value);
    }
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function onChipClick(value) {
    const current = new Set(selectedValues());
    if (value === "all") {
      setSelection(["all"]);
      return;
    }
    // Toggle a numeric group; drop "all" if it was on.
    current.delete("all");
    if (current.has(value)) current.delete(value);
    else current.add(value);
    if (!current.size) {
      setSelection(["all"]); // fallback so the queue is never empty
    } else {
      setSelection([...current]);
    }
  }

  function makeChip(opt, isAll) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.value = opt.value;
    btn.title = describe(opt.value);
    btn.setAttribute("role", "checkbox");
    if (isAll) {
      btn.className = "freq-chip-all";
      btn.textContent = "All groups";
    } else {
      btn.className = "freq-chip";
      btn.textContent = digitLabel(opt.value);
    }
    btn.addEventListener("click", () => onChipClick(opt.value));
    return btn;
  }

  function render() {
    chipsEl.innerHTML = "";
    const opts = [...select.options];
    const allOpt = opts.find((o) => o.value === "all");
    const numericOpts = opts.filter((o) => o.value !== "all");

    if (allOpt) chipsEl.appendChild(makeChip(allOpt, true));
    if (numericOpts.length) {
      const grid = document.createElement("div");
      grid.className = "freq-grid";
      for (const opt of numericOpts) grid.appendChild(makeChip(opt, false));
      chipsEl.appendChild(grid);
    }
    syncActive();
  }

  function syncActive() {
    const sel = new Set(selectedValues());
    const allOn = sel.has("all") || sel.size === 0;
    chipsEl.dataset.all = allOn ? "true" : "false";
    chipsEl.querySelectorAll("button").forEach((c) => {
      const v = c.dataset.value;
      const on = v === "all" ? allOn : sel.has(v);
      c.classList.toggle("active", on);
      c.setAttribute("aria-checked", on ? "true" : "false");
    });

    if (hintEl) {
      if (allOn) {
        hintEl.textContent = describe("all");
      } else if (sel.size === 1) {
        hintEl.textContent = describe([...sel][0]);
      } else {
        const digits = [...sel].map(digitLabel).sort().join(" · ");
        hintEl.textContent = `Groups ${digits}`;
      }
    }
  }

  new MutationObserver(render).observe(select, { childList: true });
  select.addEventListener("change", syncActive);

  render();
})();
