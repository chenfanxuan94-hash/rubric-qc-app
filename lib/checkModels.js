// lib/checkModels.js
// ---------------------------------------------------------------------------
// The models available for "Run check" in the support tool. Opus is the
// default and always runs; the other two are opt-in extras the tasker can
// add when they have time (different models catch different blind spots).
// All three get the SAME system/user prompts; only the engine differs.
// ---------------------------------------------------------------------------

export const CHECK_MODELS = [
  {
    id: "opus48",
    label: "Claude Opus 4.8",
    sub: "high effort · the default reviewer",
    vendor: "anthropic",
    locked: true, // always runs, cannot be unchecked
  },
  {
    id: "gpt55",
    label: "GPT-5.5",
    sub: "medium thinking · second opinion",
    vendor: "openai",
    model: "gpt-5.5",
    effort: "medium",
    locked: false,
  },
  {
    id: "gem31pro",
    label: "Gemini 3.1 Pro",
    sub: "high thinking · third opinion",
    vendor: "gemini",
    model: "gemini-3.1-pro-preview",
    thinkingLevel: "high",
    locked: false,
  },
];

export function checkModelById(id) {
  return CHECK_MODELS.find((m) => m.id === id) || null;
}
