import { sectors, type Command } from "../shared";
import { post, RuleError, type State } from "./index";

export const suppliers = [
  { name: "الإمداد السريع", en: "Express Supply", multiplier: 120, days: 1 },
  { name: "الإمداد المتحدة", en: "United Supply", multiplier: 100, days: 3 },
  { name: "المصدر الاقتصادي", en: "Value Source", multiplier: 85, days: 5 },
] as const;
export type Business = {
  version: 1;
  orders: {
    id: string;
    supplier: number;
    quantity: number;
    unitCost: number;
    total: number;
    arrival: number;
    status: "shipping" | "delivered" | "cancelled";
    returned: number;
    delayed: boolean;
  }[];
  projects: {
    id: string;
    name: string;
    budget: number;
    value: number;
    spent: number;
    earned: number;
    advance: number;
    start: number;
    deadline: number;
    progress: number;
    milestone: number;
    employeeIds: string[];
    status: "active" | "completed" | "cancelled";
    penalized: boolean;
  }[];
  leads: {
    id: string;
    name: string;
    budget: number;
    status: "new" | "won" | "lost";
    value: number;
    due: number;
    paid: boolean;
    productId?: string;
  }[];
  tickets: {
    id: string;
    leadId: string;
    due: number;
    status: "open" | "resolved" | "refunded";
    satisfaction: number;
  }[];
};
export function business(s: State): Business {
  return (s.business ||= {
    version: 1,
    orders: [],
    projects: [],
    leads: [],
    tickets: [],
  });
}
const requireRule = (condition: unknown, message: string) => {
  if (!condition) throw new RuleError(message);
};
const today = (s: State) => Math.floor(s.minute / 1440);
export function available(e: State["employees"][number], day: number) {
  return (e.leaveUntil || 0) <= day && (e.trainingUntil || 0) <= day;
}
function pay(s: State, description: string, account: string, amount: number) {
  requireRule(s.cash >= amount, "الرصيد غير كافٍ / Insufficient funds");
  if (amount) post(s, description, account, "cash", amount);
}
export function businessCommand(s: State, c: Command): boolean {
  const b = business(s),
    d = today(s);
  switch (c.type) {
    case "train":
    case "leave":
    case "promote": {
      const e = s.employees.find((e) => e.id === c.id);
      requireRule(e, "الموظف غير موجود / Employee missing");
      requireRule(
        available(e!, d),
        "الموظف في تدريب أو إجازة / Employee unavailable",
      );
      if (c.type === "train") {
        requireRule(
          e!.skill < 100,
          "الموظف بلغ سقف الكفاءة / Skill is at maximum",
        );
        pay(
          s,
          "برنامج تدريب / Staff training",
          "expense_training",
          c.days * 50000,
        );
        e!.trainingUntil = d + c.days;
        e!.trainingGain = Math.min(100 - e!.skill, c.days * 2);
        e!.memory.push("Training scheduled: " + c.days + " days");
      } else if (c.type === "leave") {
        e!.leaveUntil = d + c.days;
        e!.trust = Math.min(100, e!.trust + c.days);
        e!.memory.push("Paid leave: " + c.days + " days");
      } else {
        requireRule(
          (e!.level || 1) < 3,
          "بلغ سقف الترقيات / Promotion limit reached",
        );
        pay(
          s,
          "مكافأة ترقية / Promotion bonus",
          "expense_payroll",
          Math.round(e!.salary / 4),
        );
        e!.salary = Math.round(e!.salary * 1.15);
        e!.level = (e!.level || 1) + 1;
        e!.trust = Math.min(100, e!.trust + 10);
        e!.memory.push("Promoted to level " + e!.level);
      }
      return true;
    }
    case "order": {
      requireRule(s.office, "المقر مطلوب / Office required");
      requireRule(
        b.orders.filter((o) => o.status === "shipping").length < 20,
        "حد الشحنات النشطة / Too many shipments",
      );
      const supplier = suppliers[c.supplier];
      const unitCost = Math.round(
        (sectors[s.company.sector][4] * 30 * supplier.multiplier) / 100,
      );
      const total = unitCost * c.quantity;
      pay(s, "دفعة أمر شراء / Supplier prepayment", "prepayments", total);
      const delayed = c.supplier === 2 && (b.orders.length + 1) % 4 === 0;
      b.orders.push({
        id: crypto.randomUUID(),
        supplier: c.supplier,
        quantity: c.quantity,
        unitCost,
        total,
        arrival: d + supplier.days + (delayed ? 2 : 0),
        status: "shipping",
        returned: 0,
        delayed,
      });
      return true;
    }
    case "cancel_order": {
      const o = b.orders.find((o) => o.id === c.id);
      requireRule(
        o?.status === "shipping",
        "الشحنة غير قابلة للإلغاء / Order cannot be cancelled",
      );
      const fee = Math.round(o!.total * 0.05),
        refund = o!.total - fee;
      if (refund)
        post(
          s,
          "استرداد أمر شراء / Order cancellation refund",
          "cash",
          "prepayments",
          refund,
        );
      if (fee)
        post(
          s,
          "رسوم إلغاء الشحنة / Shipment cancellation fee",
          "expense_shipping",
          "prepayments",
          fee,
        );
      o!.status = "cancelled";
      return true;
    }
    case "return_order": {
      const o = b.orders.find((o) => o.id === c.id);
      requireRule(
        o?.status === "delivered" && d <= o.arrival + 7,
        "فترة الإرجاع ٧ أيام بعد الوصول / Return window is 7 days",
      );
      requireRule(
        c.quantity <= o!.quantity - o!.returned &&
          c.quantity <= (s.inventory || 0),
        "كمية الإرجاع غير متاحة / Return quantity unavailable",
      );
      const cost = Math.round(
        ((s.inventoryValue || 0) * c.quantity) / (s.inventory || 1),
      );
      const refund = Math.min(cost, Math.round(o!.unitCost * c.quantity * 0.9));
      if (refund)
        post(s, "مرتجع مورد / Supplier return", "cash", "inventory", refund);
      if (cost > refund)
        post(
          s,
          "خسارة مرتجع / Return loss",
          "expense_returns",
          "inventory",
          cost - refund,
        );
      s.inventory = (s.inventory || 0) - c.quantity;
      s.inventoryValue = (s.inventoryValue || 0) - cost;
      o!.returned += c.quantity;
      return true;
    }
    case "project": {
      const ids = [...new Set(c.employeeIds)];
      requireRule(
        ids.length === c.employeeIds.length &&
          ids.every((id) =>
            s.employees.some((e) => e.id === id && available(e, d)),
          ),
        "اختر موظفين متاحين / Select available employees",
      );
      requireRule(
        s.equipment &&
          b.projects.filter((p) => p.status === "active").length < 5,
        "تحتاج معدات وأقل من ٥ مشاريع نشطة / Equipment required; maximum 5 active projects",
      );
      requireRule(
        !b.projects.some(
          (p) =>
            p.status === "active" &&
            p.employeeIds.some((id) => ids.includes(id)),
        ),
        "الموظف مخصص لمشروع آخر / Employee already assigned",
      );
      const budget = c.budget * 100;
      requireRule(
        s.cash >= budget,
        "يلزم توفر ميزانية المشروع كاملة / Full project budget must be available",
      );
      const value = Math.round(budget * 1.4),
        advance = Math.round(value * 0.1);
      post(
        s,
        "مقدم عقد مشروع / Project customer advance",
        "cash",
        "deferred",
        advance,
      );
      b.projects.push({
        id: crypto.randomUUID(),
        name: c.name,
        budget,
        value,
        spent: 0,
        earned: 0,
        advance,
        start: d,
        deadline: d + c.days,
        progress: 0,
        milestone: 0,
        employeeIds: ids,
        status: "active",
        penalized: false,
      });
      return true;
    }
    case "cancel_project": {
      const p = b.projects.find((p) => p.id === c.id);
      requireRule(
        p?.status === "active",
        "المشروع غير نشط / Project is not active",
      );
      const refund = p!.advance,
        penalty = Math.round(p!.value * 0.05);
      requireRule(
        s.cash >= refund + penalty,
        "يلزم تمويل الاسترداد والجزاء / Refund and penalty funds required",
      );
      pay(s, "رد مقدم المشروع / Refund project advance", "deferred", refund);
      pay(
        s,
        "جزاء إلغاء مشروع / Project cancellation penalty",
        "expense_penalty",
        penalty,
      );
      p!.advance = 0;
      p!.status = "cancelled";
      return true;
    }
    case "lead": {
      requireRule(
        b.leads.length < 200,
        "حد سجل العملاء ٢٠٠ / Customer record limit is 200",
      );
      b.leads.push({
        id: crypto.randomUUID(),
        name: c.name,
        budget: c.budget * 100,
        status: "new",
        value: 0,
        due: 0,
        paid: false,
      });
      return true;
    }
    case "pitch": {
      const lead = b.leads.find((l) => l.id === c.id);
      const product = s.products.find((p) => p.progress === 100);
      requireRule(
        lead?.status === "new" && product && s.equipment,
        "يلزم عميل جديد ومنتج جاهز / New lead and ready product required",
      );
      const staff = s.employees.filter((e) => available(e, d));
      requireRule(staff.length, "لا يوجد فريق متاح / No available team");
      const units = Math.min(10, Math.floor(lead!.budget / product!.price));
      requireRule(
        units > 0,
        "ميزانية العميل أقل من سعر الوحدة / Customer budget below unit price",
      );
      const value = units * product!.price;
      const score =
        s.reputation +
        Math.round(staff.reduce((n, e) => n + e.skill, 0) / staff.length / 2);
      if (score < 65) {
        lead!.status = "lost";
        return true;
      }
      const physical = [
        "retail",
        "manufacturing",
        "agriculture",
        "hospitality",
        "logistics",
      ].includes(sectors[s.company.sector][5]);
      if (physical) {
        requireRule(
          (s.inventory || 0) >= units,
          "المخزون غير كافٍ / Insufficient inventory",
        );
        const cost = Math.round(
          ((s.inventoryValue || 0) * units) / (s.inventory || 1),
        );
        if (cost)
          post(
            s,
            "مواد طلب عميل / Customer order materials",
            "expense_cogs",
            "inventory",
            cost,
          );
        s.inventory = (s.inventory || 0) - units;
        s.inventoryValue = (s.inventoryValue || 0) - cost;
      } else
        pay(
          s,
          "تكلفة تنفيذ طلب عميل / Customer order fulfillment",
          "expense_cogs",
          Math.round(value * 0.35),
        );
      product!.sold += units;
      post(
        s,
        "فاتورة عميل / Customer invoice",
        "receivables",
        "revenue",
        value,
      );
      lead!.status = "won";
      lead!.value = value;
      lead!.due = d + 3;
      lead!.productId = product!.id;
      b.tickets.push({
        id: crypto.randomUUID(),
        leadId: lead!.id,
        due: d + 7,
        status: "open",
        satisfaction: 70,
      });
      return true;
    }
    case "support": {
      const ticket = b.tickets.find((t) => t.id === c.id),
        lead = b.leads.find((l) => l.id === ticket?.leadId);
      requireRule(
        ticket?.status === "open" && lead,
        "تذكرة غير متاحة / Ticket unavailable",
      );
      if (c.resolution === "refund") {
        requireRule(
          lead!.paid,
          "تُرد المدفوعات المحصلة فقط / Payment must be collected before refund",
        );
        pay(s, "استرداد عميل / Customer refund", "revenue", lead!.value);
        ticket!.status = "refunded";
        ticket!.satisfaction = 85;
      } else {
        requireRule(
          s.employees.some((e) => available(e, d)),
          "يلزم موظف متاح / Available employee required",
        );
        pay(
          s,
          "معالجة تذكرة / Customer support",
          "expense_support",
          Math.max(10000, Math.round(lead!.value * 0.02)),
        );
        ticket!.status = "resolved";
        ticket!.satisfaction = 95;
      }
      s.reputation = Math.min(100, s.reputation + 1);
      return true;
    }
    case "pay_due": {
      requireRule(
        s.unpaidPayroll > 0,
        "لا توجد مستحقات / No outstanding liabilities",
      );
      pay(
        s,
        "سداد مستحقات متأخرة / Settle liabilities",
        "payable",
        s.unpaidPayroll,
      );
      s.unpaidPayroll = 0;
      return true;
    }
    default:
      return false;
  }
}
export function businessDay(s: State, d: number) {
  const b = business(s);
  for (const e of s.employees) {
    if (e.trainingUntil && e.trainingUntil <= d) {
      e.skill = Math.min(100, e.skill + (e.trainingGain || 0));
      e.trainingGain = 0;
      e.trainingUntil = 0;
      e.memory.push("Training completed");
    }
  }
  for (const o of b.orders)
    if (o.status === "shipping" && o.arrival <= d) {
      post(
        s,
        "استلام مخزون / Shipment received",
        "inventory",
        "prepayments",
        o.total,
      );
      s.inventory = (s.inventory || 0) + o.quantity;
      s.inventoryValue = (s.inventoryValue || 0) + o.total;
      o.status = "delivered";
    }
  for (const p of b.projects)
    if (p.status === "active") {
      const staff = s.employees.filter(
        (e) => p.employeeIds.includes(e.id) && available(e, d),
      );
      if (staff.length && s.office && s.equipment) {
        const duration = p.deadline - p.start;
        const step = Math.min(
          100 - p.progress,
          ((100 / duration) * staff.length) / p.employeeIds.length,
        );
        const target = Math.min(
          p.budget,
          Math.round((p.budget * (p.progress + step)) / 100),
        );
        const cost = target - p.spent;
        if (s.cash >= cost) {
          if (cost)
            pay(
              s,
              "تكلفة مرحلة مشروع / Project delivery cost",
              "expense_projects",
              cost,
            );
          p.spent = target;
          p.progress = Math.min(
            100,
            Math.round((p.progress + step) * 1e8) / 1e8,
          );
        }
        const thresholds = [25, 60, 100];
        while (
          p.milestone < 3 &&
          p.progress + 0.00001 >= thresholds[p.milestone]
        ) {
          const earned =
            Math.round((p.value * thresholds[p.milestone]) / 100) - p.earned;
          const released = Math.min(p.advance, earned);
          if (released)
            post(
              s,
              "إيراد مقابل مقدم مشروع / Earned customer advance",
              "deferred",
              "revenue",
              released,
            );
          if (earned > released)
            post(
              s,
              "تحصيل مرحلة مشروع / Project milestone payment",
              "cash",
              "revenue",
              earned - released,
            );
          p.advance -= released;
          p.earned += earned;
          p.milestone++;
        }
        if (p.milestone === 3) {
          p.progress = 100;
          p.status = "completed";
          s.reputation = Math.min(100, s.reputation + 3);
        }
      }
      if (p.status === "active" && d > p.deadline && !p.penalized) {
        const amount = Math.round(p.value * 0.1);
        post(
          s,
          "استحقاق جزاء تأخير / Delay penalty accrued",
          "expense_penalty",
          "payable",
          amount,
        );
        s.unpaidPayroll += amount;
        p.penalized = true;
        s.reputation = Math.max(0, s.reputation - 5);
      }
    }
  for (const lead of b.leads)
    if (lead.status === "won" && !lead.paid && lead.due <= d) {
      post(
        s,
        "تحصيل فاتورة عميل / Customer invoice collected",
        "cash",
        "receivables",
        lead.value,
      );
      lead.paid = true;
      s.customers++;
    }
  for (const ticket of b.tickets)
    if (
      ticket.status === "open" &&
      d > ticket.due &&
      ticket.satisfaction > 20
    ) {
      ticket.satisfaction = Math.max(20, ticket.satisfaction - 5);
      s.reputation = Math.max(0, s.reputation - 1);
    }
}
