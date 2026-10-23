import { report, type State } from "./index";
export function financialStatements(
  s: State,
  fromDay = 0,
  toDay = Math.floor(s.minute / 1440),
) {
  const period = s.journal.filter((e) => e.day >= fromDay && e.day <= toDay);
  const closing = report({
    ...s,
    journal: s.journal.filter((e) => e.day <= toDay),
  });
  const income = report({ ...s, journal: period });
  let openingCash = 0,
    operating = 0,
    investing = 0,
    financing = 0;
  for (const e of s.journal) {
    const cash = e.lines
      .filter((l) => l.account === "cash")
      .reduce((n, l) => n + l.debit - l.credit, 0);
    if (e.day < fromDay) openingCash += cash;
    if (e.day < fromDay || e.day > toDay) continue;
    if (e.lines.some((l) => ["equity", "loans"].includes(l.account)))
      financing += cash;
    else if (e.lines.some((l) => l.account === "assets")) investing += cash;
    else operating += cash;
  }
  return {
    fromDay,
    toDay,
    income: {
      revenue: income.revenue,
      expenses: income.expenses,
      profit: income.profit,
      expenseBreakdown: Object.entries(income.balances)
        .filter(([k]) => k.startsWith("expense"))
        .map(([account, amount]) => ({ account, amount })),
    },
    balanceSheet: {
      assets: closing.assets,
      liabilities: closing.liabilities,
      equity: closing.equity,
      accounts: closing.balances,
      balanced:
        closing.balanced &&
        closing.assets === closing.liabilities + closing.equity,
    },
    cashFlow: {
      openingCash,
      operating,
      investing,
      financing,
      netChange: operating + investing + financing,
      closingCash: openingCash + operating + investing + financing,
    },
    payroll: s.employees.map((e) => ({
      id: e.id,
      name: e.name,
      monthlySalary: e.salary,
      skill: e.skill,
      level: e.level || 1,
    })),
    loans: s.loans,
    outstandingLiabilities: s.unpaidPayroll,
  };
}
