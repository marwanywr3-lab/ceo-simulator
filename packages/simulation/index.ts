import { candidates, sectors, type CareerInput, type Command } from "../shared";
import {
  available,
  businessCommand,
  businessDay,
  type Business,
} from "./business";
export type Journal = {
  id: string;
  day: number;
  description: string;
  lines: { account: string; debit: number; credit: number }[];
};
export type Employee = {
  id: string;
  name: string;
  role: string;
  salary: number;
  skill: number;
  trust: number;
  memory: string[];
  status: string;
  trainingUntil?: number;
  trainingGain?: number;
  leaveUntil?: number;
  level?: number;
};
export type State = {
  business?: Business;
  inventory?: number;
  inventoryValue?: number;
  delegations?: {
    id: string;
    budget: number;
    spent: number;
    active: boolean;
  }[];
  bids?: { id: string; value: number; score: number; won: boolean }[];
  schema: 1;
  company: CareerInput;
  minute: number;
  cash: number;
  reputation: number;
  office: boolean;
  equipment: boolean;
  location: string;
  employees: Employee[];
  products: {
    id: string;
    name: string;
    price: number;
    progress: number;
    sold: number;
  }[];
  contracts: { id: string; value: number; progress: number; status: string }[];
  loans: { principal: number; remaining: number; rate: number }[];
  branches: string[];
  journal: Journal[];
  messages: { id: string; from: string; text: string; minute: number }[];
  events: { minute: number; text: string }[];
  demand: number;
  competitors: { name: string; share: number; price: number }[];
  marketing: number;
  customers: number;
  unpaidPayroll: number;
  difficulty: CareerInput["difficulty"];
};
export class RuleError extends Error {}
const insist = (condition: unknown, message: string) => {
  if (!condition) throw new RuleError(message);
};
export function post(
  s: State,
  description: string,
  debit: string,
  credit: string,
  amount: number,
  id = crypto.randomUUID(),
) {
  insist(Number.isSafeInteger(amount) && amount > 0, "Invalid money");
  s.journal.push({
    id,
    day: Math.floor(s.minute / 1440),
    description,
    lines: [
      { account: debit, debit: amount, credit: 0 },
      { account: credit, debit: 0, credit: amount },
    ],
  });
  if (debit === "cash") s.cash += amount;
  if (credit === "cash") s.cash -= amount;
}
export function createState(input: CareerInput): State {
  const s: State = {
    inventory: 0,
    inventoryValue: 0,
    delegations: [],
    bids: [],
    schema: 1,
    company: input,
    minute: 540,
    cash: 0,
    reputation: 35,
    office: false,
    equipment: false,
    location: "office",
    employees: [],
    products: [],
    contracts: [],
    loans: [],
    branches: [],
    journal: [],
    messages: [],
    events: [],
    demand: 100,
    competitors: [
      { name: "آفاق الأعمال", share: 34, price: 110 },
      { name: "مدار للتطوير", share: 27, price: 95 },
      { name: "نواة القابضة", share: 21, price: 105 },
    ],
    marketing: 0,
    customers: 0,
    unpaidPayroll: 0,
    difficulty: input.difficulty,
  };
  post(s, "رأس المال / Capital", "cash", "equity", input.capital * 100);
  return s;
}
function spend(s: State, description: string, account: string, amount: number) {
  insist(s.cash >= amount, "الرصيد غير كافٍ / Insufficient funds");
  post(s, description, account, "cash", amount);
}
export function report(s: State) {
  const balances: Record<string, number> = {};
  for (const e of s.journal)
    for (const l of e.lines)
      balances[l.account] = (balances[l.account] || 0) + l.debit - l.credit;
  const revenue = 0 - (balances.revenue || 0);
  const expenses = Object.entries(balances)
    .filter(([k]) => k.startsWith("expense"))
    .reduce((a, [, v]) => a + v, 0);
  return {
    balances,
    revenue,
    expenses,
    profit: revenue - expenses,
    assets:
      (balances.cash || 0) +
      (balances.assets || 0) +
      (balances.inventory || 0) +
      (balances.prepayments || 0) +
      (balances.receivables || 0),
    liabilities:
      0 -
      (balances.loans || 0) -
      (balances.payable || 0) -
      (balances.deferred || 0),
    equity: -(balances.equity || 0) + revenue - expenses,
    balanced: s.journal.every(
      (e) => e.lines.reduce((a, l) => a + l.debit - l.credit, 0) === 0,
    ),
  };
}
function day(s: State, d: number) {
  businessDay(s, d);
  const sector = sectors[s.company.sector],
    model = sector[5];
  s.demand = Math.max(
    35,
    Math.min(
      165,
      100 +
        (s.difficulty === "relaxed"
          ? 20
          : s.difficulty === "hardcore"
            ? -20
            : 0) +
        Math.round(18 * Math.sin(d / 13 + s.company.sector)) -
        Math.floor(s.competitors[0].share / 10),
    ),
  );
  for (const c of s.competitors) {
    c.price = 90 + Math.round(15 * Math.sin(d / 9 + c.share));
    c.share = Math.max(
      8,
      Math.min(
        45,
        c.share + (s.marketing > 0 ? -1 : 1) * (d % 7 === 0 ? 1 : 0),
      ),
    );
  }
  for (const delegation of s.delegations || []) {
    if (
      !delegation.active ||
      d % 7 !== 0 ||
      !s.employees.some((e) => e.id === delegation.id)
    )
      continue;
    const amount = Math.min(100000, delegation.budget - delegation.spent);
    if (amount > 0 && s.cash >= amount) {
      spend(s, "تسويق مفوض / Delegated marketing", "expense_marketing", amount);
      s.marketing += amount;
      delegation.spent += amount;
      s.employees
        .find((e) => e.id === delegation.id)!
        .memory.push("Marketing spent: " + amount);
    }
    if (delegation.spent >= delegation.budget) delegation.active = false;
  }
  const assigned = new Set(
    s.business?.projects
      .filter((p) => p.status === "active")
      .flatMap((p) => p.employeeIds) || [],
  );
  const workers = s.employees.filter(
    (e) => available(e, d) && !assigned.has(e.id),
  ).length;
  const capacity =
    s.office && s.equipment ? workers * (1 + s.branches.length * 0.2) : 0;
  for (const p of s.products) {
    if (p.progress < 100) {
      p.progress = Math.min(100, p.progress + (capacity * 100) / sector[3]);
      continue;
    }
    const base =
      model === "manufacturing"
        ? 12
        : model === "hospitality"
          ? 18
          : model === "agriculture"
            ? d % 7 === 0
              ? 40
              : 0
            : model === "project"
              ? 1
              : 8;
    let units = Math.floor(
      ((capacity * base * s.demand) / 100) *
        (1 + s.marketing / 1000000) *
        Math.min(2, sector[4] / (p.price / 100)),
    );
    const physical = [
      "retail",
      "manufacturing",
      "agriculture",
      "hospitality",
      "logistics",
    ].includes(model);
    if (physical) units = Math.min(units, s.inventory || 0);
    const cost =
      physical && units
        ? Math.round(((s.inventoryValue || 0) * units) / (s.inventory || 1))
        : Math.round(units * p.price * 0.18);
    if (units > 0 && (physical || s.cash >= cost)) {
      if (cost) {
        if (physical) {
          post(
            s,
            "مواد مباعة / Inventory consumed",
            "expense_cogs",
            "inventory",
            cost,
          );
          s.inventory = (s.inventory || 0) - units;
          s.inventoryValue = (s.inventoryValue || 0) - cost;
        } else spend(s, "تكلفة التشغيل / Cost of sales", "expense_cogs", cost);
      }
      post(s, "مبيعات / Sales", "cash", "revenue", units * p.price);
      p.sold += units;
      s.customers += units;
    }
  }
  for (const c of s.contracts)
    if (c.status === "active" && capacity) {
      c.progress = Math.min(100, c.progress + capacity * 5);
      if (c.progress === 100) {
        post(s, "تسليم عقد / Contract delivery", "cash", "revenue", c.value);
        c.status = "delivered";
        s.reputation = Math.min(100, s.reputation + 3);
      }
    }
  if (s.marketing > 0) s.marketing = Math.max(0, s.marketing - 10000);
  if (d % 30 === 0) {
    const salary = s.employees.reduce((a, e) => a + e.salary, 0);
    const rent = s.office ? 1500000 * (1 + s.branches.length) : 0;
    const total = salary + rent;
    if (total) {
      if (salary)
        post(
          s,
          "استحقاق رواتب / Payroll accrual",
          "expense_payroll",
          "payable",
          salary,
        );
      if (rent)
        post(
          s,
          "استحقاق إيجار / Rent accrual",
          "expense_rent",
          "payable",
          rent,
        );
      s.unpaidPayroll += total;
    }
    if (s.unpaidPayroll && s.cash >= s.unpaidPayroll) {
      spend(s, "سداد مستحقات / Pay liabilities", "payable", s.unpaidPayroll);
      s.unpaidPayroll = 0;
    } else if (total) {
      s.reputation = Math.max(0, s.reputation - 10);
      s.events.push({
        minute: s.minute,
        text: "مستحقات متأخرة / Overdue liabilities",
      });
    }
    for (const l of s.loans) {
      const interest = Math.round((l.remaining * l.rate) / 1200);
      if (interest) {
        post(
          s,
          "استحقاق فوائد / Interest accrual",
          "expense_interest",
          "payable",
          interest,
        );
        s.unpaidPayroll += interest;
        if (s.cash >= interest) {
          spend(s, "سداد فوائد / Interest payment", "payable", interest);
          s.unpaidPayroll -= interest;
        }
      }
    }
  }
}
export function execute(original: State, command: Command): State {
  const s = structuredClone(original);
  const sector = sectors[s.company.sector];
  if (!businessCommand(s, command))
    switch (command.type) {
      case "purchase": {
        insist(s.office, "المقر مطلوب / Office required");
        const cost = command.quantity * sector[4] * 30;
        spend(s, "شراء مواد / Material procurement", "inventory", cost);
        s.inventory = (s.inventory || 0) + command.quantity;
        s.inventoryValue = (s.inventoryValue || 0) + cost;
        break;
      }
      case "delegate": {
        const e = s.employees.find((e) => e.id === command.id);
        insist(
          e && ["CFO", "CMO", "COO"].includes(e.role),
          "صلاحية المدير غير مناسبة / Manager role not eligible",
        );
        insist(
          command.budget * 100 <= s.cash,
          "الميزانية تتجاوز النقدية / Budget exceeds cash",
        );
        s.delegations = s.delegations || [];
        insist(
          !s.delegations.some((d) => d.id === command.id && d.active),
          "تفويض نشط موجود / Active delegation exists",
        );
        s.delegations.push({
          id: command.id,
          budget: command.budget * 100,
          spent: 0,
          active: true,
        });
        break;
      }
      case "revoke": {
        const d = s.delegations?.find((d) => d.id === command.id && d.active);
        insist(d, "لا يوجد تفويض نشط / No active delegation");
        d!.active = false;
        break;
      }
      case "tender": {
        insist(
          s.equipment && s.employees.length,
          "القدرة التشغيلية مطلوبة / Capacity required",
        );
        const estimate = sector[4] * 100;
        insist(
          command.bid <= estimate * 2,
          "العرض يتجاوز سقف المناقصة / Bid exceeds tender cap",
        );
        const skill =
          s.employees.reduce((a, e) => a + e.skill, 0) / s.employees.length;
        const score = Math.round(
          Math.min(40, (estimate / command.bid) * 28) +
            skill * 0.35 +
            s.reputation * 0.25,
        );
        const won = score >= 68;
        s.bids = s.bids || [];
        s.bids.push({
          id: crypto.randomUUID(),
          value: command.bid * 100,
          score,
          won,
        });
        if (won)
          s.contracts.push({
            id: crypto.randomUUID(),
            value: command.bid * 100,
            progress: 0,
            status: "active",
          });
        break;
      }
      case "advance": {
        const end = s.minute + command.minutes;
        for (
          let d = Math.floor(s.minute / 1440) + 1;
          d <= Math.floor(end / 1440);
          d++
        ) {
          s.minute = d * 1440;
          day(s, d);
        }
        s.minute = end;
        break;
      }
      case "rent":
        insist(!s.office, "المقر مستأجر بالفعل / Already rented");
        spend(
          s,
          "تأمين وإيجار المقر / Office deposit",
          "expense_setup",
          4500000,
        );
        s.office = true;
        break;
      case "equip":
        insist(
          s.office && !s.equipment,
          "استأجر مقرًا أولًا / Rent an office first",
        );
        spend(s, "معدات / Equipment", "assets", sector[2] * 100);
        s.equipment = true;
        break;
      case "hire": {
        insist(s.office, "استأجر مقرًا أولًا / Rent an office first");
        const c = candidates[command.candidate];
        insist(
          !s.employees.some((e) => e.role === c.role),
          "المنصب مشغول / Role filled",
        );
        spend(s, "رسوم التوظيف / Recruitment", "expense_hiring", c.salary * 50);
        s.employees.push({
          id: crypto.randomUUID(),
          name: c.name,
          role: c.role,
          salary: c.salary * 100,
          skill: c.skill,
          trust: 50,
          memory: [],
          status: "متاح / Available",
        });
        break;
      }
      case "rename": {
        const e = s.employees.find((e) => e.id === command.id);
        insist(e, "الموظف غير موجود / Employee missing");
        e!.name = command.name;
        break;
      }
      case "fire": {
        const e = s.employees.find((e) => e.id === command.id);
        insist(e, "الموظف غير موجود / Employee missing");
        spend(
          s,
          "تعويض إنهاء الخدمة / Severance",
          "expense_severance",
          e!.salary,
        );
        s.employees = s.employees.filter((x) => x.id !== e!.id);
        break;
      }
      case "develop":
        insist(
          s.equipment && s.employees.length,
          "تحتاج معدات وفريقًا / Equipment and team required",
        );
        spend(
          s,
          "البحث والتطوير / R&D",
          "expense_research",
          Math.round(sector[2] * 20),
        );
        s.products.push({
          id: crypto.randomUUID(),
          name: command.name,
          price: command.price * 100,
          progress: 0,
          sold: 0,
        });
        break;
      case "marketing":
        spend(
          s,
          "حملة تسويق / Marketing",
          "expense_marketing",
          command.budget * 100,
        );
        s.marketing += command.budget * 100;
        break;
      case "loan":
        insist(s.loans.length === 0, "قرض واحد نشط فقط / One active loan");
        insist(
          command.amount <= s.company.capital / 2,
          "الضمان لا يغطي المبلغ / Insufficient collateral",
        );
        post(s, "تمويل مصرفي / Loan", "cash", "loans", command.amount * 100);
        s.loans.push({
          principal: command.amount * 100,
          remaining: command.amount * 100,
          rate: 8,
        });
        break;
      case "repay": {
        insist(s.loans.length, "لا توجد قروض / No loans");
        spend(
          s,
          "سداد أصل القرض / Principal repayment",
          "loans",
          s.loans[0].remaining,
        );
        s.loans = [];
        break;
      }
      case "contract":
        insist(
          s.equipment && s.employees.length,
          "تحتاج قدرة تشغيلية / Operational capacity required",
        );
        insist(
          !s.contracts.some((c) => c.status === "active"),
          "أنهِ العقد الحالي / Finish active contract",
        );
        s.contracts.push({
          id: crypto.randomUUID(),
          value: sector[4] * 100 * 100,
          progress: 0,
          status: "active",
        });
        break;
      case "meeting":
        insist(s.employees.length, "لا يوجد موظفون / No employees");
        for (const e of s.employees) {
          e.memory.push(command.agenda);
          e.trust = Math.min(100, e.trust + 1);
        }
        s.messages.push({
          id: crypto.randomUUID(),
          from: "محضر / Minutes",
          text: command.agenda,
          minute: s.minute,
        });
        break;
      case "message": {
        const e = s.employees.find((e) => e.id === command.id);
        insist(e, "الموظف غير موجود / Employee missing");
        e!.memory.push(command.text);
        s.messages.push({
          id: crypto.randomUUID(),
          from: "CEO → " + e!.name,
          text: command.text,
          minute: s.minute,
        });
        break;
      }
      case "travel": {
        const minutes =
          command.location === "city"
            ? 60
            : command.location === "industry"
              ? 90
              : 30;
        const end = s.minute + minutes;
        for (
          let d = Math.floor(s.minute / 1440) + 1;
          d <= Math.floor(end / 1440);
          d++
        ) {
          s.minute = d * 1440;
          day(s, d);
        }
        s.minute = end;
        s.location = command.location;
        break;
      }
      case "branch":
        insist(
          s.employees.some((e) => e.role === "COO"),
          "عيّن مدير عمليات / COO required",
        );
        insist(
          !s.branches.includes(command.city),
          "الفرع موجود / Branch exists",
        );
        spend(s, "تأسيس فرع / Branch setup", "expense_branch", 25000000);
        s.branches.push(command.city);
        break;
      case "snapshot":
      case "restore":
        throw new RuleError("Server operation");
    }
  insist(Number.isSafeInteger(s.cash) && s.cash >= 0, "Cash invariant");
  insist(report(s).balanced, "Ledger invariant");
  s.events.push({ minute: s.minute, text: command.type });
  return s;
}
