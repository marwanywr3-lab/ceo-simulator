/** AI is deliberately unavailable until credentials, official model IDs and spending approval exist. */
export type Provider = "gemini" | "claude";
export type TokenMode = "ultra" | "balanced" | "quality";
export const budgets: Record<TokenMode, { context: number; output: number }> = {
  ultra: { context: 1200, output: 180 },
  balanced: { context: 3000, output: 400 },
  quality: { context: 6000, output: 800 },
};
export function relevantMemory(memories: string[], query: string, limit = 5) {
  const words = query.toLowerCase().split(/\s+/);
  return memories
    .map((text) => ({
      text,
      score: words.filter((w) => w.length > 2 && text.toLowerCase().includes(w))
        .length,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.text);
}
export function aiStatus() {
  return {
    enabled: false,
    calls: 0,
    tokens: 0,
    reason:
      "No configured provider; no paid requests made. Model IDs must be verified before activation.",
  };
}
