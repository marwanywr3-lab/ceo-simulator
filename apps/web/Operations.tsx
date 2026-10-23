import { useState } from "react";
import { sectors, type Command } from "../../packages/shared";
import type { State, Employee } from "../../packages/simulation";
type Props = {
  s: State;
  ar: boolean;
  act: (command: Command) => Promise<void>;
};
export function Procurement({ s, ar, act }: Props) {
  const [quantity, setQuantity] = useState(100);
  const price = sectors[s.company.sector][4] * 0.3;
  return (
    <section className="panel">
      <h2>{ar ? "المشتريات والمخزون" : "Procurement & inventory"}</h2>
      <p className="muted">
        {ar
          ? "القطاعات المادية تستهلك وحدة مواد لكل وحدة مباعة. تُحتسب تكلفة المخزون بمتوسط التكلفة."
          : "Physical sectors consume one material unit per sold unit. Inventory uses weighted average cost."}
      </p>
      <p>
        {ar ? "الوحدات المتاحة: " : "Available units: "}
        {s.inventory || 0}
      </p>
      <form
        className="action-form"
        onSubmit={(e) => {
          e.preventDefault();
          void act({ type: "purchase", quantity });
        }}
      >
        <label>
          {ar ? "كمية أمر الشراء" : "Purchase order quantity"}
          <input
            type="number"
            min={1}
            max={10000}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </label>
        <button className="primary" type="submit">
          {ar ? "شراء مواد • " : "Purchase materials • "}
          {(price * quantity).toLocaleString()} SAR
        </button>
      </form>
      <p className="muted">
        {ar
          ? "مورد افتراضي: شركة الإمداد المتحدة. التسليم فوري في هذا الإصدار."
          : "Fictional supplier: United Supply Co. Delivery is immediate in this release."}
      </p>
    </section>
  );
}
export function Tender({ s, ar, act }: Props) {
  const [bid, setBid] = useState(sectors[s.company.sector][4] * 100);
  return (
    <section className="panel">
      <h2>{ar ? "مناقصة تنافسية" : "Competitive tender"}</h2>
      <p>
        {ar
          ? "التقييم: ٤٠٪ السعر، ٣٥٪ كفاءة الفريق، ٢٥٪ السمعة. درجة الفوز ٦٨ من ١٠٠."
          : "Evaluation: 40% price, 35% team skill, 25% reputation. Winning score: 68/100."}
      </p>
      <form
        className="action-form"
        onSubmit={(e) => {
          e.preventDefault();
          void act({ type: "tender", bid });
        }}
      >
        <label>
          {ar ? "العرض المالي بالريال" : "Financial bid in SAR"}
          <input
            type="number"
            min={10000}
            max={10000000}
            required
            value={bid}
            onChange={(e) => setBid(Number(e.target.value))}
          />
        </label>
        <button className="primary" type="submit">
          {ar ? "تقديم العرض" : "Submit bid"}
        </button>
      </form>
      {s.bids?.map((b) => (
        <div className="event" key={b.id}>
          <strong>{b.score}/100</strong>
          <span>
            {b.won
              ? ar
                ? "فوز وإنشاء عقد"
                : "Won; contract created"
              : ar
                ? "لم يفز العرض"
                : "Bid not selected"}
          </span>
          <small>{(b.value / 100).toLocaleString()} SAR</small>
        </div>
      ))}
    </section>
  );
}
export function Delegation({
  s,
  ar,
  act,
  employee,
}: {
  s: State;
  ar: boolean;
  act: (command: Command) => Promise<void>;
  employee: Employee;
}) {
  const [budget, setBudget] = useState(5000);
  const d = s.delegations?.find((d) => d.id === employee.id && d.active);
  if (!["CFO", "COO", "CMO"].includes(employee.role)) return null;
  return (
    <div>
      <h3>{ar ? "تفويض التسويق" : "Marketing delegation"}</h3>
      <p className="muted">
        {ar
          ? "ينفذ المدير إنفاقًا أسبوعيًا بحد أقصى ١٬٠٠٠ ريال حتى استنفاد الميزانية المصرّح بها. لا يستطيع تجاوزها."
          : "The manager spends up to SAR 1,000 weekly until the authorized budget is exhausted. Spending cannot exceed the cap."}
      </p>
      {d ? (
        <>
          <p>
            {ar ? "المصروف / السقف: " : "Spent / limit: "}
            {d.spent / 100} / {d.budget / 100} SAR
          </p>
          <button
            className="secondary"
            onClick={() => void act({ type: "revoke", id: employee.id })}
          >
            {ar ? "إلغاء التفويض" : "Revoke delegation"}
          </button>
        </>
      ) : (
        <form
          className="action-form"
          onSubmit={(e) => {
            e.preventDefault();
            void act({ type: "delegate", id: employee.id, budget });
          }}
        >
          <label>
            {ar ? "سقف الميزانية بالريال" : "Budget limit in SAR"}
            <input
              required
              type="number"
              min={1000}
              max={1000000}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
            />
          </label>
          <button className="primary" type="submit">
            {ar ? "منح التفويض" : "Authorize delegation"}
          </button>
        </form>
      )}
    </div>
  );
}
