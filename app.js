let verbs = [];
let nouns = [];
let verbsAll = [];
let nounsAll = [];

/** Used only until pdf_group_ids.json loads or if that file is missing. */
const PDF_GROUPS_FALLBACK = [1, 2, 3, 4];
const LS_PDF_GROUPS = "ltPractice_pdfGroups";

let pdfGroupIdsEffective = [...PDF_GROUPS_FALLBACK];

function getPdfGroupIds() {
  return pdfGroupIdsEffective;
}

async function fetchPdfGroupIdsFromMeta() {
  try {
    const response = await fetch("pdf_group_ids.json", { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }
    const nums = [];
    for (const x of data) {
      const n = Number(x);
      if (!Number.isNaN(n)) {
        nums.push(n);
      }
    }
    if (nums.length === 0) {
      return null;
    }
    return [...new Set(nums)].sort((a, b) => a - b);
  } catch {
    return null;
  }
}

function recomputePdfGroupIdsFromLoadedData() {
  const u = new Set(getPdfGroupIds());
  for (const e of verbsAll) {
    const g = e && e.groups;
    if (Array.isArray(g)) {
      for (const x of g) {
        const n = Number(x);
        if (!Number.isNaN(n)) {
          u.add(n);
        }
      }
    }
  }
  for (const e of nounsAll) {
    const g = e && e.groups;
    if (Array.isArray(g)) {
      for (const x of g) {
        const n = Number(x);
        if (!Number.isNaN(n)) {
          u.add(n);
        }
      }
    }
  }
  pdfGroupIdsEffective = [...u].sort((a, b) => a - b);
}

function getEntryGroups(entry) {
  const g = entry && entry.groups;
  if (Array.isArray(g) && g.length) return g;
  return [...getPdfGroupIds()];
}

function getSelectedPdfGroupsFromUI() {
  return Array.from(document.querySelectorAll('input[name="pdfGroup"]:checked'), (b) =>
    Number(b.value)
  );
}

function setPdfGroupCheckboxes(values) {
  const set = new Set(values);
  document.querySelectorAll('input[name="pdfGroup"]').forEach((cb) => {
    cb.checked = set.has(Number(cb.value));
  });
}

function isValidStoredPdfGroups(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  const allowed = new Set(getPdfGroupIds());
  return arr.every((n) => {
    const num = Number(n);
    return !Number.isNaN(num) && allowed.has(num);
  });
}

function loadPdfGroupsFromStorage() {
  try {
    const raw = localStorage.getItem(LS_PDF_GROUPS);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!isValidStoredPdfGroups(arr)) return;
    setPdfGroupCheckboxes(arr.map((x) => Number(x)));
  } catch {
    /* ignore */
  }
}

function savePdfGroupsToStorage(selected) {
  try {
    localStorage.setItem(
      LS_PDF_GROUPS,
      JSON.stringify([...selected].sort((a, b) => a - b))
    );
  } catch {
    /* ignore */
  }
}

function entryMatchesPdfSelection(entry, selectedSet) {
  return getEntryGroups(entry).some((g) => selectedSet.has(g));
}

function applyPdfGroupFilter() {
  let selected = getSelectedPdfGroupsFromUI();
  if (selected.length === 0) {
    const all = getPdfGroupIds();
    setPdfGroupCheckboxes(all);
    selected = [...all];
    savePdfGroupsToStorage(selected);
  }
  const selectedSet = new Set(selected);
  verbs = verbsAll.filter((e) => entryMatchesPdfSelection(e, selectedSet));
  nouns = nounsAll.filter((e) => entryMatchesPdfSelection(e, selectedSet));
}

function updateHeroDataStats() {
  const statsEl = document.getElementById("dataStats");
  if (!statsEl) return;
  const parts = [];
  if (verbsAll.length) {
    parts.push(
      verbs.length === verbsAll.length
        ? `${verbs.length} veiksmažodžiai`
        : `${verbs.length} / ${verbsAll.length} veiksmažodžiai`
    );
  }
  if (nounsAll.length) {
    parts.push(
      nouns.length === nounsAll.length
        ? `${nouns.length} daiktavardžiai`
        : `${nouns.length} / ${nounsAll.length} daiktavardžiai`
    );
  }
  statsEl.textContent = parts.length
    ? `Įkelta (pasirinktos grupės): ${parts.join(" · ")}.`
    : "";
}

function onPdfGroupsChange() {
  if (!verbsAll.length && !nounsAll.length) {
    return;
  }
  let selected = getSelectedPdfGroupsFromUI();
  if (selected.length === 0) {
    const all = getPdfGroupIds();
    setPdfGroupCheckboxes(all);
    selected = [...all];
  }
  savePdfGroupsToStorage(selected);
  applyPdfGroupFilter();
  updateHeroDataStats();
  if (!verbs.length && !nouns.length) {
    promptText.textContent =
      "Pasirinktoms grupėms nėra žodžių. Pažymėk platesnį rinkinį grupių.";
    personText.textContent = "";
    return;
  }
  if (!verbs.length && nouns.length && practiceModeSelect) {
    practiceModeSelect.value = "nouns";
  }
  newQuestion();
}

function renderPdfGroupCheckboxes() {
  const host = document.getElementById("pdfGroupChecks");
  if (!host) return;
  const ids = getPdfGroupIds();
  host.innerHTML = ids
    .map(
      (g) =>
        `<label class="pdf-group-label"><input type="checkbox" name="pdfGroup" value="${g}" checked /> ${g}</label>`
    )
    .join("");
}

function ensurePdfGroupDelegation() {
  const host = document.getElementById("pdfGroupChecks");
  if (!host || host.dataset.pdfDelegated) {
    return;
  }
  host.dataset.pdfDelegated = "1";
  host.addEventListener("change", (ev) => {
    const t = ev.target;
    if (t && typeof t.matches === "function" && t.matches('input[name="pdfGroup"]')) {
      onPdfGroupsChange();
    }
  });
}

const practiceModeSelect = document.getElementById("practiceMode");
const verbControls = document.getElementById("verbControls");
const nounControls = document.getElementById("nounControls");
const formSelect = document.getElementById("formSelect");
const nounCaseSelect = document.getElementById("nounCaseSelect");
const newQuestionBtn = document.getElementById("newQuestionBtn");
const promptText = document.getElementById("promptText");
const personText = document.getElementById("personText");
const answerInput = document.getElementById("answerInput");
const checkBtn = document.getElementById("checkBtn");
const hintBtn = document.getElementById("hintBtn");
const nextBtn = document.getElementById("nextBtn");
const resultText = document.getElementById("resultText");
const historyList = document.getElementById("historyList");
const nounMeta = document.getElementById("nounMeta");

const NOUN_CASE_ORDER = [
  "Genitive",
  "Dative",
  "Accusative",
  "Instrumental",
  "Locative",
  "Vocative"
];

/** Lithuanian “case question” hints for the answer field (nouns). */
const NOUN_CASE_INPUT_PLACEHOLDER = {
  Genitive: "Ko? Kieno? — įrašyk kilmininko formą",
  Dative: "Kam? — įrašyk naudininko formą",
  Accusative: "Ką? — įrašyk galininko formą",
  Instrumental: "Kuo? — įrašyk įnagininko formą",
  Locative: "Kur? Kame? — įrašyk vietininko formą",
  Vocative: "Kreipinys — įrašyk kreipinio formą"
};

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
  hintShown: false,
  /** Count of „Tikrinti“ presses on the current question (for first-try weighting). */
  checksThisQuestion: 0
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

let cachedNounWeights = null;
let cachedVerbWeights = null;

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

function wordWeightKeyNoun(entry) {
  return entry.lt_ascii || entry.decl?.Singular?.Nominative || entry.lt || "";
}

function wordWeightKeyVerb(entry) {
  return entry.lt_ascii || entry.lt || "";
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

function interpolateDrillEn(template, enLemma) {
  if (!template) return "";
  return String(template).replace(/\{ru\}/g, enLemma || "");
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

/** Headword line: singular nominative + gender (answer number is on the sentence). */
function nounHeaderLine(entry) {
  const nomSg = entry.decl.Singular.Nominative;
  const g = guessNounGender(nomSg);
  return `${nomSg} (sg ${g}) ${entry.ru}`;
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

function getPracticeMode() {
  return practiceModeSelect && practiceModeSelect.value === "nouns" ? "nouns" : "verbs";
}

function updateModePanels() {
  const m = getPracticeMode();
  if (verbControls) verbControls.style.display = m === "verbs" ? "grid" : "none";
  if (nounControls) nounControls.style.display = m === "nouns" ? "grid" : "none";
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
      return `<div class="history-item ${status}">
        <div><strong>${statusText}</strong> ${item.context}</div>
        <div class="meta">Your input: ${item.input} | Correct: ${item.correct}</div>
      </div>`;
    })
    .join("");
}

function formLabel(formType) {
  if (formType === "present") return "present";
  if (formType === "past") return "past";
  if (formType === "future") return "future";
  if (formType === "usedTo") return "used to";
  if (formType === "conditional") return "conditional";
  if (formType === "imperative") return "imperative";
  return formType;
}

function newVerbQuestion() {
  if (verbs.length === 0) {
    promptText.textContent = verbsAll.length
      ? "Nėra veiksmažodžių pasirinktose grupėse. Pažymėk daugiau grupių viršuje."
      : "Nėra veiksložodžių duomenų. Paleisk serverį iš aplanko: python3 -m http.server";
    personText.textContent = "";
    return;
  }
  const formType = formSelect.value;

  const pool = verbs.filter((e) => verbHasAnyFormFor(e, formType));
  if (!pool.length) {
    promptText.textContent =
      "Šiai formai nėra lentelių JSON faile (conditional / imperative ir kt.). Atnaujink conjugations_group0_4.json: paleisk iš projekto aplanko python3 build_verb_conditional_imperative.py (arba python3 build_all_practice_data.py).";
    personText.textContent = "";
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
      "Nepavyko sugeneruoti formos. Patikrink naršyklės talpyklą (bandyk perkrauti be talpyklos) ir ar conjugations_group0_4.json turi šios paradigmos masyvus.";
    personText.textContent = "";
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
  personText.textContent = `EN: ${entry.ru}`;
  if (nounMeta) nounMeta.textContent = "";
  resultText.textContent = "";
  resultText.className = "";
  if (answerInput) answerInput.placeholder = verbInputPlaceholder(formType);
  answerInput.value = state.answerPrefix;
  answerInput.focus();
  const end = answerInput.value.length;
  try {
    answerInput.setSelectionRange(end, end);
  } catch {
    /* ignore */
  }
}

function pickNounCase() {
  const v = nounCaseSelect ? nounCaseSelect.value : "random";
  if (v === "random") {
    return randomChoice(NOUN_CASE_ORDER);
  }
  return v;
}

function newNounQuestion() {
  if (nouns.length === 0) {
    promptText.textContent = nounsAll.length
      ? "Nėra daiktavardžių pasirinktose grupėse. Pažymėk daugiau grupių viršuje."
      : "Nėra daiktavardžių duomenų. Patikrink nouns_group0_4.json ir serverį (python3 -m http.server).";
    personText.textContent = "";
    if (answerInput) answerInput.placeholder = VERB_ANSWER_PLACEHOLDER;
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
    if (answerInput) answerInput.placeholder = VERB_ANSWER_PLACEHOLDER;
    return;
  }

  const drills = NOUN_CASE_DRILLS[nounCase];
  const drill = Array.isArray(drills) ? randomChoice(drills) : drills;
  const sentence = nounNumber === "Plural" ? drill.plural : drill.singular;

  state.practiceMode = "nouns";
  state.nounEntry = entry;
  state.nounCase = nounCase;
  state.nounNumber = nounNumber;
  state.nounExpected = expected;
  state.nounSentence = sentence;
  state.nounReason = drill.reason;
  state.nounSentenceEn = `EN: ${entry.ru || ""}`;
  state.currentEntry = null;
  state.answerPrefix = "";
  state.hintShown = false;

  promptText.textContent = nounPromptWithNumberTag(sentence, nounNumber);
  personText.textContent = nounHeaderLine(entry);
  if (nounMeta) {
    nounMeta.textContent = `${drill.reason}\n${state.nounSentenceEn}`;
  }

  resultText.textContent = "";
  resultText.className = "";
  answerInput.value = "";
  if (answerInput) {
    answerInput.placeholder =
      NOUN_CASE_INPUT_PLACEHOLDER[nounCase] || "Įrašyk linksnio formą";
  }
  answerInput.focus();
}

function newQuestion() {
  state.practiceMode = getPracticeMode();
  updateModePanels();
  if (state.practiceMode === "nouns") {
    newNounQuestion();
  } else {
    newVerbQuestion();
  }
}

function showHint() {
  if (getPracticeMode() === "nouns" && state.nounEntry) {
    const sg = state.nounEntry.decl.Singular;
    const hintAcc = sg.Accusative || "";
    const hintGen = sg.Genitive || "";
    const hint = state.nounCase === "Accusative" ? hintGen : hintAcc;
    personText.textContent = `${nounHeaderLine(state.nounEntry)} · Hint: ${hint || "—"}`;
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
  const base = `EN: ${state.currentEntry.ru}`;
  personText.textContent = hintForm ? `${base} · Hint: ${hintForm}` : `${base} · Hint: -`;
  state.hintShown = true;
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

  if (isCorrect) {
    resultText.innerHTML = `Teisingai!<br>Forms: ${refLine}`;
    resultText.className = "ok";
  } else {
    resultText.innerHTML = `Neteisinga. Teisingas variantas: ${state.expectedAnswers[0]}<br>Forms: ${refLine}`;
    resultText.className = "bad";
  }
}

function checkNounAnswer() {
  if (!state.nounEntry) {
    resultText.textContent = "Pirma sugeneruok klausimą.";
    resultText.className = "bad";
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

  if (isCorrect) {
    resultText.innerHTML = `Teisingai!<br>${state.nounCase}: ${caseForms}`;
    resultText.className = "ok";
  } else {
    resultText.innerHTML = `Neteisinga. Teisingas variantas: ${state.nounExpected}<br>${state.nounCase}: ${caseForms}`;
    resultText.className = "bad";
  }
}

function checkAnswer() {
  if (getPracticeMode() === "nouns") {
    if (!state.nounEntry) {
      resultText.textContent = "Pirma sugeneruok klausimą.";
      resultText.className = "bad";
      return;
    }
    checkNounAnswer();
    return;
  }
  if (!state.currentEntry) {
    resultText.textContent = "Pirma sugeneruok klausimą.";
    resultText.className = "bad";
    return;
  }
  checkVerbAnswer();
}

async function loadData() {
  verbsAll = [];
  nounsAll = [];
  verbs = [];
  nouns = [];
  let verbLoadError = null;

  const metaIds = await fetchPdfGroupIdsFromMeta();
  pdfGroupIdsEffective =
    metaIds && metaIds.length > 0 ? metaIds : [...PDF_GROUPS_FALLBACK];

  try {
    const response = await fetch("conjugations_group0_4.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Nepavyko užkrauti conjugations_group0_4.json");
    }
    verbsAll = await response.json();
  } catch (error) {
    verbLoadError = error;
  }

  try {
    const response = await fetch("nouns_group0_4.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Nepavyko užkrauti nouns_group0_4.json");
    }
    nounsAll = await response.json();
  } catch {
    /* optional */
  }

  if (!verbsAll.length && !nounsAll.length) {
    promptText.textContent =
      "Nepavyko užkrauti duomenų. Paleisk serverį iš aplanko: python3 -m http.server";
    personText.textContent = verbLoadError && verbLoadError.message ? String(verbLoadError.message) : "";
    return;
  }

  recomputePdfGroupIdsFromLoadedData();
  renderPdfGroupCheckboxes();
  loadPdfGroupsFromStorage();
  applyPdfGroupFilter();

  if (!verbs.length && !nouns.length) {
    promptText.textContent =
      "Pasirinktoms grupėms nėra žodžių. Pažymėk platesnį rinkinį grupių.";
    personText.textContent = "";
    updateHeroDataStats();
    return;
  }

  if (!verbs.length && nouns.length && practiceModeSelect) {
    practiceModeSelect.value = "nouns";
  }

  updateHeroDataStats();
  newQuestion();
}

function init() {
  if (!formSelect || !newQuestionBtn || !answerInput || !checkBtn || !hintBtn || !nextBtn || !historyList) {
    return;
  }

  ensurePdfGroupDelegation();

  if (practiceModeSelect) {
    practiceModeSelect.addEventListener("change", () => {
      updateModePanels();
      newQuestion();
    });
  }
  if (nounCaseSelect) {
    nounCaseSelect.addEventListener("change", () => {
      if (getPracticeMode() === "nouns") {
        newQuestion();
      }
    });
  }

  newQuestionBtn.addEventListener("click", () => {
    newQuestion();
  });
  checkBtn.addEventListener("click", checkAnswer);
  hintBtn.addEventListener("click", showHint);
  nextBtn.addEventListener("click", newQuestion);
  answerInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    if (resultText.classList.contains("ok")) {
      event.preventDefault();
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
  renderHistory();
  loadData();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
