// lib/sopLint.js — DETERMINISTIC writing-standard checks from the canonical SOP (Step 3e / Step 4).
// No AI. Pure string/regex matching. Flags: low-confidence language, abbreviations, non-first-person.
// Returns spans the UI can highlight, same shape the grammar layer uses.

const HEDGE = [
  "might", "seems", "seem", "appears", "appear", "possibly", "likely",
  "i think", "maybe", "perhaps", "probably", "could be", "may be",
  "presumably", "apparently", "seemingly",
];

// abbreviation -> expansion the SOP wants
const ABBREV = {
  "FOD": "garbage can / object (write it in full)",
  "ped": "pedestrian",
  "peds": "pedestrians",
  "veh": "vehicle",
  "vehs": "vehicles",
  "intersection's": null, // ignore possessive false positive guard (not used)
  "approx": "approximately",
  "w/": "with",
  "w/o": "without",
  "incl": "including",
  "min": "minimum/minutes (write in full)",
  "max": "maximum",
  "temp": "temporary/temperature (write in full)",
  "ADV": null, // ADV is allowed per terminology; do not flag
};

const NON_FIRST = ["we", "us", "our", "ours", "you", "your", "yours"];

// find all case-insensitive whole-word matches of `term` in text
function findWord(text, term) {
  const out = [];
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // word boundary that also respects leading/trailing for multiword + slashes
  const re = new RegExp("(^|[^A-Za-z0-9_])(" + esc + ")(?![A-Za-z0-9_])", "gi");
  let m;
  while ((m = re.exec(text)) !== null) {
    const start = m.index + m[1].length;
    out.push({ start, end: start + m[2].length, text: m[2] });
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  return out;
}

// Lint one field. where = "trace" | "plan"
export function lintField(text, where) {
  if (!text) return [];
  const issues = [];

  HEDGE.forEach((w) => {
    findWord(text, w).forEach((h) => {
      issues.push({
        where, kind: "hedge", original: h.text, start: h.start, end: h.end,
        fix: `Remove low-confidence word "${h.text}" — write from certainty.`,
        rule: "Step 3e: no low-confidence language.",
      });
    });
  });

  Object.entries(ABBREV).forEach(([ab, exp]) => {
    if (!exp) return; // allowed (e.g. ADV) or guard
    findWord(text, ab).forEach((h) => {
      issues.push({
        where, kind: "abbrev", original: h.text, start: h.start, end: h.end,
        fix: `Spell out "${h.text}" → ${exp}.`,
        rule: "Step 3e: no abbreviations; write objects in full.",
      });
    });
  });

  NON_FIRST.forEach((w) => {
    findWord(text, w).forEach((h) => {
      issues.push({
        where, kind: "person", original: h.text, start: h.start, end: h.end,
        fix: `Use first person "I" — not "${h.text}".`,
        rule: "Step 3e: first person only (I), never we/you.",
      });
    });
  });

  // de-dupe overlapping/identical spans, sort by position
  issues.sort((a, b) => a.start - b.start || b.end - a.end);
  const seen = new Set();
  return issues.filter((i) => {
    const k = i.start + ":" + i.end;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function lintAll(revisedTrace, revisedPlan) {
  return [...lintField(revisedTrace, "trace"), ...lintField(revisedPlan, "plan")];
}
