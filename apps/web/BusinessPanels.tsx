import { useState } from "react";
import { sectors, type Command } from "../../packages/shared";
import type { State } from "../../packages/simulation";
import { suppliers, available } from "../../packages/simulation/business";
import { financialStatements } from "../../packages/simulation/reports";
type Props = { s: State; ar: boolean; act: (c: Command) => Promise<void> };
const amount = (n: number) =>
  (n / 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) + " SAR";
export function PeopleOperations({ s, ar, act }: Props) {
  const [days, setDays] = useState(3),
    d = Math.floor(s.minute / 1440);
  return (
    <section className="panel">
      <h2>{ar ? "تطوير الفريق والإجازات" : "People development & leave"}</h2>
      <p className="muted">
        {ar
          ? "التدريب ٥٠٠ ريال لكل يوم ويضيف نقطتي كفاءة. التدريب والإجازة يوقفان مساهمة الموظف مؤقتًا مع استمرار الراتب. الترقية تزيد الراتب ١٥٪ ومكافأتها ربع راتب."
          : "Training costs SAR 500/day and adds two skill points. Training and paid leave temporarily reduce capacity. Promotion adds 15% salary and costs a quarter-salary bonus."}
      </p>
      <label>
        {ar ? "عدد الأيام" : "Days"}
        <input
          type="number"
          min={1}
          max={14}
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        />
      </label>
      {!s.employees.length && (
        <p className="empty">
          {ar ? "وظّف فريقك أولًا." : "Hire your team first."}
        </p>
      )}
      {s.employees.map((e) => (
        <article className="business-row" key={e.id}>
          <div>
            <strong>{e.name}</strong>
            <p>
              {ar ? "الكفاءة" : "Skill"} {e.skill}% · {ar ? "المستوى" : "Level"}{" "}
              {e.level || 1} · {amount(e.salary)}/{ar ? "شهر" : "month"}
            </p>
            <small>
              {!available(e, d)
                ? (e.trainingUntil || 0) > d
                  ? (ar ? "في تدريب حتى اليوم " : "Training until day ") +
                    (e.trainingUntil! + 1)
                  : (ar ? "إجازة حتى اليوم " : "On leave until day ") +
                    (e.leaveUntil! + 1)
                : ar
                  ? "متاح للعمل"
                  : "Available"}
            </small>
          </div>
          <div className="button-row">
            <button
              className="secondary"
              disabled={!available(e, d) || e.skill >= 100}
              onClick={() => void act({ type: "train", id: e.id, days })}
            >
              {ar ? "تدريب" : "Train"}
            </button>
            <button
              className="secondary"
              disabled={!available(e, d)}
              onClick={() => void act({ type: "leave", id: e.id, days })}
            >
              {ar ? "إجازة مدفوعة" : "Paid leave"}
            </button>
            <button
              className="secondary"
              disabled={!available(e, d) || (e.level || 1) >= 3}
              onClick={() => void act({ type: "promote", id: e.id })}
            >
              {ar ? "ترقية" : "Promote"}
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
export function SupplyChain({ s, ar, act }: Props) {
  const [supplier, setSupplier] = useState(1),
    [quantity, setQuantity] = useState(100);
  const current = suppliers[supplier],
    unit = Math.round(
      (sectors[s.company.sector][4] * 30 * current.multiplier) / 100,
    );
  return (
    <section className="panel">
      <h2>{ar ? "الموردون والشحنات" : "Suppliers & shipments"}</h2>
      <p className="muted">
        {ar
          ? "الدفع مقدمًا، ويظهر المخزون بعد الوصول فقط. المورد الاقتصادي يؤخر كل شحنة رابعة يومين. الإلغاء قبل الوصول برسوم ٥٪، والإرجاع خلال ٧ أيام من الوصول باسترداد لا يتجاوز ٩٠٪ من سعر الشراء أو القيمة الدفترية."
          : "Prepaid orders enter inventory on arrival. Every fourth Value Source order is delayed two days. Cancellation costs 5%. Returns are available for 7 days, capped at 90% of purchase price or carrying value."}
      </p>
      <form
        className="action-form"
        onSubmit={(e) => {
          e.preventDefault();
          void act({ type: "order", supplier, quantity });
        }}
      >
        <label>
          {ar ? "المورد" : "Supplier"}
          <select
            value={supplier}
            onChange={(e) => setSupplier(Number(e.target.value))}
          >
            {suppliers.map((x, i) => (
              <option value={i} key={i}>
                {ar ? x.name : x.en} · {x.days} {ar ? "أيام" : "days"} ·{" "}
                {x.multiplier}%
              </option>
            ))}
          </select>
        </label>
        <label>
          {ar ? "الكمية" : "Quantity"}
          <input
            required
            type="number"
            min={1}
            max={10000}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </label>
        <button className="primary">
          {ar ? "تأكيد أمر شراء" : "Place purchase order"}
        </button>
      </form>
      <p className="muted">
        {ar ? "قيمة أمر الشراء: " : "Purchase order total: "}
        {amount(unit * quantity)} · {current.days} {ar ? "أيام" : "days"}
      </p>
      {s.business?.orders
        .slice()
        .reverse()
        .map((o) => (
          <article className="business-row" key={o.id}>
            <div>
              <strong>
                {ar ? suppliers[o.supplier].name : suppliers[o.supplier].en}
              </strong>
              <p>
                {o.quantity - o.returned} {ar ? "وحدة" : "units"} ·{" "}
                {amount(o.total)} · {ar ? "وصول يوم " : "Arrival day "}
                {o.arrival + 1}
              </p>
              <small>
                {o.status === "shipping"
                  ? ar
                    ? "قيد الشحن"
                    : "Shipping"
                  : o.status === "delivered"
                    ? ar
                      ? "وصلت"
                      : "Delivered"
                    : ar
                      ? "ملغاة"
                      : "Cancelled"}
                {o.delayed
                  ? " · " + (ar ? "تأخير يومين" : "Two-day delay")
                  : ""}
              </small>
            </div>
            {o.status === "shipping" && (
              <button
                className="secondary"
                onClick={() => void act({ type: "cancel_order", id: o.id })}
              >
                {ar ? "إلغاء مع خصم الرسوم" : "Cancel with fee"}
              </button>
            )}
            {o.status === "delivered" &&
              Math.floor(s.minute / 1440) <= o.arrival + 7 &&
              o.returned < o.quantity && (
                <button
                  className="secondary"
                  disabled={!(s.inventory || 0)}
                  onClick={() =>
                    void act({
                      type: "return_order",
                      id: o.id,
                      quantity: Math.min(
                        o.quantity - o.returned,
                        s.inventory || 0,
                      ),
                    })
                  }
                >
                  {ar ? "إرجاع الكمية المتاحة" : "Return available units"}
                </button>
              )}
          </article>
        ))}
    </section>
  );
}
export function ProjectOperations({ s, ar, act }: Props) {
  const [name, setName] = useState(""),
    [budget, setBudget] = useState(50000),
    [days, setDays] = useState(14),
    [ids, setIds] = useState<string[]>([]);
  return (
    <section className="panel">
      <h2>
        {ar ? "إدارة المشاريع ومراحل الدفع" : "Projects & payment milestones"}
      </h2>
      <p className="muted">
        {ar
          ? "قيمة العقد ١٤٠٪ من ميزانية التكلفة. مقدم ١٠٪ يُسجل التزامًا، وتُكتسب الإيرادات عند ٢٥٪ و٦٠٪ و١٠٠٪ من الإنجاز. الموظف المخصص لا يعمل في الإنتاج العام. التأخر يضيف جزاءً واحدًا ١٠٪، والإلغاء يرد المقدم غير المكتسب ويكلف ٥٪ من العقد."
          : "Contract value is 140% of cost budget. A 10% advance is a liability; revenue is earned at 25%, 60% and 100% delivery. Assigned staff leave general production. Late delivery incurs one 10% penalty. Cancellation refunds unearned advances and costs 5% of contract value."}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void act({ type: "project", name, budget, days, employeeIds: ids });
        }}
      >
        <div className="action-form">
          <label>
            {ar ? "اسم المشروع" : "Project name"}
            <input
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            {ar ? "ميزانية التكلفة بالريال" : "Cost budget in SAR"}
            <input
              required
              type="number"
              min={10000}
              max={1000000}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
            />
          </label>
          <label>
            {ar ? "موعد التسليم بالأيام" : "Delivery in days"}
            <input
              required
              type="number"
              min={7}
              max={180}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
          </label>
        </div>
        <fieldset>
          <legend>{ar ? "الفريق المخصص" : "Assigned team"}</legend>
          {s.employees.map((e) => (
            <label className="check-label" key={e.id}>
              <input
                type="checkbox"
                checked={ids.includes(e.id)}
                disabled={s.business?.projects.some(
                  (p) => p.status === "active" && p.employeeIds.includes(e.id),
                )}
                onChange={(event) =>
                  setIds(
                    event.target.checked
                      ? [...ids, e.id]
                      : ids.filter((id) => id !== e.id),
                  )
                }
              />
              {e.name}
            </label>
          ))}
        </fieldset>
        <button className="primary" disabled={!ids.length}>
          {ar ? "توقيع عقد المشروع" : "Sign project contract"}
        </button>
      </form>
      {s.business?.projects.map((p) => (
        <article className="business-row" key={p.id}>
          <div>
            <h3>{p.name}</h3>
            <p>
              {ar ? "القيمة" : "Value"} {amount(p.value)} ·{" "}
              {ar ? "المصروف" : "Spent"} {amount(p.spent)} ·{" "}
              {ar ? "الإيراد المكتسب" : "Earned"} {amount(p.earned)}
            </p>
            <progress max={100} value={p.progress} />
            <p>
              {Math.round(p.progress)}% · {ar ? "التسليم يوم " : "Due day "}
              {p.deadline + 1} ·{" "}
              {p.status === "active"
                ? ar
                  ? "نشط"
                  : "Active"
                : p.status === "completed"
                  ? ar
                    ? "مكتمل"
                    : "Completed"
                  : ar
                    ? "ملغى"
                    : "Cancelled"}
            </p>
            {p.penalized && (
              <small>
                {ar
                  ? "سُجل جزاء التأخير في المستحقات."
                  : "Delay penalty was accrued."}
              </small>
            )}
          </div>
          {p.status === "active" && (
            <button
              className="secondary"
              onClick={() => void act({ type: "cancel_project", id: p.id })}
            >
              {ar ? "إلغاء العقد مع الجزاء" : "Cancel with penalty"}
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
export function CustomerOperations({ s, ar, act }: Props) {
  const [name, setName] = useState(""),
    [budget, setBudget] = useState(10000);
  return (
    <section className="panel">
      <h2>
        {ar ? "العملاء وخدمة ما بعد البيع" : "Customers & after-sales care"}
      </h2>
      <p className="muted">
        {ar
          ? "سجّل فرصة ثم قدّم عرضًا من منتج مكتمل، بحد أقصى ١٠ وحدات. يعتمد القبول على السمعة والكفاءة. الفاتورة تُحصّل بعد ٣ أيام، والتذكرة تحتاج معالجة قبل مرور ٧ أيام لحماية السمعة."
          : "Add a lead and pitch a ready product, capped at 10 units. Reputation and skill decide acceptance. Invoices collect after 3 days; support is due within 7 days to protect reputation."}
      </p>
      <form
        className="action-form"
        onSubmit={(e) => {
          e.preventDefault();
          void act({ type: "lead", name, budget });
        }}
      >
        <label>
          {ar ? "اسم العميل" : "Customer name"}
          <input
            required
            minLength={2}
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          {ar ? "ميزانية العميل بالريال" : "Customer budget in SAR"}
          <input
            required
            type="number"
            min={1000}
            max={1000000}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
          />
        </label>
        <button className="primary">{ar ? "إضافة فرصة" : "Add lead"}</button>
      </form>
      {s.business?.leads.map((l) => (
        <article className="business-row" key={l.id}>
          <div>
            <strong>{l.name}</strong>
            <p>
              {l.status === "new"
                ? ar
                  ? "فرصة جديدة"
                  : "New lead"
                : l.status === "lost"
                  ? ar
                    ? "رفض العرض"
                    : "Lost"
                  : (l.paid
                      ? ar
                        ? "فاتورة محصلة"
                        : "Paid invoice"
                      : ar
                        ? "فاتورة مستحقة"
                        : "Invoice due") +
                    " · " +
                    amount(l.value)}
            </p>
          </div>
          {l.status === "new" && (
            <button
              className="secondary"
              onClick={() => void act({ type: "pitch", id: l.id })}
            >
              {ar ? "تقديم عرض بيع" : "Pitch product"}
            </button>
          )}
        </article>
      ))}
      <h3>{ar ? "تذاكر العملاء" : "Customer tickets"}</h3>
      {s.business?.tickets.map((ticket) => (
        <article className="business-row" key={ticket.id}>
          <div>
            <strong>
              {s.business?.leads.find((l) => l.id === ticket.leadId)?.name}
            </strong>
            <p>
              {ar ? "رضا العميل" : "Satisfaction"} {ticket.satisfaction}% ·{" "}
              {ar ? "الموعد يوم " : "Due day "}
              {ticket.due + 1} ·{" "}
              {ticket.status === "open"
                ? ar
                  ? "مفتوحة"
                  : "Open"
                : ticket.status === "resolved"
                  ? ar
                    ? "عولجت"
                    : "Resolved"
                  : ar
                    ? "استرداد"
                    : "Refunded"}
            </p>
          </div>
          {ticket.status === "open" && (
            <div className="button-row">
              <button
                className="secondary"
                onClick={() =>
                  void act({
                    type: "support",
                    id: ticket.id,
                    resolution: "resolve",
                  })
                }
              >
                {ar ? "معالجة التذكرة" : "Resolve ticket"}
              </button>
              <button
                className="secondary"
                disabled={
                  !s.business?.leads.find((l) => l.id === ticket.leadId)?.paid
                }
                onClick={() =>
                  void act({
                    type: "support",
                    id: ticket.id,
                    resolution: "refund",
                  })
                }
              >
                {ar ? "استرداد كامل" : "Full refund"}
              </button>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
export function Statements({ s, ar }: Omit<Props, "act">) {
  const [month, setMonth] = useState(-1),
    last = Math.floor(s.minute / 1440),
    from = month < 0 ? 0 : month * 30,
    to = month < 0 ? last : Math.min(last, from + 29),
    r = financialStatements(s, from, to);
  return (
    <section className="panel">
      <h2>
        {ar ? "قائمة الدخل والتدفقات النقدية" : "Income & cash flow statements"}
      </h2>
      <label>
        {ar ? "الفترة" : "Period"}
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          <option value={-1}>{ar ? "منذ التأسيس" : "Since founding"}</option>
          {Array.from({ length: Math.floor(last / 30) + 1 }, (_, i) => (
            <option key={i} value={i}>
              {ar ? "الشهر " : "Month "}
              {i + 1}
            </option>
          ))}
        </select>
      </label>
      <div className="two-col">
        <div>
          <h3>{ar ? "قائمة الدخل" : "Income statement"}</h3>
          <p>
            {ar ? "الإيرادات" : "Revenue"}: {amount(r.income.revenue)}
          </p>
          {r.income.expenseBreakdown.map((x) => (
            <p key={x.account}>
              {(
                {
                  expense_payroll: ar ? "الرواتب" : "Payroll",
                  expense_rent: ar ? "الإيجار" : "Rent",
                  expense_cogs: ar ? "تكلفة المبيعات" : "Cost of sales",
                  expense_projects: ar ? "تكلفة المشاريع" : "Project costs",
                  expense_training: ar ? "التدريب" : "Training",
                  expense_support: ar ? "خدمة العملاء" : "Support",
                  expense_penalty: ar ? "الجزاءات" : "Penalties",
                } as Record<string, string>
              )[x.account] || x.account}
              : {amount(x.amount)}
            </p>
          ))}
          <strong>
            {ar ? "صافي الربح" : "Net profit"}: {amount(r.income.profit)}
          </strong>
        </div>
        <div>
          <h3>{ar ? "التدفقات النقدية" : "Cash flow"}</h3>
          {[
            [ar ? "نقدية أول الفترة" : "Opening cash", r.cashFlow.openingCash],
            [ar ? "التشغيل" : "Operating", r.cashFlow.operating],
            [ar ? "الاستثمار" : "Investing", r.cashFlow.investing],
            [ar ? "التمويل" : "Financing", r.cashFlow.financing],
            [ar ? "نقدية آخر الفترة" : "Closing cash", r.cashFlow.closingCash],
          ].map(([label, value]) => (
            <p key={label}>
              {label}: {amount(value as number)}
            </p>
          ))}
          <p>
            {ar ? "ذمم العملاء" : "Receivables"}:{" "}
            {amount(r.balanceSheet.accounts.receivables || 0)}
          </p>
          <p>
            {ar ? "دفعات الموردين" : "Supplier prepayments"}:{" "}
            {amount(r.balanceSheet.accounts.prepayments || 0)}
          </p>
          <p>
            {ar ? "مقدمات العملاء غير المكتسبة" : "Unearned customer advances"}:{" "}
            {amount(0 - (r.balanceSheet.accounts.deferred || 0))}
          </p>
        </div>
      </div>
      <button
        className="secondary"
        onClick={() => {
          const u = URL.createObjectURL(
            new Blob([JSON.stringify(r, null, 2)], {
              type: "application/json",
            }),
          );
          const a = document.createElement("a");
          a.href = u;
          a.download = "financial-statements.json";
          a.click();
          URL.revokeObjectURL(u);
        }}
      >
        {ar ? "تصدير القوائم" : "Export statements"}
      </button>
    </section>
  );
}
