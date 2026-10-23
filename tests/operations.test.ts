import { describe, it, expect } from "vitest";
import { createState, execute, report } from "../packages/simulation";
import { relevantMemory, budgets } from "../packages/ai";
const input = {
  name: "اختبار التشغيل",
  ceo: "مدير الاختبار",
  city: "الرياض" as const,
  legal: "llc" as const,
  sector: 0,
  capital: 10000000,
  difficulty: "realistic" as const,
};
const operating = (sector = 0) =>
  execute(
    execute(execute(createState({ ...input, sector }), { type: "rent" }), {
      type: "equip",
    }),
    { type: "hire", candidate: 0 },
  );
describe("operations and constraints", () => {
  it("physical retail cannot sell inventory it does not own", () => {
    let s = operating(7);
    s = execute(s, { type: "develop", name: "Retail product", price: 160 });
    for (let i = 0; i < 4; i++)
      s = execute(s, { type: "advance", minutes: 10080 });
    expect(s.products[0].sold).toBe(0);
    s = execute(s, { type: "purchase", quantity: 100 });
    const before = s.cash;
    s = execute(s, { type: "advance", minutes: 1440 });
    expect(s.products[0].sold).toBeGreaterThan(0);
    expect(s.inventory).toBeLessThan(100);
    expect(s.cash).toBeGreaterThan(before);
    const r = report(s);
    expect(r.assets).toBe(r.equity + r.liabilities);
  });
  it("delegation cannot exceed its cumulative budget", () => {
    let s = operating();
    const id = s.employees[0].id;
    s = execute(s, { type: "delegate", id, budget: 2500 });
    const before = s.cash;
    for (let i = 0; i < 4; i++)
      s = execute(s, { type: "advance", minutes: 10080 });
    expect(s.delegations![0].spent).toBe(250000);
    expect(s.delegations![0].active).toBe(false);
    expect(before - s.cash).toBe(250000);
    expect(s.employees[0].memory.length).toBe(3);
  });
  it("rejects ineligible manager roles and supports revocation", () => {
    let s = execute(operating(), { type: "hire", candidate: 2 });
    expect(() =>
      execute(s, { type: "delegate", id: s.employees[1].id, budget: 1000 }),
    ).toThrow();
    s = execute(s, { type: "delegate", id: s.employees[0].id, budget: 1000 });
    s = execute(s, { type: "revoke", id: s.employees[0].id });
    s = execute(s, { type: "advance", minutes: 10080 });
    expect(s.delegations![0].spent).toBe(0);
  });
  it("price alone does not win a tender", () => {
    let s = operating();
    s.employees[0].skill = 0;
    s.reputation = 0;
    s = execute(s, { type: "tender", bid: 10000 });
    expect(s.bids![0].won).toBe(false);
    expect(s.contracts.length).toBe(0);
  });
  it("difficulty changes actual demand", () => {
    let relaxed = createState({ ...input, difficulty: "relaxed" }),
      hardcore = createState({ ...input, difficulty: "hardcore" });
    relaxed = execute(relaxed, { type: "advance", minutes: 1440 });
    hardcore = execute(hardcore, { type: "advance", minutes: 1440 });
    expect(relaxed.demand - hardcore.demand).toBe(40);
  });
  it("travel processes crossed calendar boundaries", () => {
    let s = operating();
    s.minute = 1430;
    s = execute(s, { type: "travel", location: "city" });
    expect(s.minute).toBe(1490);
    expect(s.demand).not.toBe(100);
  });
  it("all 20 sectors can develop, trade and remain balanced", () => {
    for (let sector = 0; sector < 20; sector++) {
      let s = operating(sector);
      s = execute(s, { type: "purchase", quantity: 20 });
      s = execute(s, { type: "develop", name: "Sector " + sector, price: 100 });
      for (let week = 0; week < 20; week++)
        s = execute(s, { type: "advance", minutes: 10080 });
      expect(s.products[0].progress).toBe(100);
      const r = report(s);
      expect(r.balanced).toBe(true);
      expect(r.assets).toBe(r.equity + r.liabilities);
      expect(Number.isSafeInteger(s.cash)).toBe(true);
    }
  });
  it("selects only relevant memory and applies token mode caps", () => {
    expect(
      relevantMemory(
        ["launch budget", "private salary record", "launch date"],
        "launch",
      ),
    ).toEqual(["launch budget", "launch date"]);
    expect(budgets.ultra.output).toBeLessThan(budgets.quality.output);
  });
});
