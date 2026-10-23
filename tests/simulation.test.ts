import { describe, it, expect } from "vitest";
import { createState, execute, report } from "../packages/simulation";
import { careerInput, commandInput } from "../packages/shared";
const input = {
  name: "شركة المدار",
  ceo: "مروان",
  city: "الرياض" as const,
  legal: "llc" as const,
  sector: 0,
  capital: 1000000,
  difficulty: "realistic" as const,
};
function operating() {
  let s = createState(input);
  s = execute(s, { type: "rent" });
  s = execute(s, { type: "equip" });
  return execute(s, { type: "hire", candidate: 2 });
}
describe("authoritative economics", () => {
  it("reports zero revenue without a negative-zero display", () => {
    expect(Object.is(report(createState(input)).revenue, -0)).toBe(false);
  });
  it("starts with cash only and balanced equity", () => {
    const s = createState(input);
    expect(s.cash).toBe(100000000);
    expect(s.employees).toHaveLength(0);
    expect(s.products).toHaveLength(0);
    expect(s.contracts).toHaveLength(0);
    expect(s.office).toBe(false);
    expect(report(s).assets).toBe(report(s).equity);
  });
  it("requires premises and rejects overspending atomically", () => {
    const s = createState(input);
    expect(() => execute(s, { type: "hire", candidate: 0 })).toThrow();
    expect(s.cash).toBe(100000000);
    let low = createState({ ...input, capital: 500000, sector: 17 });
    low = execute(low, { type: "rent" });
    expect(() => execute(low, { type: "equip" })).toThrow();
    expect(low.equipment).toBe(false);
  });
  it("renames stable identity without changing salary or memory", () => {
    let s = operating();
    s = execute(s, { type: "meeting", agenda: "خطة إطلاق المنتج" });
    const e = structuredClone(s.employees[0]);
    s = execute(s, { type: "rename", id: e.id, name: "خالد الجديد" });
    expect(s.employees[0]).toEqual({ ...e, name: "خالد الجديد" });
  });
  it("accrues and pays monthly salaries only through game time", () => {
    let s = operating();
    const before = s.cash;
    s = execute(s, { type: "advance", minutes: 10080 });
    expect(s.cash).toBe(before);
    for (let i = 0; i < 4; i++)
      s = execute(s, { type: "advance", minutes: 10080 });
    expect(s.cash).toBe(before - 3500000);
    expect(report(s).balanced).toBe(true);
    expect(report(s).assets).toBe(report(s).equity + report(s).liabilities);
  });
  it("develops then sells with ledger-backed income", () => {
    let s = operating();
    s = execute(s, { type: "develop", name: "ERP", price: 1000 });
    for (let i = 0; i < 6; i++)
      s = execute(s, { type: "advance", minutes: 10080 });
    expect(s.products[0].progress).toBe(100);
    expect(s.products[0].sold).toBeGreaterThan(0);
    expect(report(s).revenue).toBeGreaterThan(0);
    expect(report(s).assets).toBe(report(s).equity + report(s).liabilities);
  });
  it("loans post liability, charge interest and repay without duplicate principal", () => {
    let s = operating();
    const start = s.cash;
    s = execute(s, { type: "loan", amount: 100000 });
    expect(s.cash).toBe(start + 10000000);
    expect(report(s).liabilities).toBe(10000000);
    s = execute(s, { type: "repay" });
    expect(s.cash).toBe(start);
    expect(report(s).liabilities).toBe(0);
    expect(() => execute(s, { type: "repay" })).toThrow();
  });
  it("delivers contracts only with capacity", () => {
    let s = operating();
    s = execute(s, { type: "contract" });
    for (let i = 0; i < 3; i++)
      s = execute(s, { type: "advance", minutes: 10080 });
    expect(s.contracts[0].status).toBe("delivered");
    expect(report(s).revenue).toBe(s.contracts[0].value);
  });
  it("keeps companies independent", () => {
    const a = operating(),
      b = createState(input);
    expect(a.cash).not.toBe(b.cash);
    expect(b.employees).toHaveLength(0);
  });
  it("validates capital and refuses unrecognized command kinds", () => {
    expect(careerInput.safeParse({ ...input, capital: 499999 }).success).toBe(
      false,
    );
    expect(
      commandInput.safeParse({ type: "setCash", cash: 1000000 }).success,
    ).toBe(false);
    expect(
      commandInput.safeParse({ type: "advance", minutes: -1 }).success,
    ).toBe(false);
  });
  it("does not mutate prior saves", () => {
    const s = operating();
    const next = execute(s, { type: "advance", minutes: 1440 });
    expect(s.minute).toBe(540);
    expect(next.minute).toBe(1980);
  });
});
