let verbs = [];
let nouns = [];
let pronouns = [];
let verbsAll = [];
let nounsAll = [];
let pronounsAll = [];
let pdfStats = null;

/**
 * Used when pronouns_practice.json cannot be fetched (file://, wrong cwd, deploy gap).
 * Keep in sync with pronouns_practice.json; groups span all bands so frequency chips still match.
 */
const PRONOUNS_DEFAULT = [
  {
    lt: "aš",
    lt_ascii: "as",
    ru: "я",
    groups: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900],
    decl: {
      Singular: {
        Nominative: "aš",
        Genitive: "manęs|mano",
        Dative: "man",
        Accusative: "mane",
        Instrumental: "manimi",
        Locative: "manyje"
      },
      Plural: {}
    }
  },
  {
    lt: "tu",
    lt_ascii: "tu",
    ru: "ты",
    groups: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900],
    decl: {
      Singular: {
        Nominative: "tu",
        Genitive: "tavęs|tavo",
        Dative: "tau",
        Accusative: "tave",
        Instrumental: "tavimi",
        Locative: "tavyje"
      },
      Plural: {}
    }
  },
  {
    lt: "jis",
    lt_ascii: "jis",
    ru: "он",
    groups: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900],
    decl: {
      Singular: {
        Nominative: "jis",
        Genitive: "jo",
        Dative: "jam",
        Accusative: "jį",
        Instrumental: "juo",
        Locative: "jame"
      },
      Plural: {}
    }
  },
  {
    lt: "ji",
    lt_ascii: "ji",
    ru: "она",
    groups: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900],
    decl: {
      Singular: {
        Nominative: "ji",
        Genitive: "jos",
        Dative: "jai",
        Accusative: "ją",
        Instrumental: "ja",
        Locative: "joje"
      },
      Plural: {}
    }
  },
  {
    lt: "mes",
    lt_ascii: "mes",
    ru: "мы",
    groups: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900],
    decl: { Singular: {}, Plural: {
      Nominative: "mes",
      Genitive: "mūsų",
      Dative: "mums",
      Accusative: "mus",
      Instrumental: "mumis",
      Locative: "mumyse"
    } }
  },
  {
    lt: "jūs",
    lt_ascii: "jus",
    ru: "вы",
    groups: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900],
    decl: { Singular: {}, Plural: {
      Nominative: "jūs",
      Genitive: "jūsų",
      Dative: "jums",
      Accusative: "jus",
      Instrumental: "jumis",
      Locative: "jumyse"
    } }
  },
  {
    lt: "jie",
    lt_ascii: "jie",
    ru: "они (м. р.)",
    groups: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900],
    decl: { Singular: {}, Plural: {
      Nominative: "jie",
      Genitive: "jų",
      Dative: "jiems",
      Accusative: "juos",
      Instrumental: "jais",
      Locative: "juose"
    } }
  },
  {
    lt: "jos",
    lt_ascii: "jos",
    ru: "они (ж. р.)",
    groups: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900],
    decl: { Singular: {}, Plural: {
      Nominative: "jos",
      Genitive: "jų",
      Dative: "joms",
      Accusative: "jas",
      Instrumental: "jomis",
      Locative: "jose"
    } }
  }
];

const GROUP_LABELS = {
  0: "Group 0 - helper words",
  100: "Group 1 - most popular words",
  200: "Group 2 - next most popular",
  300: "Group 3 - medium-high frequency",
  400: "Group 4 - medium frequency",
  500: "Group 5 - medium-lower frequency",
  600: "Group 6 - less frequent",
  700: "Group 7 - less frequent",
  800: "Group 8 - advanced frequency",
  900: "Group 9 - rarest in this PDF set",
};

function updateHeroDataStats() {
  const statsEl = document.getElementById("dataStats");
  if (!statsEl) return;
  statsEl.textContent = "";
}

function getEntryGroups(entry) {
  const gs = Array.isArray(entry?.groups) ? entry.groups.map((x) => Number(x)).filter(Number.isFinite) : [];
  return gs.length ? gs : [0];
}

function collectAvailableGroups() {
  const set = new Set();
  for (const v of verbsAll) for (const g of getEntryGroups(v)) set.add(g);
  for (const n of nounsAll) for (const g of getEntryGroups(n)) set.add(g);
  for (const p of pronounsAll) for (const g of getEntryGroups(p)) set.add(g);
  return [...set].sort((a, b) => a - b);
}

function getSelectedGroups() {
  // Returns "all" or a Set<number> of selected group ids.
  if (!wordGroupSelect) return "all";
  const picked = new Set();
  for (const o of wordGroupSelect.selectedOptions || []) {
    if (o.value === "all") return "all";
    const n = Number(o.value);
    if (Number.isFinite(n)) picked.add(n);
  }
  if (!picked.size) return "all";
  return picked;
}

// Back-compat for any caller still using getSelectedGroup().
function getSelectedGroup() {
  const sel = getSelectedGroups();
  if (sel === "all") return "all";
  return [...sel][0];
}

function applyWordGroupFilter() {
  const selected = getSelectedGroups();
  if (selected === "all") {
    verbs = [...verbsAll];
    nouns = [...nounsAll];
    pronouns = [...pronounsAll];
    return;
  }
  const matches = (e) => getEntryGroups(e).some((g) => selected.has(g));
  verbs = verbsAll.filter(matches);
  nouns = nounsAll.filter(matches);
  pronouns = pronounsAll.filter(matches);
}

function renderGroupSelector() {
  if (!wordGroupSelect) return;
  const groups = collectAvailableGroups();
  const options = ['<option value="all" selected>All groups (0-900)</option>'];
  const nonZeroGroups = groups.filter((g) => g !== 0);
  const rankedLabels = [
    "most popular words",
    "next most popular",
    "medium-high frequency",
    "medium frequency",
    "medium-lower frequency",
    "less frequent",
    "less frequent",
    "advanced frequency",
    "rarest in this PDF set",
  ];

  function labelForGroup(groupId) {
    if (GROUP_LABELS[groupId]) {
      return GROUP_LABELS[groupId];
    }
    if (groupId === 0) {
      return "Group 0 - helper words";
    }
    const idx = nonZeroGroups.indexOf(groupId);
    if (idx >= 0) {
      const ordinal = idx + 1;
      const tail = rankedLabels[idx] || "frequency band";
      return `Group ${ordinal} - ${tail}`;
    }
    return `Group ${groupId}`;
  }

  for (const g of groups) {
    const meta = pdfStats?.group_counts?.[String(g)];
    const count = meta ? ` (${Number(meta.nouns_raw || 0) + Number(meta.verbs_raw || 0)} words in PDF)` : "";
    const label = labelForGroup(g);
    options.push(`<option value="${g}">${label}${count}</option>`);
  }
  wordGroupSelect.innerHTML = options.join("");
  // Keep "all" as a safe default after option list rebuild.
  for (const opt of wordGroupSelect.options) {
    opt.selected = opt.value === "all";
  }
}

const practiceModeSelect = document.getElementById("practiceMode");
const verbControls = document.getElementById("verbControls");
const nounControls = document.getElementById("nounControls");
const formSelect = document.getElementById("formSelect");
const nounCaseSelect = document.getElementById("nounCaseSelect");
const promptText = document.getElementById("promptText");
const personText = document.getElementById("personText");
const answerInput = document.getElementById("answerInput");
const checkBtn = document.getElementById("checkBtn");
const speakBtn = document.getElementById("speakBtn");
const hintBtn = document.getElementById("hintBtn");
const nextBtn = document.getElementById("nextBtn");
const resultText = document.getElementById("resultText");
const historyList = document.getElementById("historyList");
const nounMeta = document.getElementById("nounMeta");
const promptKicker = document.getElementById("promptKicker");
const wordGroupSelect = document.getElementById("wordGroupSelect");
const wordImageWrap = document.getElementById("wordImageWrap");
const wordImage = document.getElementById("wordImage");
const answerNumTag = document.getElementById("answerNumTag");

/** AbortController for in-flight image fetches (new question cancels previous). */
let wordImageAbort = null;

/** Short labels for the verb drill line (Lithuanian + English). */
const VERB_TENSE_UI = {
  present: { lt: "Esamasis", en: "present" },
  past: { lt: "Būtasis", en: "past" },
  future: { lt: "Būsimasis", en: "future" },
  usedTo: { lt: "Būdavo", en: "used to" },
  conditional: { lt: "Sąlyginis", en: "conditional" },
  imperative: { lt: "Liepiamoji", en: "imperative" }
};

function verbQuestionKicker(formType, personIdx) {
  const row = VERB_TENSE_UI[formType];
  const tense = row ? `${row.lt} (${row.en})` : String(formType);
  const who = ltPronounsDiacritic[personIdx] || "—";
  return `Conjugate · ${tense} · ${who}`;
}

function stripParensForSearch(s) {
  return String(s || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function imageSearchQueryVerb(entry) {
  const ru = stripParensForSearch(entry.ru);
  const lt = String(entry.lt || "").trim();
  return [ru, lt].filter(Boolean).join(" ").trim() || lt;
}

function imageSearchQueryNoun(entry) {
  const en = stripParensForSearch(entry.en);
  const ru = stripParensForSearch(entry.ru);
  const lt = String(entry.decl?.Singular?.Nominative || entry.lt || "").trim();
  return [en, ru, lt].filter(Boolean).join(" ").trim() || lt;
}

function hideWordImage() {
  if (wordImageAbort) {
    try {
      wordImageAbort.abort();
    } catch {
      /* ignore */
    }
    wordImageAbort = null;
  }
  if (wordImageWrap) wordImageWrap.hidden = true;
  if (wordImage) {
    wordImage.removeAttribute("src");
    wordImage.alt = "";
  }
}

async function fetchGoogleCseFirstImageUrl(query, signal) {
  const cfg = window.APP_CONFIG || {};
  const key = String(cfg.GOOGLE_CSE_API_KEY || "").trim();
  const cx = String(cfg.GOOGLE_CSE_CX || "").trim();
  if (!key || !cx) return null;
  const q = String(query || "").trim().slice(0, 120);
  if (!q) return null;
  const url =
    "https://www.googleapis.com/customsearch/v1" +
    `?key=${encodeURIComponent(key)}` +
    `&cx=${encodeURIComponent(cx)}` +
    `&q=${encodeURIComponent(q)}` +
    "&searchType=image&num=1&safe=active";
  try {
    const r = await fetch(url, { signal, cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    const item = j.items && j.items[0];
    return item && item.link ? String(item.link) : null;
  } catch {
    return null;
  }
}

async function fetchCommonsFirstImageUrl(query, signal) {
  const q = String(query || "").trim().slice(0, 120);
  if (!q) return null;
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*" +
    "&generator=search&gsrnamespace=6&gsrlimit=1" +
    `&gsrsearch=${encodeURIComponent(q)}` +
    "&prop=imageinfo&iiprop=url|thumburl&iiurlwidth=360";
  try {
    const r = await fetch(url, { signal, cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    const pages = j.query && j.query.pages;
    if (!pages || typeof pages !== "object") return null;
    const first = Object.values(pages)[0];
    const info = first && first.imageinfo && first.imageinfo[0];
    if (!info) return null;
    return String(info.thumburl || info.url || "").trim() || null;
  } catch {
    return null;
  }
}

async function loadWordImageForQuery(query) {
  if (!wordImage || !wordImageWrap) return;
  hideWordImage();
  const q = String(query || "").trim();
  if (!q) return;
  const ac = new AbortController();
  wordImageAbort = ac;
  const signal = ac.signal;

  let url = await fetchGoogleCseFirstImageUrl(q, signal);
  if (!signal.aborted && !url) {
    url = await fetchCommonsFirstImageUrl(q, signal);
  }
  if (signal.aborted || !url) {
    hideWordImage();
    return;
  }
  wordImage.alt = q;
  wordImage.src = url;
  wordImageWrap.hidden = false;
}

const NOUN_CASE_ORDER = [
  "Genitive",
  "Dative",
  "Accusative",
  "Instrumental",
  "Locative",
  "Vocative"
];

const DEFAULT_NOUN_ANSWER_PLACEHOLDER = "Įrašyk linksnio formą";

const VERB_ANSWER_PLACEHOLDER = "Įrašyk formą";

/**
 * Frames per case: natural Lithuanian + short English tag.
 * Locative skips person-words; vocative only uses person-like lemmas (see newNounQuestion).
 */
const NOUN_CASE_DRILLS = {
  Genitive: [
    {
      reason: "negation / absence (nėra + ko)",
      singular: "Čia nėra _____.",
      plural: "Čia nėra _____.",
      singularRu: "Здесь нет «{ru}».",
      pluralRu: "Здесь нет «{ru}»."
    },
    {
      reason: "absence (nebėra)",
      singular: "Dabar nebėra _____.",
      plural: "Dabar nebėra _____.",
      singularRu: "Сейчас уже нет «{ru}».",
      pluralRu: "Сейчас уже нет «{ru}»."
    },
    {
      reason: "need (reikėti + ko)",
      singular: "Man reikia _____.",
      plural: "Mums reikia _____.",
      singularRu: "Мне нужно «{ru}» (в литовском — родительный падеж).",
      pluralRu: "Нам нужно «{ru}» (в литовском — родительный падеж мн. числа)."
    },
    {
      reason: "not having (neturėti + ko)",
      singular: "Aš neturiu _____.",
      plural: "Mes neturime _____.",
      singularRu: "У меня нет «{ru}».",
      pluralRu: "У нас нет «{ru}»."
    },
    {
      reason: "searching (ieškoti + ko)",
      singular: "Aš ieškau _____.",
      plural: "Mes ieškome _____.",
      singularRu: "Я ищу «{ru}» (кого/чего).",
      pluralRu: "Мы ищем «{ru}» (кого/чего)."
    },
    {
      reason: "without (be + ko)",
      singular: "Be _____ negalima gyventi.",
      plural: "Be _____ negalima gyventi.",
      singularRu: "Без «{ru}» нельзя жить.",
      pluralRu: "Без «{ru}» нельзя жить."
    }
  ],
  Dative: [
    {
      reason: "importance (svarbu + kam)",
      singular: "Tai svarbu _____.",
      plural: "Tai svarbu _____.",
      singularRu: "Это важно для «{ru}».",
      pluralRu: "Это важно для «{ru}»."
    },
    {
      reason: "usefulness (naudinga + kam)",
      singular: "Tai naudinga _____.",
      plural: "Tai naudinga _____.",
      singularRu: "Это полезно для «{ru}».",
      pluralRu: "Это полезно для «{ru}»."
    },
    {
      reason: "giving a gift (duoti kam)",
      singular: "Aš duodu dovaną _____.",
      plural: "Mes duodame dovanas _____.",
      singularRu: "Я дарю подарок «{ru}» (кому).",
      pluralRu: "Я дарю подарки «{ru}» (кому)."
    },
    {
      reason: "writing to (rašyti kam)",
      singular: "Aš rašau laišką _____.",
      plural: "Mes rašome laiškus _____.",
      singularRu: "Я пишу письмо «{ru}» (кому).",
      pluralRu: "Мы пишем письма «{ru}» (кому)."
    },
    {
      reason: "reporting news (pranešti kam)",
      singular: "Aš pranešu naujieną _____.",
      plural: "Mes pranešame naujieną _____.",
      singularRu: "Я сообщаю новость «{ru}» (кому).",
      pluralRu: "Мы сообщаем новость «{ru}» (кому)."
    }
  ],
  Accusative: [
    {
      reason: "seeing (matyti + ką)",
      singular: "Aš matau _____.",
      plural: "Aš matau _____.",
      singularRu: "Я вижу «{ru}» (винительный падеж).",
      pluralRu: "Я вижу «{ru}» (винительный падеж мн. числа)."
    },
    {
      reason: "reading about (skaityti apie + ką)",
      singular: "Aš skaitau straipsnį apie _____.",
      plural: "Aš skaitau straipsnį apie _____.",
      singularRu: "Я читаю статью про «{ru}».",
      pluralRu: "Я читаю статью про «{ru}»."
    },
    {
      reason: "having (turėti + ką)",
      singular: "Aš turiu _____.",
      plural: "Mes turime _____.",
      singularRu: "У меня есть «{ru}» (как прямой объект).",
      pluralRu: "У нас есть «{ru}»."
    },
    {
      reason: "buying (pirkti + ką)",
      singular: "Aš perku _____.",
      plural: "Aš perku _____.",
      singularRu: "Я покупаю «{ru}».",
      pluralRu: "Я покупаю «{ru}»."
    },
    {
      reason: "visiting (lankyti + ką)",
      singular: "Aš lankau _____.",
      plural: "Mes lankome _____.",
      singularRu: "Я посещаю «{ru}».",
      pluralRu: "Мы посещаем «{ru}»."
    }
  ],
  Instrumental: [
    {
      reason: "interest (domėtis + kuo)",
      singular: "Aš domiuosi _____.",
      plural: "Mes domimės _____.",
      singularRu: "Я интересуюсь «{ru}» (творительный падеж: чем).",
      pluralRu: "Мы интересуемся «{ru}»."
    },
    {
      reason: "came with (su + kuo)",
      singular: "Aš atėjau su _____.",
      plural: "Mes atėjome su _____.",
      singularRu: "Я пришёл с «{ru}» (с кем / с чем).",
      pluralRu: "Мы пришли с «{ru}»."
    },
    {
      reason: "occupation (užsiimti + kuo)",
      singular: "Aš užsiimu _____.",
      plural: "Mes užsiimame _____.",
      singularRu: "Я занимаюсь «{ru}» (чем).",
      pluralRu: "Мы занимаемся «{ru}»."
    },
    {
      reason: "using (naudotis + kuo)",
      singular: "Aš naudojuosi _____.",
      plural: "Mes naudojamės _____.",
      singularRu: "Я пользуюсь «{ru}» (чем).",
      pluralRu: "Мы пользуемся «{ru}»."
    },
    {
      reason: "talking with (kalbėtis su + kuo)",
      singular: "Aš kalbuosi su _____.",
      plural: "Mes kalbamės su _____.",
      singularRu: "Я разговариваю с «{ru}».",
      pluralRu: "Мы разговариваем с «{ru}»."
    }
  ],
  Locative: [
    {
      reason: "living (gyventi kur)",
      singular: "Aš gyvenu _____.",
      plural: "Mes gyvename _____.",
      singularRu: "Я живу в / на «{ru}» (местный падеж).",
      pluralRu: "Мы живём в / на «{ru}»."
    },
    {
      reason: "working (dirbti kur)",
      singular: "Šiandien aš dirbu _____.",
      plural: "Šiandien mes dirbame _____.",
      singularRu: "Сегодня я работаю в «{ru}».",
      pluralRu: "Сегодня мы работаем в «{ru}»."
    },
    {
      reason: "finding peace (būti kur)",
      singular: "Randu ramybę _____.",
      plural: "Randame ramybę _____.",
      singularRu: "Нахожу покой в «{ru}».",
      pluralRu: "Находим покой в «{ru}»."
    },
    {
      reason: "meeting (susitikti kur)",
      singular: "Susitinkame _____.",
      plural: "Susitinkame _____.",
      singularRu: "Встречаемся в «{ru}».",
      pluralRu: "Встречаемся в «{ru}»."
    },
    {
      reason: "film on (rodyti kur)",
      singular: "Filmas rodomas _____.",
      plural: "Filmai rodomi _____.",
      singularRu: "Фильм показывают в «{ru}».",
      pluralRu: "Фильмы показывают в «{ru}»."
    }
  ],
  Vocative: [
    {
      reason: "greeting",
      singular: "Labas, _____!",
      plural: "Labas, _____!",
      singularRu: "Привет, «{ru}»! (обращение).",
      pluralRu: "Привет, «{ru}»!"
    },
    {
      reason: "calling",
      singular: "Ei, _____!",
      plural: "Ei, _____!",
      singularRu: "Эй, «{ru}»!",
      pluralRu: "Эй, «{ru}»!"
    },
    {
      reason: "thanks + address",
      singular: "Ačiū, _____!",
      plural: "Ačiū, _____!",
      singularRu: "Спасибо, «{ru}»!",
      pluralRu: "Спасибо, «{ru}»!"
    },
    {
      reason: "wait (imperative + voc)",
      singular: "Palauk, _____!",
      plural: "Palaukite, _____!",
      singularRu: "Подожди, «{ru}»!",
      pluralRu: "Подождите, «{ru}»!"
    },
    {
      reason: "farewell",
      singular: "Iki, _____!",
      plural: "Iki, _____!",
      singularRu: "Пока, «{ru}»!",
      pluralRu: "Пока, «{ru}»!"
    }
  ]
};

let state = {
  practiceMode: "verbs",
  currentEntry: null,
  currentForm: null,
  currentPersonIdx: null,
  expectedAnswers: [],
  answerPrefix: "",
  nounEntry: null,
  nounCase: null,
  nounNumber: null,
  nounExpected: "",
  nounSentence: "",
  nounSentenceEn: "",
  nounReason: "",
  pronounEntry: null,
  pronounCase: null,
  pronounNumber: null,
  pronounExpectedVariants: [],
  hintShown: false,
  /** Count of „Tikrinti“ presses on the current question (for first-try weighting). */
  checksThisQuestion: 0,
  /**
   * After a correct check, set to true in a microtask so a duplicate click listener
   * in the same event turn cannot advance before feedback is shown.
   */
  correctFeedbackAcknowledged: false
};

let historyItems = [];

const ltPronouns = ["as", "tu", "jis", "mes", "jus", "jie"];
const ltPronounsDiacritic = ["aš", "tu", "jis", "mes", "jūs", "jie"];
const ltPronounsAlt = {
  2: ["ji"],
  5: ["jos"]
};

function normalize(text) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function safeFocus(el) {
  if (!el || typeof el.focus !== "function") return;
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getTtsProxyUrl() {
  const cfg = window.APP_CONFIG || {};
  const url = typeof cfg.TTS_PROXY_URL === "string" ? cfg.TTS_PROXY_URL.trim() : "";
  return url;
}

/**
 * Optional parentheses in conjugator output, e.g. imtum(ei) -> imtum, imtumei.
 */
function expandOptionalParensAll(s) {
  if (!s || typeof s !== "string" || !s.includes("(")) {
    return [s];
  }
  const out = new Set();
  function rec(str) {
    const m = str.match(/^(.*?)\(([^)]+)\)(.*)$/);
    if (!m) {
      out.add(str);
      return;
    }
    const pre = m[1];
    const inner = m[2];
    const post = m[3];
    rec(pre + inner + post);
    rec(pre + post);
  }
  rec(s);
  return [...out];
}

function buildVerbExpectedAnswers(ltForm, personIdx, formType) {
  const variants =
    formType === "conditional" ? expandOptionalParensAll(ltForm) : [ltForm];
  const ordered = [];
  const seenNorm = new Set();
  function pushVariant(str) {
    if (!str || !String(str).trim()) return;
    const t = str.trim();
    const n = normalize(t);
    if (seenNorm.has(n)) return;
    seenNorm.add(n);
    ordered.push(t);
  }
  for (const f of variants) {
    if (!f || !String(f).trim()) continue;
    pushVariant(`${ltPronounsDiacritic[personIdx]} ${f}`);
    pushVariant(`${ltPronouns[personIdx]} ${f}`);
    if (ltPronounsAlt[personIdx]) {
      for (const alt of ltPronounsAlt[personIdx]) {
        pushVariant(`${alt} ${f}`);
      }
    }
    pushVariant(f);
  }
  if (ordered.length === 0 && ltForm && String(ltForm).trim()) {
    pushVariant(`${ltPronounsDiacritic[personIdx]} ${ltForm}`);
    pushVariant(ltForm);
  }
  return ordered;
}

function verbInputPlaceholder(formType) {
  if (formType === "conditional") {
    return "Sąlyginė forma (pvz. daryčiau, aš daryčiau)…";
  }
  if (formType === "imperative") {
    return "Liepiamoji forma (pvz. daryk, tu daryk)…";
  }
  return VERB_ANSWER_PLACEHOLDER;
}

function verbReferenceFormsHTML(entry, formType) {
  if (formType === "conditional") {
    const a = generateLtForm(entry, "conditional", 0);
    const t = generateLtForm(entry, "conditional", 2);
    return `${entry.lt} · sąlyg.: ${a || "—"} · ${t || "—"}`;
  }
  if (formType === "imperative") {
    const tu = generateLtForm(entry, "imperative", 1);
    const jus = generateLtForm(entry, "imperative", 4);
    return `${entry.lt} · liep.: ${tu || "—"} · ${jus || "—"}`;
  }
  const ps = generateLtForm(entry, "present", 5);
  const pt = generateLtForm(entry, "past", 5);
  return `${entry.lt} | ${ps || "—"} | ${pt || "—"}`;
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

const LS_WEIGHTS_NOUNS = "ltPractice_weights_nouns_v1";
const LS_WEIGHTS_VERBS = "ltPractice_weights_verbs_v1";
const LS_WEIGHTS_PRONOUNS = "ltPractice_weights_pronouns_v1";

let cachedNounWeights = null;
let cachedVerbWeights = null;
let cachedPronounWeights = null;

function loadWordWeights(key) {
  try {
    const raw = localStorage.getItem(key);
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

function saveWordWeights(key, obj) {
  try {
    localStorage.setItem(key, JSON.stringify(obj));
  } catch {
    /* private mode / quota */
  }
}

function nounWeights() {
  if (!cachedNounWeights) cachedNounWeights = loadWordWeights(LS_WEIGHTS_NOUNS);
  return cachedNounWeights;
}

function verbWeights() {
  if (!cachedVerbWeights) cachedVerbWeights = loadWordWeights(LS_WEIGHTS_VERBS);
  return cachedVerbWeights;
}

function pronounWeights() {
  if (!cachedPronounWeights) cachedPronounWeights = loadWordWeights(LS_WEIGHTS_PRONOUNS);
  return cachedPronounWeights;
}

function wordWeightKeyNoun(entry) {
  return entry.lt_ascii || entry.decl?.Singular?.Nominative || entry.lt || "";
}

function wordWeightKeyVerb(entry) {
  return entry.lt_ascii || entry.lt || "";
}

function wordWeightKeyPronoun(entry) {
  return entry.lt_ascii || entry.lt || pronounLemmaDisplay(entry) || "";
}

function getWordWeight(weights, lemmaKey) {
  const w = weights[lemmaKey];
  if (typeof w === "number" && w > 0 && Number.isFinite(w)) return w;
  return 1;
}

function clampWordWeight(w) {
  return Math.min(6, Math.max(0.12, w));
}

/**
 * Lower weight after first-try success; raise after mistakes (stronger on first wrong).
 */
function applyAnswerToWordWeights(weights, lemmaKey, { firstTry, isCorrect }) {
  if (!lemmaKey) return;
  let w = getWordWeight(weights, lemmaKey);
  if (firstTry && isCorrect) {
    w *= 0.62;
  } else if (firstTry && !isCorrect) {
    w *= 1.9;
  } else if (!isCorrect) {
    w *= 1.22;
  } else {
    w *= 0.88;
  }
  weights[lemmaKey] = clampWordWeight(w);
}

function weightedRandomChoice(items, weights, keyFn) {
  if (!items || items.length === 0) return null;
  if (items.length === 1) return items[0];
  let total = 0;
  const ws = items.map((it) => {
    const k = keyFn(it);
    const raw = Math.max(0.12, getWordWeight(weights, k));
    total += raw;
    return raw;
  });
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i += 1) {
    r -= ws[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** Lemmas where locative “in the X” is odd, and vocative address is natural. */
const PERSON_LIKE_LEMMAS = new Set([
  "zmogus",
  "vyras",
  "moteris",
  "vaikas",
  "berniukas",
  "mergina",
  "vaikinas",
  "sunus",
  "brolis",
  "sesuo",
  "teta",
  "senelis",
  "draugas",
  "mama",
  "motina",
  "zmona",
  "seima",
  "meistras",
  "narys"
]);

function isPersonLikeLemma(ltAscii) {
  return PERSON_LIKE_LEMMAS.has(String(ltAscii || "").toLowerCase());
}

/** Rough gender hint from singular nominative ending (learner aid, not exhaustive). */
function guessNounGender(nomSg) {
  const n = String(nomSg || "")
    .toLowerCase()
    .normalize("NFC");
  if (!n) return "?";
  if (/a$|ė$/.test(n)) return "f";
  if (/as$|is$|ys$|us$/.test(n)) return "m";
  return "?";
}

function nounGenderLabel(genderCode) {
  if (genderCode === "f") return "feminine";
  if (genderCode === "m") return "masculine";
  return "unknown gender";
}

/** One compact translation line under the noun prompt. */
function nounHeaderLine(entry) {
  const nomSg = entry.decl.Singular.Nominative;
  const storedGender = String(entry.gender || "").trim().toLowerCase();
  const g = storedGender === "m" || storedGender === "f" ? storedGender : guessNounGender(nomSg);
  const ru = String(entry.ru || "").trim();
  const en = String(entry.en || "").trim();
  const core = en ? `${en} ${ru}` : ru;
  return `${core} (${nounGenderLabel(g)})`;
}

function nounPromptWithNumberTag(sentence, nounNumber) {
  const tag = nounNumber === "Plural" ? "(pl)" : "(sg)";
  return `${String(sentence).trimEnd()} ${tag}`;
}

/** Singular + plural surface forms for one grammatical case (feedback after check). */
function nounThisCaseFormsLine(entry, nounCase) {
  const sg = entry.decl && entry.decl.Singular;
  const pl = entry.decl && entry.decl.Plural;
  if (!sg) return "sg. — · pl. —";
  const sgForm = (sg[nounCase] && String(sg[nounCase]).trim()) || "—";
  const plForm =
    pl && pl[nounCase] && String(pl[nounCase]).trim() ? String(pl[nounCase]).trim() : "—";
  return `sg. ${sgForm} · pl. ${plForm}`;
}

function longestCommonPrefix2(a, b) {
  const A = String(a ?? "");
  const B = String(b ?? "");
  let i = 0;
  const lim = Math.min(A.length, B.length);
  while (i < lim && A[i] === B[i]) i += 1;
  return i;
}

/**
 * Placeholder / light hint: singular and plural surface endings for this case
 * (shared prefix of the sg and pl forms in that case is stripped).
 */
function nounCaseEndingHint(entry, nounCase) {
  const sg = entry.decl && entry.decl.Singular;
  const pl = entry.decl && entry.decl.Plural;
  if (!sg) return DEFAULT_NOUN_ANSWER_PLACEHOLDER;
  const sgForm = String(sg[nounCase] || "").trim();
  const plForm = pl && pl[nounCase] ? String(pl[nounCase]).trim() : "";
  if (!sgForm && !plForm) return DEFAULT_NOUN_ANSWER_PLACEHOLDER;
  if (!plForm) return sgForm || DEFAULT_NOUN_ANSWER_PLACEHOLDER;
  if (!sgForm) return plForm;
  const p = longestCommonPrefix2(sgForm, plForm);
  const eSg = sgForm.slice(p);
  const ePl = plForm.slice(p);
  if (eSg && ePl) return `${eSg} · ${ePl}`;
  if (eSg) return eSg;
  if (ePl) return ePl;
  return sgForm || DEFAULT_NOUN_ANSWER_PLACEHOLDER;
}

function parsePronounVariants(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  const s = String(raw).trim();
  if (!s) return [];
  if (s.includes("|")) {
    return s.split("|").map((x) => x.trim()).filter(Boolean);
  }
  return [s];
}

function pronounLemmaDisplay(entry) {
  const sg = entry.decl && entry.decl.Singular;
  const pl = entry.decl && entry.decl.Plural;
  const n =
    (sg && sg.Nominative && String(sg.Nominative).trim()) ||
    (pl && pl.Nominative && String(pl.Nominative).trim()) ||
    String(entry.lt || "").trim();
  return n || "—";
}

function pronounHeaderLine(entry) {
  const ru = String(entry.ru || "").trim();
  return ru || pronounLemmaDisplay(entry);
}

function pronounThisCaseFormsLine(entry, nounCase) {
  const sg = entry.decl && entry.decl.Singular;
  const pl = entry.decl && entry.decl.Plural;
  const sgRaw = sg && sg[nounCase] != null ? String(sg[nounCase]).trim() : "";
  const plRaw = pl && pl[nounCase] != null ? String(pl[nounCase]).trim() : "";
  const sgForm = sgRaw ? parsePronounVariants(sgRaw).join(" / ") : "—";
  const plForm = plRaw ? parsePronounVariants(plRaw).join(" / ") : "—";
  return `sg. ${sgForm} · pl. ${plForm}`;
}

function availablePronounNumbersForCase(entry, nounCase) {
  const out = [];
  for (const num of ["Singular", "Plural"]) {
    const d = entry.decl && entry.decl[num];
    if (!d) continue;
    if (parsePronounVariants(d[nounCase]).length) out.push(num);
  }
  return out;
}

const PRONOUN_RU_ANSWER_CUES = {
  as: {
    Singular: {
      Nominative: "я",
      Genitive: "меня · моего",
      Dative: "мне",
      Accusative: "меня",
      Instrumental: "мной",
      Locative: "во мне"
    }
  },
  tu: {
    Singular: {
      Nominative: "ты",
      Genitive: "тебя · твоего",
      Dative: "тебе",
      Accusative: "тебя",
      Instrumental: "тобой",
      Locative: "в тебе"
    }
  },
  jis: {
    Singular: {
      Nominative: "он",
      Genitive: "его · него",
      Dative: "ему",
      Accusative: "его · него",
      Instrumental: "им",
      Locative: "в нём"
    }
  },
  ji: {
    Singular: {
      Nominative: "она",
      Genitive: "её · неё",
      Dative: "ей",
      Accusative: "её · неё",
      Instrumental: "ею",
      Locative: "в ней"
    }
  },
  mes: {
    Plural: {
      Nominative: "мы",
      Genitive: "нас · нашего",
      Dative: "нам",
      Accusative: "нас",
      Instrumental: "нами",
      Locative: "в нас"
    }
  },
  jus: {
    Plural: {
      Nominative: "вы",
      Genitive: "вас · вашего",
      Dative: "вам",
      Accusative: "вас",
      Instrumental: "вами",
      Locative: "в вас"
    }
  },
  jie: {
    Plural: {
      Nominative: "они (м. р.)",
      Genitive: "их · них",
      Dative: "им",
      Accusative: "их · них",
      Instrumental: "ими",
      Locative: "в них"
    }
  },
  jos: {
    Plural: {
      Nominative: "они (ж. р.)",
      Genitive: "их · них",
      Dative: "им",
      Accusative: "их · них",
      Instrumental: "ими",
      Locative: "в них"
    }
  }
};

function pronounRussianAnswerCue(entry, number, caseName) {
  const k = String(entry.lt_ascii || entry.lt || "")
    .trim()
    .toLowerCase()
    .normalize("NFC");
  const grid = PRONOUN_RU_ANSWER_CUES[k];
  if (!grid) return "";
  const row = grid[number];
  if (!row) return "";
  const s = row[caseName];
  return s ? String(s).trim() : "";
}

/** Russian hint in the answer placeholder (spaces, no ·). */
function pronounRussianPlaceholder(entry, number, caseName) {
  const cue = pronounRussianAnswerCue(entry, number, caseName);
  if (!cue) return DEFAULT_NOUN_ANSWER_PLACEHOLDER;
  return cue.split(/\s*·\s*/).join(" ");
}

function syncAnswerNumTag() {
  if (!answerNumTag) return;
  if (state.nounEntry && state.nounCase) {
    answerNumTag.textContent = state.nounNumber === "Plural" ? "pl" : "sg";
    answerNumTag.hidden = false;
    return;
  }
  if (state.pronounEntry && state.pronounCase) {
    answerNumTag.textContent = state.pronounNumber === "Plural" ? "pl" : "sg";
    answerNumTag.hidden = false;
    return;
  }
  answerNumTag.textContent = "";
  answerNumTag.hidden = true;
}

/** Reset sg/pl chip for the current question (verbs / empty state hide it). */
function clearAnswerExtras() {
  syncAnswerNumTag();
}

function getPracticeMode() {
  const v = practiceModeSelect ? String(practiceModeSelect.value || "verbs") : "verbs";
  return v;
}

const COMING_SOON_MODES = {
  adjectives: { lt: "Būdvardžiai",    en: "Adjectives", blurb: "geras, didelė, mažas, gražus…" },
  adverbs:    { lt: "Prieveiksmiai",  en: "Adverbs",   blurb: "greitai, labai, dažnai, jau…" },
  numerals:   { lt: "Skaitvardžiai",  en: "Numerals",  blurb: "vienas, du, trys, penki…" }
};

function showComingSoonForMode(mode) {
  const meta = COMING_SOON_MODES[mode];
  if (!meta) return false;
  if (promptText) promptText.textContent = meta.lt;
  if (personText) personText.textContent = meta.en;
  if (nounMeta) {
    nounMeta.textContent =
      `Coming soon · ${meta.blurb}\nThis category is being parsed from the PDF — drills will land here next.`;
  }
  if (resultText) {
    resultText.textContent = "";
    resultText.className = "";
  }
  hideWordImage();
  state.correctFeedbackAcknowledged = false;
  if (answerInput) {
    answerInput.value = "";
    answerInput.placeholder = "—";
    answerInput.disabled = true;
  }
  clearAnswerExtras();
  state.answerPrefix = "";
  state.practiceMode = mode;
  state.currentEntry = null;
  state.nounEntry = null;
  state.pronounEntry = null;
  state.pronounCase = null;
  state.pronounNumber = null;
  state.pronounExpectedVariants = [];
  state.expectedAnswers = [];
  return true;
}

function ensureAnswerEnabled() {
  if (answerInput && answerInput.disabled) answerInput.disabled = false;
}

function updateModePanels() {
  const m = getPracticeMode();
  if (verbControls) verbControls.style.display = m === "verbs" ? "grid" : "none";
  if (nounControls) nounControls.style.display = m === "nouns" || m === "pronouns" ? "grid" : "none";
}

function generateLtForm(entry, formType, personIdx) {
  const table = entry[formType];
  if (!Array.isArray(table) || personIdx < 0 || personIdx >= table.length) {
    return "";
  }
  const cell = table[personIdx];
  if (cell === undefined || cell === null) {
    return "";
  }
  return String(cell).trim();
}

function verbHasAnyFormFor(entry, formType) {
  const t = entry[formType];
  if (!Array.isArray(t)) return false;
  for (let i = 0; i < 6; i += 1) {
    if (generateLtForm(entry, formType, i)) return true;
  }
  return false;
}

function randomPersonIdxWithForm(entry, formType) {
  const ok = [];
  for (let i = 0; i < 6; i += 1) {
    if (generateLtForm(entry, formType, i)) ok.push(i);
  }
  return ok.length ? randomChoice(ok) : null;
}

function renderHistory() {
  if (!historyList) return;
  if (historyItems.length === 0) {
    historyList.innerHTML = '<div class="history-item"><span class="meta">No answers yet.</span></div>';
    return;
  }
  historyList.innerHTML = historyItems
    .map((item) => {
      const status = item.isCorrect ? "correct" : "wrong";
      const statusText = item.isCorrect ? "OK" : "WRONG";
      const context = escapeHtml(item.context);
      const input = escapeHtml(item.input);
      const correct = escapeHtml(item.correct);
      return `<div class="history-item ${status}">
        <div><strong>${statusText}</strong> ${context}</div>
        <div class="meta">Your input: ${input} | Correct: ${correct}</div>
      </div>`;
    })
    .join("");
}

function formLabel(formType) {
  if (formType === "random") return "random";
  if (formType === "present") return "present";
  if (formType === "past") return "past";
  if (formType === "future") return "future";
  if (formType === "usedTo") return "used to";
  if (formType === "conditional") return "conditional";
  if (formType === "imperative") return "imperative";
  return formType;
}

function newVerbQuestion() {
  hideWordImage();
  clearAnswerExtras();
  state.pronounEntry = null;
  state.pronounCase = null;
  state.pronounNumber = null;
  state.pronounExpectedVariants = [];
  if (verbs.length === 0) {
    promptText.textContent = verbsAll.length
      ? "Нет доступных глаголов в текущих данных."
      : "Nėra veiksložodžių duomenų. Paleisk serverį iš aplanko: python3 -m http.server";
    personText.textContent = "";
    if (promptKicker) promptKicker.textContent = "Verbs";
    clearAnswerExtras();
    return;
  }
  const selectedFormType = formSelect.value;
  const availableFormTypes = ["present", "past", "future", "usedTo", "conditional", "imperative"];
  const candidateFormTypes =
    selectedFormType === "random" ? availableFormTypes : [selectedFormType];
  const eligibleFormTypes = candidateFormTypes.filter((ft) =>
    verbs.some((e) => verbHasAnyFormFor(e, ft))
  );
  const formType = eligibleFormTypes.length
    ? randomChoice(eligibleFormTypes)
    : selectedFormType === "random"
      ? "present"
      : selectedFormType;

  const pool = verbs.filter((e) => verbHasAnyFormFor(e, formType));
  if (!pool.length) {
    promptText.textContent =
      "Šiai formai nėra lentelių JSON faile. Atnaujink verbs_practice.json: paleisk python3 build_all_practice_data.py.";
    personText.textContent = "";
    if (promptKicker) promptKicker.textContent = "Verbs";
    if (resultText) {
      resultText.textContent = "";
      resultText.className = "";
    }
    state.correctFeedbackAcknowledged = false;
    clearAnswerExtras();
    return;
  }

  const vw = verbWeights();
  let entry = null;
  let personIdx = null;
  let ltForm = "";
  for (let tries = 0; tries < 120; tries += 1) {
    entry = weightedRandomChoice(pool, vw, wordWeightKeyVerb) || randomChoice(pool);
    personIdx = randomPersonIdxWithForm(entry, formType);
    if (personIdx === null) {
      continue;
    }
    ltForm = generateLtForm(entry, formType, personIdx);
    if (ltForm) {
      break;
    }
  }
  if (!ltForm || personIdx === null) {
    promptText.textContent =
      "Nepavyko sugeneruoti formos. Patikrink naršyklės talpyklą (bandyk perkrauti be talpyklos) ir ar verbs_practice.json turi šios paradigmos masyvus.";
    personText.textContent = "";
    if (promptKicker) promptKicker.textContent = "Verbs";
    if (resultText) {
      resultText.textContent = "";
      resultText.className = "";
    }
    state.correctFeedbackAcknowledged = false;
    clearAnswerExtras();
    return;
  }

  state.checksThisQuestion = 0;
  state.practiceMode = "verbs";
  state.currentEntry = entry;
  state.currentForm = formType;
  state.currentPersonIdx = personIdx;
  state.nounEntry = null;
  state.nounSentenceEn = "";
  state.hintShown = false;

  state.expectedAnswers = buildVerbExpectedAnswers(ltForm, personIdx, formType);

  state.answerPrefix = `${ltPronounsDiacritic[personIdx]} `;

  promptText.textContent = entry.lt;
  personText.textContent = `${entry.ru}`;
  if (promptKicker) promptKicker.textContent = verbQuestionKicker(formType, personIdx);
  if (nounMeta) nounMeta.textContent = "";
  resultText.textContent = "";
  resultText.className = "";
  state.correctFeedbackAcknowledged = false;
  if (answerInput) answerInput.placeholder = verbInputPlaceholder(formType);
  answerInput.value = state.answerPrefix;
  safeFocus(answerInput);
  const end = answerInput.value.length;
  try {
    answerInput.setSelectionRange(end, end);
  } catch {
    /* ignore */
  }
  void loadWordImageForQuery(imageSearchQueryVerb(entry));
  syncAnswerNumTag();
}

function pickNounCase() {
  const v = nounCaseSelect ? nounCaseSelect.value : "random";
  if (v === "random") {
    return randomChoice(NOUN_CASE_ORDER);
  }
  return v;
}

/** Personal pronouns have no vocative drill; map it to another case. */
function pickPronounCase() {
  const v = nounCaseSelect ? nounCaseSelect.value : "random";
  const orderNoVoc = NOUN_CASE_ORDER.filter((c) => c !== "Vocative");
  if (v === "random") {
    return randomChoice(orderNoVoc);
  }
  if (v === "Vocative") {
    return randomChoice(orderNoVoc);
  }
  return v;
}

function newNounQuestion() {
  hideWordImage();
  clearAnswerExtras();
  state.pronounEntry = null;
  state.pronounCase = null;
  state.pronounNumber = null;
  state.pronounExpectedVariants = [];
  if (nouns.length === 0) {
    promptText.textContent = nounsAll.length
      ? "Нет доступных существительных в текущих данных."
      : "Nėra daiktavardžių duomenų. Patikrink nouns_practice.json ir serverį (python3 -m http.server).";
    personText.textContent = "";
    if (promptKicker) promptKicker.textContent = "Nouns";
    if (answerInput) answerInput.placeholder = VERB_ANSWER_PLACEHOLDER;
    if (answerInput) answerInput.value = "";
    state.answerPrefix = "";
    state.nounEntry = null;
    state.nounCase = null;
    state.nounNumber = null;
    state.nounExpected = "";
    if (resultText) {
      resultText.textContent = "";
      resultText.className = "";
    }
    state.correctFeedbackAcknowledged = false;
    syncAnswerNumTag();
    return;
  }

  let tries = 0;
  let entry = null;
  let nounCase = null;
  let nounNumber = null;
  let expected = "";

  const vocativePool = nouns.filter((n) => n.lt_ascii && isPersonLikeLemma(n.lt_ascii));
  const nw = nounWeights();
  state.checksThisQuestion = 0;

  while (tries < 80) {
    nounCase = pickNounCase();
    nounNumber = Math.random() < 0.5 ? "Singular" : "Plural";
    entry =
      nounCase === "Vocative" && vocativePool.length > 0
        ? weightedRandomChoice(vocativePool, nw, wordWeightKeyNoun) || randomChoice(vocativePool)
        : weightedRandomChoice(nouns, nw, wordWeightKeyNoun) || randomChoice(nouns);
    if (nounCase === "Locative" && entry.lt_ascii && isPersonLikeLemma(entry.lt_ascii)) {
      tries += 1;
      continue;
    }
    const decl = entry.decl && entry.decl[nounNumber];
    if (!decl || !decl[nounCase]) {
      tries += 1;
      continue;
    }
    expected = decl[nounCase];
    if (expected && String(expected).trim()) {
      break;
    }
    tries += 1;
  }

  if (!entry || !expected) {
    promptText.textContent = "Nepavyko parinkti daiktavardžio. Pabandyk dar kartą.";
    personText.textContent = "";
    if (promptKicker) promptKicker.textContent = "Nouns";
    if (answerInput) answerInput.placeholder = VERB_ANSWER_PLACEHOLDER;
    if (answerInput) answerInput.value = "";
    state.answerPrefix = "";
    if (resultText) {
      resultText.textContent = "";
      resultText.className = "";
    }
    state.correctFeedbackAcknowledged = false;
    syncAnswerNumTag();
    return;
  }

  state.practiceMode = "nouns";
  state.nounEntry = entry;
  state.nounCase = nounCase;
  state.nounNumber = nounNumber;
  state.nounExpected = expected;
  state.nounSentence = "";
  state.nounReason = "";
  state.nounSentenceEn = `${entry.ru || ""}`;
  state.currentEntry = null;
  state.answerPrefix = "";
  state.hintShown = false;

  promptText.textContent = entry.decl.Singular.Nominative;
  personText.textContent = nounHeaderLine(entry);
  if (promptKicker) {
    const numTag = nounNumber === "Plural" ? "plural" : "singular";
    promptKicker.textContent = `Decline · ${nounCase} · ${numTag}`;
  }
  if (nounMeta) {
    nounMeta.textContent = "";
  }

  resultText.textContent = "";
  resultText.className = "";
  state.correctFeedbackAcknowledged = false;
  answerInput.value = "";
  if (answerInput) {
    answerInput.placeholder = nounCaseEndingHint(entry, nounCase);
  }
  safeFocus(answerInput);
  try {
    answerInput.setSelectionRange(0, 0);
  } catch {
    /* ignore */
  }
  syncAnswerNumTag();
  void loadWordImageForQuery(imageSearchQueryNoun(entry));
}

function newPronounQuestion() {
  hideWordImage();
  clearAnswerExtras();
  state.currentEntry = null;
  state.nounEntry = null;
  state.nounCase = null;
  state.nounNumber = null;
  state.nounExpected = "";
  if (pronouns.length === 0) {
    promptText.textContent = pronounsAll.length
      ? "Нет доступных местоимений в текущих данных."
      : "Nėra įvardžių duomenų. Patikrink pronouns_practice.json ir serverį (python3 -m http.server).";
    personText.textContent = "";
    if (promptKicker) promptKicker.textContent = "Įvardžiai · Pronouns";
    if (answerInput) answerInput.placeholder = VERB_ANSWER_PLACEHOLDER;
    if (answerInput) answerInput.value = "";
    state.answerPrefix = "";
    state.pronounEntry = null;
    state.pronounCase = null;
    state.pronounNumber = null;
    state.pronounExpectedVariants = [];
    if (resultText) {
      resultText.textContent = "";
      resultText.className = "";
    }
    state.correctFeedbackAcknowledged = false;
    syncAnswerNumTag();
    return;
  }

  let tries = 0;
  let entry = null;
  let pronounCase = null;
  let pronounNumber = null;
  let variants = [];
  const pw = pronounWeights();
  state.checksThisQuestion = 0;

  while (tries < 100) {
    pronounCase = pickPronounCase();
    entry = weightedRandomChoice(pronouns, pw, wordWeightKeyPronoun) || randomChoice(pronouns);
    const nums = availablePronounNumbersForCase(entry, pronounCase);
    if (!nums.length) {
      tries += 1;
      continue;
    }
    pronounNumber = randomChoice(nums);
    const cell = entry.decl && entry.decl[pronounNumber] && entry.decl[pronounNumber][pronounCase];
    variants = parsePronounVariants(cell);
    if (variants.length) {
      break;
    }
    tries += 1;
  }

  if (!entry || !variants.length) {
    promptText.textContent = "Nepavyko parinkti įvardžio. Pabandyk dar kartą.";
    personText.textContent = "";
    if (promptKicker) promptKicker.textContent = "Įvardžiai · Pronouns";
    if (answerInput) answerInput.placeholder = VERB_ANSWER_PLACEHOLDER;
    if (answerInput) answerInput.value = "";
    state.answerPrefix = "";
    state.pronounEntry = null;
    state.pronounCase = null;
    state.pronounNumber = null;
    state.pronounExpectedVariants = [];
    if (resultText) {
      resultText.textContent = "";
      resultText.className = "";
    }
    state.correctFeedbackAcknowledged = false;
    syncAnswerNumTag();
    return;
  }

  state.practiceMode = "pronouns";
  state.pronounEntry = entry;
  state.pronounCase = pronounCase;
  state.pronounNumber = pronounNumber;
  state.pronounExpectedVariants = variants;
  state.hintShown = false;

  promptText.textContent = pronounLemmaDisplay(entry);
  personText.textContent = pronounHeaderLine(entry);
  if (promptKicker) {
    const numTag = pronounNumber === "Plural" ? "plural" : "singular";
    promptKicker.textContent = `Įvardžiai · Pronouns · ${pronounCase} · ${numTag}`;
  }
  if (nounMeta) nounMeta.textContent = "";

  resultText.textContent = "";
  resultText.className = "";
  state.correctFeedbackAcknowledged = false;
  state.answerPrefix = "";
  answerInput.value = "";
  if (answerInput) {
    answerInput.placeholder = pronounRussianPlaceholder(entry, pronounNumber, pronounCase);
  }
  safeFocus(answerInput);
  try {
    answerInput.setSelectionRange(0, 0);
  } catch {
    /* ignore */
  }
  syncAnswerNumTag();
}

function newQuestion() {
  state.practiceMode = getPracticeMode();
  updateModePanels();
  if (showComingSoonForMode(state.practiceMode)) return;
  ensureAnswerEnabled();
  if (state.practiceMode === "nouns") {
    newNounQuestion();
  } else if (state.practiceMode === "pronouns") {
    newPronounQuestion();
  } else {
    newVerbQuestion();
  }
}

function showHint() {
  if (getPracticeMode() === "nouns" && state.nounEntry && state.nounCase) {
    const hint = nounCaseEndingHint(state.nounEntry, state.nounCase);
    personText.textContent = `${nounHeaderLine(state.nounEntry)} · Hint: ${hint}`;
    state.hintShown = true;
    return;
  }
  if (getPracticeMode() === "pronouns" && state.pronounEntry && state.pronounCase) {
    const hint = pronounRussianPlaceholder(state.pronounEntry, state.pronounNumber, state.pronounCase);
    personText.textContent = `${pronounHeaderLine(state.pronounEntry)} · Подсказка: ${hint}`;
    state.hintShown = true;
    return;
  }
  if (!state.currentEntry) {
    return;
  }
  let hintForm = generateLtForm(state.currentEntry, state.currentForm, 2);
  if (!hintForm) {
    const order =
      state.currentForm === "imperative" ? [1, 4, 3, 0, 5, 2] : [0, 1, 2, 3, 4, 5];
    for (const i of order) {
      hintForm = generateLtForm(state.currentEntry, state.currentForm, i);
      if (hintForm) break;
    }
  }
  const base = `${state.currentEntry.ru}`;
  personText.textContent = hintForm ? `${base} · Hint: ${hintForm}` : `${base} · Hint: -`;
  state.hintShown = true;
}

let ttsAudio = null;

function playFallbackTts(text) {
  const phrase = String(text || "").trim();
  if (!phrase) return;
  const url =
    "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=lt&q=" +
    encodeURIComponent(phrase.slice(0, 180));
  try {
    if (ttsAudio) {
      ttsAudio.pause();
      ttsAudio = null;
    }
    ttsAudio = new Audio(url);
    ttsAudio.play().catch(() => {
      /* ignore autoplay blocks */
    });
  } catch {
    /* ignore */
  }
}

async function speakViaProxy(text) {
  const endpoint = getTtsProxyUrl();
  if (!endpoint) return false;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: String(text || ""), lang: "lt-LT" })
    });
    if (!response.ok) return false;
    const blob = await response.blob();
    if (!blob || !blob.size) return false;
    if (ttsAudio) {
      ttsAudio.pause();
      ttsAudio = null;
    }
    const objectUrl = URL.createObjectURL(blob);
    ttsAudio = new Audio(objectUrl);
    ttsAudio.onended = () => URL.revokeObjectURL(objectUrl);
    ttsAudio.play().catch(() => URL.revokeObjectURL(objectUrl));
    return true;
  } catch {
    return false;
  }
}

async function speakCurrentWord() {
  let text = "";
  if (getPracticeMode() === "nouns") {
    text = state.nounEntry?.decl?.Singular?.Nominative || state.nounEntry?.lt || "";
  } else if (getPracticeMode() === "pronouns") {
    text = state.pronounEntry ? pronounLemmaDisplay(state.pronounEntry) : "";
  } else {
    text = state.currentEntry?.lt || "";
  }
  const phrase = String(text || "").trim();
  if (!phrase) return;

  const proxyOk = await speakViaProxy(phrase);
  if (proxyOk) return;

  // Primary path without backend: Google Translate TTS URL.
  playFallbackTts(phrase);

  return;
}

function checkVerbAnswer() {
  state.checksThisQuestion = (state.checksThisQuestion || 0) + 1;
  const firstTry = state.checksThisQuestion === 1;

  const guess = normalize(answerInput.value);
  const expectedNormalized = state.expectedAnswers.map((item) => normalize(item));
  const isCorrect = expectedNormalized.includes(guess);
  const rawInput = answerInput.value.trim() || "(empty)";

  const wkey = wordWeightKeyVerb(state.currentEntry);
  const vw = verbWeights();
  applyAnswerToWordWeights(vw, wkey, { firstTry, isCorrect });
  saveWordWeights(LS_WEIGHTS_VERBS, vw);

  historyItems.unshift({
    isCorrect,
    context: `${ltPronouns[state.currentPersonIdx]} ${state.currentEntry.lt} [${formLabel(state.currentForm)}]`,
    input: rawInput,
    correct: state.expectedAnswers[0]
  });
  renderHistory();

  const refLine = verbReferenceFormsHTML(state.currentEntry, state.currentForm);
  const safeRefLine = escapeHtml(refLine);
  const safeExpected = escapeHtml(state.expectedAnswers[0]);

  if (isCorrect) {
    resultText.innerHTML = `Teisingai!<br>Forms: ${safeRefLine}`;
    resultText.className = "ok";
    state.correctFeedbackAcknowledged = false;
    queueMicrotask(() => {
      state.correctFeedbackAcknowledged = true;
    });
  } else {
    resultText.innerHTML = `Neteisinga. Teisingas variantas: ${safeExpected}<br>Forms: ${safeRefLine}`;
    resultText.className = "bad";
    state.correctFeedbackAcknowledged = false;
  }
}

function checkNounAnswer() {
  if (!state.nounEntry) {
    resultText.textContent = "Pirma sugeneruok klausimą.";
    resultText.className = "bad";
    state.correctFeedbackAcknowledged = false;
    return;
  }
  state.checksThisQuestion = (state.checksThisQuestion || 0) + 1;
  const firstTry = state.checksThisQuestion === 1;

  const guess = normalize(answerInput.value);
  const expected = normalize(state.nounExpected);
  const isCorrect = guess === expected;
  const rawInput = answerInput.value.trim() || "(empty)";

  const wkey = wordWeightKeyNoun(state.nounEntry);
  const nw = nounWeights();
  applyAnswerToWordWeights(nw, wkey, { firstTry, isCorrect });
  saveWordWeights(LS_WEIGHTS_NOUNS, nw);

  historyItems.unshift({
    isCorrect,
    context: `${state.nounEntry.decl.Singular.Nominative} [${state.nounCase} ${state.nounNumber}]`,
    input: rawInput,
    correct: state.nounExpected
  });
  renderHistory();

  const caseForms = nounThisCaseFormsLine(state.nounEntry, state.nounCase);
  const safeCaseForms = escapeHtml(caseForms);
  const safeExpected = escapeHtml(state.nounExpected);
  const safeCase = escapeHtml(state.nounCase);

  if (isCorrect) {
    resultText.innerHTML = `Teisingai!<br>${safeCase}: ${safeCaseForms}`;
    resultText.className = "ok";
    state.correctFeedbackAcknowledged = false;
    queueMicrotask(() => {
      state.correctFeedbackAcknowledged = true;
    });
  } else {
    resultText.innerHTML = `Neteisinga. Teisingas variantas: ${safeExpected}<br>${safeCase}: ${safeCaseForms}`;
    resultText.className = "bad";
    state.correctFeedbackAcknowledged = false;
  }
}

function checkPronounAnswer() {
  if (!state.pronounEntry) {
    resultText.textContent = "Pirma sugeneruok klausimą.";
    resultText.className = "bad";
    state.correctFeedbackAcknowledged = false;
    return;
  }
  state.checksThisQuestion = (state.checksThisQuestion || 0) + 1;
  const firstTry = state.checksThisQuestion === 1;

  const guess = normalize(answerInput.value);
  const norms = state.pronounExpectedVariants.map((v) => normalize(v));
  const isCorrect = norms.some((n) => n === guess);
  const rawInput = answerInput.value.trim() || "(empty)";
  const displayCorrect = state.pronounExpectedVariants.join(" / ");

  const wkey = wordWeightKeyPronoun(state.pronounEntry);
  const pw = pronounWeights();
  applyAnswerToWordWeights(pw, wkey, { firstTry, isCorrect });
  saveWordWeights(LS_WEIGHTS_PRONOUNS, pw);

  historyItems.unshift({
    isCorrect,
    context: `${pronounLemmaDisplay(state.pronounEntry)} [${state.pronounCase} ${state.pronounNumber}]`,
    input: rawInput,
    correct: displayCorrect
  });
  renderHistory();

  const caseForms = pronounThisCaseFormsLine(state.pronounEntry, state.pronounCase);
  const safeCaseForms = escapeHtml(caseForms);
  const safeExpected = escapeHtml(displayCorrect);
  const safeCase = escapeHtml(state.pronounCase);

  if (isCorrect) {
    resultText.innerHTML = `Teisingai!<br>${safeCase}: ${safeCaseForms}`;
    resultText.className = "ok";
    state.correctFeedbackAcknowledged = false;
    queueMicrotask(() => {
      state.correctFeedbackAcknowledged = true;
    });
  } else {
    resultText.innerHTML = `Neteisinga. Teisingas variantas: ${safeExpected}<br>${safeCase}: ${safeCaseForms}`;
    resultText.className = "bad";
    state.correctFeedbackAcknowledged = false;
  }
}

function checkAnswer() {
  if (getPracticeMode() === "nouns") {
    if (!state.nounEntry) {
      resultText.textContent = "Pirma sugeneruok klausimą.";
      resultText.className = "bad";
      state.correctFeedbackAcknowledged = false;
      return;
    }
    checkNounAnswer();
    return;
  }
  if (getPracticeMode() === "pronouns") {
    if (!state.pronounEntry) {
      resultText.textContent = "Pirma sugeneruok klausimą.";
      resultText.className = "bad";
      state.correctFeedbackAcknowledged = false;
      return;
    }
    checkPronounAnswer();
    return;
  }
  if (!state.currentEntry) {
    resultText.textContent = "Pirma sugeneruok klausimą.";
    resultText.className = "bad";
    state.correctFeedbackAcknowledged = false;
    return;
  }
  checkVerbAnswer();
}

/** Same as Enter: first action checks; when result is already correct, advance to next. */
function handleCheckButtonClick() {
  if (resultText.classList.contains("ok")) {
    if (state.correctFeedbackAcknowledged) {
      state.correctFeedbackAcknowledged = false;
      newQuestion();
    }
    return;
  }
  checkAnswer();
}

async function loadData() {
  verbsAll = [];
  nounsAll = [];
  pronounsAll = [];
  verbs = [];
  nouns = [];
  pronouns = [];
  pdfStats = null;
  let verbLoadError = null;

  try {
    const statsResponse = await fetch("pdf_stats.json", { cache: "no-store" });
    if (statsResponse.ok) {
      pdfStats = await statsResponse.json();
    }
  } catch {
    /* optional */
  }

  try {
    const response = await fetch("verbs_practice.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Nepavyko užkrauti verbs_practice.json");
    }
    verbsAll = await response.json();
  } catch (error) {
    verbLoadError = error;
  }

  try {
    const response = await fetch("nouns_practice.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Nepavyko užkrauti nouns_practice.json");
    }
    nounsAll = await response.json();
  } catch {
    /* optional */
  }

  try {
    const response = await fetch("pronouns_practice.json", { cache: "no-store" });
    if (response.ok) {
      const parsed = await response.json();
      if (Array.isArray(parsed) && parsed.length) {
        pronounsAll = parsed;
      }
    }
  } catch {
    /* file:// or missing file */
  }
  if (!pronounsAll.length) {
    pronounsAll = PRONOUNS_DEFAULT.map((row) => JSON.parse(JSON.stringify(row)));
  }

  if (!verbsAll.length && !nounsAll.length && !pronounsAll.length) {
    promptText.textContent =
      "Nepavyko užkrauti duomenų. Paleisk serverį iš aplanko: python3 -m http.server";
    personText.textContent = verbLoadError && verbLoadError.message ? String(verbLoadError.message) : "";
    hideWordImage();
    return;
  }
  renderGroupSelector();
  applyWordGroupFilter();

  if (!verbs.length && nouns.length && practiceModeSelect) {
    practiceModeSelect.value = "nouns";
  } else if (!verbs.length && !nouns.length && pronouns.length && practiceModeSelect) {
    practiceModeSelect.value = "pronouns";
  }

  updateHeroDataStats();
  newQuestion();
}

let appEventListenersAttached = false;

function init() {
  if (!formSelect || !answerInput || !checkBtn || !hintBtn || !nextBtn || !historyList) {
    return;
  }
  if (appEventListenersAttached) {
    return;
  }
  appEventListenersAttached = true;

  if (wordImage && !wordImage.dataset.bound) {
    wordImage.dataset.bound = "1";
    wordImage.addEventListener("error", () => {
      hideWordImage();
    });
  }

  if (practiceModeSelect) {
    practiceModeSelect.addEventListener("change", () => {
      updateModePanels();
      newQuestion();
    });
  }
  if (nounCaseSelect) {
    nounCaseSelect.addEventListener("change", () => {
      if (getPracticeMode() === "nouns" || getPracticeMode() === "pronouns") {
        newQuestion();
      }
    });
  }
  if (wordGroupSelect) {
    wordGroupSelect.addEventListener("change", () => {
      applyWordGroupFilter();
      updateHeroDataStats();
      newQuestion();
    });
  }
  formSelect.addEventListener("change", () => {
    if (getPracticeMode() === "verbs") {
      newQuestion();
    }
  });
  checkBtn.addEventListener("click", handleCheckButtonClick);
  if (speakBtn) {
    speakBtn.addEventListener("click", speakCurrentWord);
  }
  hintBtn.addEventListener("click", showHint);
  nextBtn.addEventListener("click", newQuestion);
  answerInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    if (resultText.classList.contains("ok")) {
      if (!state.correctFeedbackAcknowledged) {
        return;
      }
      event.preventDefault();
      state.correctFeedbackAcknowledged = false;
      newQuestion();
      return;
    }
    checkAnswer();
  });

  answerInput.addEventListener("input", () => {
    if (resultText.classList.contains("bad")) {
      resultText.textContent = "";
      resultText.className = "";
    }
  });

  updateModePanels();
  clearAnswerExtras();
  renderHistory();
  loadData();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
