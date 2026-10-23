import { describe, it, expect } from "vitest";
import {
  createState,
  execute,
  report,
  type State,
} from "../packages/simulation";
import { financialStatements } from "../packages/simulation/reports";
import { commandInput } from "../packages/shared";
const input = {
  name: "Test Business",
  ceo: "Test CEO",
  city: "الرياض" as const,
  legal: "llc" as const,
  sector: 0,
  capital: 1000000,
  difficulty: "realistic" as const,
};
function company(sector = 0) {
  let s = createState({ ...input, sector });
  s = execute(s, { type: "rent" });
  s = execute(s, { type: "equip" });
  return execute(s, { type: "hire", candidate: 2 });
}
const days = (s: State, n: number) => {
  for (let i = 0; i < n; i++)
    s = execute(s, { type: "advance", minutes: 1440 });
  return s;
};
const balanced = (s: State) => {
  expect(report(s).balanced).toBe(true);
  expect(report(s).assets).toBe(report(s).equity + report(s).liabilities);
  expect(financialStatements(s).cashFlow.closingCash).toBe(s.cash);
};
describe("business systems", () => {
  it("upgrades legacy saves lazily without changing balances", () => {
    let s = company();
    delete s.business;
    const cash = s.cash;
    s = execute(s, { type: "lead", name: "Legacy customer", budget: 10000 });
    expect(s.cash).toBe(cash);
    expect(s.business?.leads).toHaveLength(1);
    balanced(s);
  });
  it("training reduces capacity until completion and then increases skill", () => {
    let s = company();
    s = execute(s, { type: "develop", name: "New software", price: 1000 });
    const id = s.employees[0].id,
      skill = s.employees[0].skill;
    s = execute(s, { type: "train", id, days: 3 });
    s = days(s, 2);
    expect(s.products[0].progress).toBe(0);
    expect(s.employees[0].skill).toBe(skill);
    s = days(s, 1);
    expect(s.employees[0].skill).toBe(skill + 6);
    expect(s.products[0].progress).toBeGreaterThan(0);
    balanced(s);
  });
  it("paid leave pauses work while promotion changes future payroll", () => {
    let s = company();
    const id = s.employees[0].id,
      salary = s.employees[0].salary;
    s = execute(s, { type: "leave", id, days: 2 });
    expect(() => execute(s, { type: "promote", id })).toThrow();
    s = days(s, 2);
    s = execute(s, { type: "promote", id });
    expect(s.employees[0].salary).toBe(Math.round(salary * 1.15));
    expect(s.employees[0].level).toBe(2);
    balanced(s);
  });
  it("prepaid shipments stay out of inventory until arrival", () => {
    let s = company();
    s = execute(s, { type: "order", supplier: 1, quantity: 100 });
    expect(s.inventory).toBe(0);
    expect(report(s).balances.prepayments).toBeGreaterThan(0);
    s = days(s, 2);
    expect(s.inventory).toBe(0);
    s = days(s, 1);
    expect(s.inventory).toBe(100);
    expect(report(s).balances.prepayments).toBe(0);
    balanced(s);
  });
  it("cancelled orders refund once with a 5% fee", () => {
    let s = company(),
      cash = s.cash;
    s = execute(s, { type: "order", supplier: 0, quantity: 10 });
    const o = s.business!.orders[0];
    s = execute(s, { type: "cancel_order", id: o.id });
    expect(s.cash).toBe(cash - Math.round(o.total * 0.05));
    expect(() => execute(s, { type: "cancel_order", id: o.id })).toThrow();
    s = days(s, 4);
    expect(s.inventory).toBe(0);
    balanced(s);
  });
  it("returns remove weighted inventory value and cannot create profit", () => {
    let s = company();
    s = execute(s, { type: "order", supplier: 0, quantity: 10 });
    s = days(s, 1);
    const o = s.business!.orders[0],
      cash = s.cash;
    s = execute(s, { type: "return_order", id: o.id, quantity: 10 });
    expect(s.inventory).toBe(0);
    expect(s.cash - cash).toBeLessThan(o.total);
    expect(() =>
      execute(s, { type: "return_order", id: o.id, quantity: 1 }),
    ).toThrow();
    balanced(s);
  });
  it("rejects returns after the seven-day arrival window", () => {
    let s = company();
    s = execute(s, { type: "order", supplier: 0, quantity: 10 });
    s = days(s, 9);
    expect(() =>
      execute(s, {
        type: "return_order",
        id: s.business!.orders[0].id,
        quantity: 1,
      }),
    ).toThrow();
    balanced(s);
  });
  it("projects reserve staff, spend budget and recognize milestone revenue", () => {
    let s = company();
    s = execute(s, { type: "develop", name: "Studio", price: 1000 });
    s = execute(s, {
      type: "project",
      name: "Delivery",
      budget: 10000,
      days: 10,
      employeeIds: [s.employees[0].id],
    });
    expect(report(s).balances.deferred).toBe(-140000);
    expect(report(s).revenue).toBe(0);
    s = days(s, 3);
    expect(s.products[0].progress).toBe(0);
    expect(s.business!.projects[0].earned).toBe(350000);
    s = days(s, 8);
    const p = s.business!.projects[0];
    expect(p.status).toBe("completed");
    expect(p.spent).toBe(p.budget);
    expect(p.earned).toBe(p.value);
    expect(p.advance).toBe(0);
    balanced(s);
  });
  it("late delivery accrues a single penalty and can be settled explicitly", () => {
    let s = company(),
      id = s.employees[0].id;
    s = execute(s, {
      type: "project",
      name: "Delayed",
      budget: 10000,
      days: 7,
      employeeIds: [id],
    });
    s = execute(s, { type: "leave", id, days: 14 });
    s = days(s, 9);
    const due = s.unpaidPayroll;
    expect(due).toBe(140000);
    s = days(s, 1);
    expect(s.unpaidPayroll).toBe(due);
    s = execute(s, { type: "pay_due" });
    expect(s.unpaidPayroll).toBe(0);
    balanced(s);
  });
  it("cancels projects with a refund of unearned advance and a penalty", () => {
    let s = company(),
      cash = s.cash;
    s = execute(s, {
      type: "project",
      name: "Cancelled",
      budget: 10000,
      days: 7,
      employeeIds: [s.employees[0].id],
    });
    s = execute(s, { type: "cancel_project", id: s.business!.projects[0].id });
    expect(s.cash).toBe(cash - 70000);
    expect(report(s).balances.deferred).toBe(0);
    expect(s.business!.projects[0].status).toBe("cancelled");
    balanced(s);
  });
  it("invoices collect later and refunds reverse revenue exactly once", () => {
    let s = company();
    s = execute(s, { type: "develop", name: "Software", price: 1000 });
    s = days(s, 31);
    s = execute(s, { type: "lead", name: "Customer", budget: 5000 });
    s = execute(s, { type: "pitch", id: s.business!.leads[0].id });
    expect(s.business!.leads[0].paid).toBe(false);
    expect(report(s).balances.receivables).toBe(500000);
    const ticket = s.business!.tickets[0];
    expect(() =>
      execute(s, { type: "support", id: ticket.id, resolution: "refund" }),
    ).toThrow();
    s = days(s, 3);
    expect(s.business!.leads[0].paid).toBe(true);
    expect(report(s).balances.receivables).toBe(0);
    const revenue = report(s).revenue;
    s = execute(s, { type: "support", id: ticket.id, resolution: "refund" });
    expect(report(s).revenue).toBe(revenue - 500000);
    expect(() =>
      execute(s, { type: "support", id: ticket.id, resolution: "refund" }),
    ).toThrow();
    balanced(s);
  });
  it("physical customer orders require actual stock", () => {
    let s = company(4);
    s = execute(s, { type: "develop", name: "Clothing", price: 1000 });
    s = days(s, 25);
    s = execute(s, { type: "lead", name: "Buyer", budget: 5000 });
    expect(() =>
      execute(s, { type: "pitch", id: s.business!.leads[0].id }),
    ).toThrow();
    s = execute(s, { type: "purchase", quantity: 10 });
    s = execute(s, { type: "pitch", id: s.business!.leads[0].id });
    expect(s.inventory).toBe(5);
    balanced(s);
  });
  it("period reports reconcile opening and closing cash and separate rent", () => {
    let s = days(company(), 35);
    const r = financialStatements(s, 30, 35);
    expect(
      r.income.expenseBreakdown.some((x) => x.account === "expense_rent"),
    ).toBe(true);
    expect(r.cashFlow.closingCash).toBe(s.cash);
    expect(r.balanceSheet.balanced).toBe(true);
    balanced(s);
  });
  it("command validation rejects zero days, duplicate-free team bounds and forged types", () => {
    expect(
      commandInput.safeParse({ type: "train", id: "x", days: 0 }).success,
    ).toBe(false);
    expect(
      commandInput.safeParse({
        type: "project",
        name: "A project",
        budget: 10000,
        days: 7,
        employeeIds: [],
      }).success,
    ).toBe(false);
    let s = company();
    const id = s.employees[0].id;
    expect(() =>
      execute(s, {
        type: "project",
        name: "Dupes",
        budget: 10000,
        days: 7,
        employeeIds: [id, id],
      }),
    ).toThrow();
  });
});
