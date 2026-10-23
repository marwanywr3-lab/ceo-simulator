import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { create } from "zustand";
import { BrowserRouter } from "react-router-dom";
import {
  Building2,
  LayoutDashboard,
  Users,
  BriefcaseBusiness,
  Package,
  Landmark,
  ChartNoAxesCombined,
  Globe,
  MessageSquare,
  Settings,
  ArrowUpRight,
  Play,
  Pause,
  Smartphone,
  LogOut,
  ChevronLeft,
  Plus,
  Check,
  Clock3,
  ShieldCheck,
  MapPin,
} from "lucide-react";
import {
  sectors,
  candidates,
  type CareerInput,
  type Command,
} from "../../packages/shared";
import { report, type State } from "../../packages/simulation";
import "./style.css";
import { Procurement, Tender, Delegation } from "./Operations";
import { cacheSave } from "./cache";
import { Scene, asset } from "./Scene";
import { GoogleSignIn } from "./GoogleSignIn";
type Save = { id: string; revision: number; name: string; state: State };
const useUI = create<{
  lang: "ar" | "en";
  token: string;
  setLang: (v: "ar" | "en") => void;
  setToken: (v: string) => void;
}>((set) => ({
  lang: localStorage.getItem("language") === "en" ? "en" : "ar",
  token: "",
  setLang: (lang) => {
    localStorage.setItem("language", lang);
    set({ lang });
  },
  setToken: (token) => set({ token }),
}));
const qc = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});
const API =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_API_URL || "";
async function api<T = Save>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const r = await fetch(API + "/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + useUI.getState().token,
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const v = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new Error(v.error || "Request failed");
  return v;
}
const icons = [
  LayoutDashboard,
  Users,
  Package,
  BriefcaseBusiness,
  Landmark,
  ChartNoAxesCombined,
  Globe,
  MessageSquare,
  Settings,
];
const navAr = [
  "مركز القيادة",
  "الفريق التنفيذي",
  "المنتجات",
  "العقود والمشاريع",
  "البنك والتمويل",
  "التقارير المالية",
  "العالم والفروع",
  "الاتصالات",
  "الإعدادات",
];
const navEn = [
  "Command center",
  "Executive team",
  "Products",
  "Contracts & projects",
  "Bank & finance",
  "Financial reports",
  "World & branches",
  "Communications",
  "Settings",
];
function App() {
  const { lang, setLang, token, setToken } = useUI();
  const ar = lang === "ar";
  const t = (a: string, b: string) => (ar ? a : b);
  const [save, setSave] = useState<Save | null>(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [phone, setPhone] = useState(false);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (save) cacheSave(save.id, save);
  }, [save]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = ar ? "rtl" : "ltr";
  }, [lang]);
  const money = (n: number) =>
    new Intl.NumberFormat(ar ? "ar-SA" : "en-SA", {
      maximumFractionDigits: 0,
    }).format(n / 100) +
    " " +
    t("ر.س", "SAR");
  const careers = useQuery<{ id: string; name: string; revision: number }[]>({
    queryKey: ["careers", token],
    queryFn: () =>
      api<{ id: string; name: string; revision: number }[]>("/careers"),
    enabled: !!token,
  });
  const snapshots = useQuery<
    { id: string; revision: number; created_at: number }[]
  >({
    queryKey: ["snapshots", save?.id, save?.revision],
    queryFn: () =>
      api<{ id: string; revision: number; created_at: number }[]>(
        "/careers/" + save!.id + "/snapshots",
      ),
    enabled: !!save && page === 8,
  });
  async function act(command: Command) {
    if (!save || busy) return;
    setBusy(true);
    setError("");
    try {
      const updated = await api("/careers/" + save.id + "/commands", "POST", {
        id: crypto.randomUUID(),
        revision: save.revision,
        command,
      });
      setSave(updated);
      setNotice(t("تم حفظ القرار", "Decision saved"));
      setTimeout(() => setNotice(""), 2200);
    } catch (e) {
      setRunning(false);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!running || page === 7 || selected) return;
    const timer = setInterval(() => {
      void act({ type: "advance", minutes: 60 });
    }, 5000);
    return () => clearInterval(timer);
  }, [running, save, busy, page, selected]);
  async function load(id: string) {
    try {
      setSave(await api("/careers/" + id));
      setPage(0);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const s = save?.state;
  const r = s ? report(s) : null;
  const button = (label: string, command: Command, secondary = false) => (
    <button
      disabled={busy}
      className={secondary ? "secondary" : "primary"}
      onClick={() => void act(command)}
    >
      {label}
    </button>
  );
  const logout = async () => {
    try {
      await api("/auth/logout", "POST");
    } finally {
      setToken("");
      setSave(null);
      setRunning(false);
      qc.clear();
    }
  };
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage(0);
          }}
        >
          <div className="brand-icon">
            <Building2 size={24} />
          </div>
          <span>
            CEO<span className="brand-sub">SIMULATOR</span>
          </span>
        </a>
        <div className="workspace-label">{t("مساحة العمل", "WORKSPACE")}</div>
        {s && (
          <div className="company-card">
            <Building2 size={22} />
            <div>
              <strong>{s.company.name}</strong>
              <small>{sectors[s.company.sector][ar ? 0 : 1]}</small>
            </div>
          </div>
        )}
        <nav>
          {navAr.map((x, i) => {
            const Icon = icons[i];
            return (
              <button
                key={x}
                className={page === i ? "active" : ""}
                onClick={() => {
                  setPage(i);
                  setSelected(null);
                }}
              >
                <Icon size={19} />
                <span>{ar ? x : navEn[i]}</span>
                {i === 0 && <i />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="status-dot" />
          {t("Ultra • توفير التوكنات", "Ultra • Token saving")}
          <small>{t("لا توجد استدعاءات AI نشطة", "No active AI calls")}</small>
          <button className="lang" onClick={() => setLang(ar ? "en" : "ar")}>
            <Globe size={16} />
            {ar ? "English" : "العربية"}
          </button>
          {token && (
            <button className="lang" onClick={() => void logout()}>
              <LogOut size={16} />
              {t("تسجيل الخروج", "Sign out")}
            </button>
          )}
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            {t("مساحة العمل", "Workspace")}
            <ChevronLeft size={15} />
            <strong>{ar ? navAr[page] : navEn[page]}</strong>
          </div>
          <div className="top-actions">
            <button
              aria-label={t("تغيير اللغة", "Change language")}
              onClick={() => setLang(ar ? "en" : "ar")}
            >
              {ar ? "EN" : "ع"}
            </button>
            <span className="local-badge">
              {API.startsWith("https://")
                ? t("حفظ سحابي", "Cloud saves")
                : t("بيئة تطوير محلية", "Local development")}
            </span>
            <button
              aria-label={t("الهاتف", "Phone")}
              onClick={() => setPhone(!phone)}
            >
              <Smartphone size={20} />
            </button>
            <div className="ceo-name">
              {s?.company.ceo || t("الرئيس التنفيذي", "Chief executive")}
            </div>
          </div>
        </header>
        {error && (
          <div role="alert" className="alert">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}
        {notice && (
          <div role="status" className="toast">
            <Check size={16} />
            {notice}
          </div>
        )}
        {!token ? (
          <Auth t={t} onError={setError} />
        ) : !save ? (
          <div className="content">
            <div className="eyebrow">YOUR NEXT CHAPTER</div>
            <h1>
              {t(
                "كل شركة عظيمة بدأت بقرار.",
                "Every great company starts with a decision.",
              )}
            </h1>
            <p className="muted">
              {t(
                "أسّس شركتك، ابنِ فريقك، واصنع أثرًا في عالم الأعمال.",
                "Found your company, build your team, and make your mark.",
              )}
            </p>
            {careers.data && careers.data.length > 0 && (
              <section className="panel">
                <h2>{t("مسيراتك", "Your careers")}</h2>
                <div className="cards">
                  {careers.data.map((c) => (
                    <button
                      className="career"
                      key={c.id}
                      onClick={() => void load(c.id)}
                    >
                      <Building2 />
                      {c.name}
                      <ArrowUpRight />
                    </button>
                  ))}
                </div>
              </section>
            )}
            <Found
              t={t}
              onCreate={async (input) => {
                try {
                  setSave(await api("/careers", "POST", input));
                  void careers.refetch();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          </div>
        ) : (
          <div className="content">
            <div className="page-heading">
              <div>
                <div className="eyebrow">
                  {t(
                    "رؤيتك. قراراتك. مستقبلك.",
                    "YOUR VISION. YOUR DECISIONS. YOUR FUTURE.",
                  )}
                </div>
                <h1>
                  {page === 0
                    ? t(
                        "صباح القرارات الكبيرة، " + s!.company.ceo,
                        "Time for your next move, " + s!.company.ceo,
                      )
                    : ar
                      ? navAr[page]
                      : navEn[page]}
                </h1>
                <p className="muted">
                  {page === 0
                    ? t(
                        "الصورة الكاملة لأعمالك، وكل ما تحتاجه لاتخاذ الخطوة التالية.",
                        "The full picture of your business. Everything you need for your next move.",
                      )
                    : t(
                        "قرارات حقيقية، ونتائج مرتبطة بمحرك المحاكاة.",
                        "Real decisions, driven by the simulation engine.",
                      )}
                </p>
              </div>
              <div className="clock-card">
                <Clock3 size={18} />
                <div>
                  <strong>
                    {t("اليوم", "Day")} {Math.floor(s!.minute / 1440) + 1}
                  </strong>
                  <small>
                    {String(Math.floor((s!.minute % 1440) / 60)).padStart(
                      2,
                      "0",
                    )}
                    :{String(s!.minute % 60).padStart(2, "0")}
                  </small>
                </div>
                <button
                  aria-label="Play pause"
                  onClick={() => setRunning(!running)}
                >
                  {running ? <Pause size={17} /> : <Play size={17} />}
                </button>
                <button
                  onClick={() => void act({ type: "advance", minutes: 1440 })}
                  disabled={busy}
                >
                  + {t("يوم", "day")}
                </button>
              </div>
            </div>
            {page === 0 && (
              <>
                <div className="metrics">
                  {[
                    [
                      t("السيولة المتاحة", "Available cash"),
                      money(s!.cash),
                      t(
                        "الرصيد الفعلي في دفتر الأستاذ",
                        "From your official ledger",
                      ),
                    ],
                    [
                      t("إجمالي الإيرادات", "Total revenue"),
                      money(r!.revenue),
                      t(
                        "من المبيعات والعقود المسلّمة",
                        "From sales and delivered contracts",
                      ),
                    ],
                    [
                      t("صافي الربح", "Net profit"),
                      money(r!.profit),
                      t("الإيرادات بعد المصروفات", "Revenue less expenses"),
                    ],
                    [
                      t("فريقك التنفيذي", "Your executive team"),
                      String(s!.employees.length),
                      t("موظفون بعقود ورواتب", "Employees on paid contracts"),
                    ],
                  ].map(([label, value, sub], i) => (
                    <div className="metric" key={label}>
                      <div className="metric-top">
                        <span>{label}</span>
                        {i === 3 ? (
                          <Users size={18} />
                        ) : (
                          <ChartNoAxesCombined size={18} />
                        )}
                      </div>
                      <strong dir="auto">{value}</strong>
                      <small>{sub}</small>
                    </div>
                  ))}
                </div>
                <div className="dashboard-grid">
                  <section className="scene-panel">
                    <div className="section-heading">
                      <h2>
                        <Building2 size={18} />
                        {t("مقر الشركة", "Company headquarters")}
                      </h2>
                      <span className="pill">
                        <MapPin size={12} />
                        {s!.company.city}
                      </span>
                    </div>
                    <div className="scene">
                      <Scene s={s!} ar={ar} onNavigate={setPage} />
                      <div className="scene-caption">
                        <span className="pill light">
                          {s!.office
                            ? t("المقر مستأجر", "Office rented")
                            : t("قبل الانطلاق", "Before the first step")}
                        </span>
                        <h2>
                          {s!.equipment
                            ? t(
                                "مساحتك لصناعة المستقبل",
                                "Your space to shape the future",
                              )
                            : t("البداية من هنا.", "It all begins here.")}
                        </h2>
                        <p>
                          {t(
                            "ابنِ شركة تستحق رؤيتك.",
                            "Build a company worthy of your vision.",
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="scene-actions">
                      {!s!.office ? (
                        button(
                          t(
                            "استئجار المقر • ٤٥٬٠٠٠ ر.س",
                            "Rent office • SAR 45,000",
                          ),
                          { type: "rent" },
                        )
                      ) : !s!.equipment ? (
                        button(
                          t("تجهيز المقر • ", "Equip office • ") +
                            money(sectors[s!.company.sector][2] * 100),
                          { type: "equip" },
                        )
                      ) : (
                        <span className="success">
                          <Check size={16} />
                          {t("المقر جاهز للعمل", "Ready for business")}
                        </span>
                      )}
                      <button
                        className="text-button"
                        onClick={() => setPage(6)}
                      >
                        {t("استكشف المدينة", "Explore the city")}
                        <ArrowUpRight size={15} />
                      </button>
                    </div>
                  </section>
                  <section className="panel next-steps">
                    <div className="section-heading">
                      <h2>{t("الخطوة التالية", "Your next move")}</h2>
                      <span className="pill">
                        {t("قراراتك تصنع الفرق", "You make the difference")}
                      </span>
                    </div>
                    <p className="muted">
                      {t(
                        "أنت تحدد طريق شركتك. هذه خيارات متاحة وليست مهامًا إلزامية.",
                        "You set your company’s direction. These are options, not mandatory tasks.",
                      )}
                    </p>
                    {[
                      [
                        Users,
                        t("ابنِ فريقك الأول", "Build your first team"),
                        t(
                          "استقطب الكفاءات المناسبة لرؤيتك",
                          "Find the right talent for your vision",
                        ),
                        1,
                      ],
                      [
                        Package,
                        t("حوّل فكرتك إلى منتج", "Turn an idea into a product"),
                        t(
                          "استثمر في التطوير وابدأ البيع",
                          "Invest in development and start selling",
                        ),
                        2,
                      ],
                      [
                        BriefcaseBusiness,
                        t("افتح أبواب الأعمال", "Open doors to new business"),
                        t(
                          "نفّذ عقودًا بقدرتك التشغيلية",
                          "Deliver contracts with your team",
                        ),
                        3,
                      ],
                    ].map(([I, title, sub, p], i) => {
                      const Icon = I as typeof Users;
                      return (
                        <button
                          className="step"
                          key={i}
                          onClick={() => setPage(p as number)}
                        >
                          <span className="step-icon">
                            <Icon size={19} />
                          </span>
                          <span>
                            <strong>{title as string}</strong>
                            <small>{sub as string}</small>
                          </span>
                          <ChevronLeft size={17} />
                        </button>
                      );
                    })}
                    <div className="simulation-note">
                      <ShieldCheck size={20} />
                      <span>
                        {t(
                          "كل قرار يُحفظ تلقائيًا على الخادم. الوقت يتقدم أثناء اللعب فقط.",
                          "Every decision saves on the server. Time advances only while playing.",
                        )}
                      </span>
                    </div>
                  </section>
                </div>
                <div className="bottom-grid">
                  <section className="panel">
                    <div className="section-heading">
                      <h2>{t("نبض السوق", "Market pulse")}</h2>
                      <span className="pill">
                        {sectors[s!.company.sector][ar ? 0 : 1]}
                      </span>
                    </div>
                    <div className="market-number">
                      <strong>{s!.demand}%</strong>
                      <span>{t("مؤشر الطلب", "Demand index")}</span>
                      <div className="bars">
                        {Array.from({ length: 18 }, (_, i) => (
                          <i
                            key={i}
                            style={{
                              height:
                                30 +
                                Math.sin(i * 0.7 + s!.minute / 1440) * 18 +
                                i * 2 +
                                "px",
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="muted">
                      {t(
                        "يتغير مع تقدم الوقت ومنافسة السوق.",
                        "Changes with simulated time and market competition.",
                      )}
                    </p>
                  </section>
                  <section className="panel">
                    <div className="section-heading">
                      <h2>{t("سجل القرارات", "Decision log")}</h2>
                      <span className="pill">{t("مباشر", "Live")}</span>
                    </div>
                    {s!.events.length === 0 ? (
                      <p className="empty">
                        {t(
                          "صفحة جديدة. قرارك الأول ينتظر.",
                          "A fresh start. Your first decision awaits.",
                        )}
                      </p>
                    ) : (
                      s!.events
                        .slice(-4)
                        .reverse()
                        .map((e, i) => (
                          <div className="event" key={i}>
                            <i />
                            <span>{eventLabel(e.text, ar)}</span>
                            <small>
                              {t("اليوم", "Day")}{" "}
                              {Math.floor(e.minute / 1440) + 1}
                            </small>
                          </div>
                        ))
                    )}
                  </section>
                </div>
              </>
            )}
            {page === 1 && (
              <>
                <section className="panel">
                  <h2>{t("الفريق الحالي", "Current team")}</h2>
                  {s!.employees.length === 0 && (
                    <p className="empty">
                      {t("لم توظّف أي موظف بعد.", "You have no employees yet.")}
                    </p>
                  )}
                  <div className="cards">
                    {s!.employees.map((e) => (
                      <button
                        className="npc"
                        key={e.id}
                        onClick={() => setSelected(e.id)}
                      >
                        <span className="status-dot" />
                        <strong>{e.name}</strong>
                        <span>{e.role}</span>
                        <small>{t("متاح", "Available")}</small>
                      </button>
                    ))}
                  </div>
                </section>
                <section className="panel">
                  <h2>{t("سوق الكفاءات", "Talent market")}</h2>
                  <p className="muted">
                    {t(
                      "رسوم التوظيف نصف راتب شهر. الرواتب تستحق كل ٣٠ يومًا.",
                      "Hiring costs half a monthly salary. Payroll accrues every 30 days.",
                    )}
                  </p>
                  <div className="cards">
                    {candidates.map((c, i) => (
                      <article className="candidate" key={c.role}>
                        <div className="candidate-top">
                          <span className="role-tag">{c.role}</span>
                          <span>
                            {t("كفاءة", "Skill")} {c.skill}%
                          </span>
                        </div>
                        <h3>{ar ? c.name : c.en}</h3>
                        <p>
                          {money(c.salary * 100)} / {t("شهر", "month")}
                        </p>
                        {button(t("تقديم عرض وتوظيف", "Offer & hire"), {
                          type: "hire",
                          candidate: i,
                        })}
                      </article>
                    ))}
                  </div>
                </section>
              </>
            )}
            {page === 2 && (
              <>
                <Procurement s={s!} ar={ar} act={act} />
                <section className="panel">
                  <h2>{t("مختبر المنتجات", "Product studio")}</h2>
                  <p className="muted">
                    {t(
                      "التطوير يتطلب مقرًا مجهزًا وفريقًا. تتباين المدة والتكلفة والقدرة الإنتاجية حسب القطاع.",
                      "Development requires an equipped office and a team. Cost, duration and capacity vary by sector.",
                    )}
                  </p>
                  <ActionForm
                    fields={[
                      [
                        "name",
                        t("اسم المنتج أو الخدمة", "Product or service name"),
                        "text",
                      ],
                      [
                        "price",
                        t("سعر الوحدة بالريال", "Unit price in SAR"),
                        "number",
                      ],
                    ]}
                    label={t("ابدأ التطوير", "Start development")}
                    onSubmit={(v) =>
                      act({
                        type: "develop",
                        name: v.name,
                        price: Number(v.price),
                      })
                    }
                  />
                </section>
                <div className="cards">
                  {s!.products.map((p) => (
                    <section className="panel" key={p.id}>
                      <span className="pill">
                        {p.progress === 100
                          ? t("في السوق", "Live")
                          : t("قيد التطوير", "In development")}
                      </span>
                      <h2>{p.name}</h2>
                      <p>{money(p.price)}</p>
                      <progress max={100} value={p.progress} />
                      <p>
                        {Math.round(p.progress)}% · {p.sold}{" "}
                        {t("وحدة مباعة", "units sold")}
                      </p>
                    </section>
                  ))}
                </div>
                <section className="panel">
                  <h2>{t("حملة تسويق", "Marketing campaign")}</h2>
                  <ActionForm
                    fields={[
                      [
                        "budget",
                        t("الميزانية بالريال", "Budget in SAR"),
                        "number",
                      ],
                    ]}
                    label={t("إطلاق الحملة", "Launch campaign")}
                    onSubmit={(v) =>
                      act({ type: "marketing", budget: Number(v.budget) })
                    }
                  />
                  <p className="muted">
                    {t(
                      "يزيد الإنفاق الطلب الفعلي على المنتجات المتاحة، ويتناقص أثره يوميًا.",
                      "Spending increases demand for live products; its effect decays daily.",
                    )}
                  </p>
                </section>
              </>
            )}
            {page === 3 && (
              <>
                <Tender s={s!} ar={ar} act={act} />
                <section className="panel">
                  <h2>{t("عقود الخدمات", "Service contracts")}</h2>
                  <p className="muted">
                    {t(
                      "عقد محاكاة ثابت القيمة، يُقبض عند التسليم. التقدم مرتبط بعدد الموظفين وتجهيز المقر.",
                      "Fixed-value simulation contracts are paid on delivery. Progress depends on staffing and equipment.",
                    )}
                  </p>
                  {button(t("قبول عقد تشغيل", "Accept operating contract"), {
                    type: "contract",
                  })}
                  {s!.contracts.map((c) => (
                    <div className="contract" key={c.id}>
                      <h3>
                        {t("عقد", "Contract")} {c.id.slice(0, 8)}
                      </h3>
                      <strong>{money(c.value)}</strong>
                      <p>
                        {c.status === "active"
                          ? t("جارٍ التنفيذ", "In progress")
                          : t("تم التسليم والتحصيل", "Delivered & paid")}
                      </p>
                      <progress max={100} value={c.progress} />
                      <p>{c.progress}%</p>
                    </div>
                  ))}
                </section>
              </>
            )}
            {page === 4 && (
              <div className="two-col">
                <section className="panel">
                  <span className="eyebrow">HORIZON BANK · FICTIONAL</span>
                  <h2>{t("تمويل رؤيتك", "Finance your vision")}</h2>
                  <p>
                    {t(
                      "بنك آفاق الافتراضي • فائدة محاكاة ٨٪ سنويًا، تحصّل شهريًا.",
                      "Fictional Horizon Bank • 8% simulated annual interest, collected monthly.",
                    )}
                  </p>
                  <p className="muted">
                    {t(
                      "حد التمويل نصف رأس المال، بحد أقصى مليون ريال.",
                      "Borrow up to half your starting capital, capped at SAR 1 million.",
                    )}
                  </p>
                  <ActionForm
                    fields={[
                      [
                        "amount",
                        t("مبلغ التمويل بالريال", "Loan amount in SAR"),
                        "number",
                      ],
                    ]}
                    label={t("الحصول على التمويل", "Take loan")}
                    onSubmit={(v) =>
                      act({ type: "loan", amount: Number(v.amount) })
                    }
                  />
                </section>
                <section className="panel">
                  <h2>{t("التزاماتك", "Your liabilities")}</h2>
                  {s!.loans.map((l, i) => (
                    <div key={i}>
                      <h3>{money(l.remaining)}</h3>
                      <p>
                        {l.rate}% {t("سنويًا", "annually")}
                      </p>
                      {button(t("سداد كامل الأصل", "Repay principal"), {
                        type: "repay",
                      })}
                    </div>
                  ))}
                  {!s!.loans.length && (
                    <p className="empty">
                      {t("لا توجد قروض نشطة", "No active loans")}
                    </p>
                  )}
                  <p>
                    {t(
                      "مستحقات التشغيل المتأخرة: ",
                      "Overdue operating liabilities: ",
                    )}
                    {money(s!.unpaidPayroll)}
                  </p>
                </section>
              </div>
            )}
            {page === 5 && (
              <>
                <div className="metrics">
                  {[
                    [t("الأصول", "Assets"), r!.assets],
                    [t("الالتزامات", "Liabilities"), r!.liabilities],
                    [t("حقوق الملكية", "Equity"), r!.equity],
                    [t("صافي الربح", "Net profit"), r!.profit],
                  ].map(([k, v]) => (
                    <div className="metric" key={k}>
                      <span>{k}</span>
                      <strong>{money(v as number)}</strong>
                    </div>
                  ))}
                </div>
                <section className="panel">
                  <h2>{t("دفتر الأستاذ", "General ledger")}</h2>
                  <p className="success">
                    <ShieldCheck size={17} />
                    {r!.balanced
                      ? t("جميع القيود متوازنة", "All entries balanced")
                      : "Error"}
                  </p>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>{t("اليوم", "Day")}</th>
                          <th>{t("البيان", "Description")}</th>
                          <th>{t("الحساب", "Account")}</th>
                          <th>{t("مدين", "Debit")}</th>
                          <th>{t("دائن", "Credit")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s!.journal.flatMap((e) =>
                          e.lines.map((l, i) => (
                            <tr key={e.id + i}>
                              <td>{e.day + 1}</td>
                              <td>
                                {e.description.split(" / ")[ar ? 0 : 1] ||
                                  e.description}
                              </td>
                              <td>{l.account}</td>
                              <td>{money(l.debit)}</td>
                              <td>{money(l.credit)}</td>
                            </tr>
                          )),
                        )}
                      </tbody>
                    </table>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => {
                      const blob = new Blob(
                        [
                          JSON.stringify(
                            { report: r, journal: s!.journal },
                            null,
                            2,
                          ),
                        ],
                        { type: "application/json" },
                      );
                      const u = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = u;
                      a.download = "financial-report.json";
                      a.click();
                      URL.revokeObjectURL(u);
                    }}
                  >
                    {t("تصدير التقرير", "Export report")}
                  </button>
                </section>
              </>
            )}
            {page === 6 && (
              <>
                <div className="two-col">
                  <section className="panel">
                    <h2>{t("خريطة أعمالك", "Your business world")}</h2>
                    <div className="cards">
                      {(["office", "city", "industry"] as const).map(
                        (location, i) => (
                          <button
                            className="secondary"
                            key={location}
                            onClick={() =>
                              void act({ type: "travel", location })
                            }
                          >
                            {
                              [
                                t("المقر • ٣٠ دقيقة", "Office • 30 min"),
                                t("المدينة • ٦٠ دقيقة", "City • 60 min"),
                                t("المنشآت • ٩٠ دقيقة", "Industry • 90 min"),
                              ][i]
                            }
                          </button>
                        ),
                      )}
                    </div>
                    <p>
                      {t("الموقع الحالي: ", "Current location: ")}
                      {s!.location}
                    </p>
                    <img
                      className="world-image"
                      src={asset(s!, "landscape")}
                      alt={t("الموقع الحالي", "Current location")}
                    />
                  </section>
                  <section className="panel">
                    <h2>{t("التوسع والفروع", "Expansion & branches")}</h2>
                    <p>
                      {t(
                        "يتطلب مدير عمليات واستثمار ٢٥٠٬٠٠٠ ريال.",
                        "Requires a COO and SAR 250,000 investment.",
                      )}
                    </p>
                    <ActionForm
                      fields={[["city", t("المدينة", "City"), "text"]]}
                      label={t("افتتاح فرع", "Open branch")}
                      onSubmit={(v) => act({ type: "branch", city: v.city })}
                    />
                    {s!.branches.map((c) => (
                      <p key={c}>
                        <MapPin size={16} />
                        {c}
                      </p>
                    ))}
                  </section>
                </div>
                <section className="panel">
                  <h2>{t("المنافسون", "Competitors")}</h2>
                  <div className="cards">
                    {s!.competitors.map((c) => (
                      <div className="candidate" key={c.name}>
                        <h3>{c.name}</h3>
                        <p>
                          {t("مؤشر الحصة", "Share index")}: {c.share}%
                        </p>
                        <p>
                          {t("مؤشر السعر", "Price index")}: {c.price}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}
            {page === 7 && (
              <section className="panel">
                <h2>{t("غرفة الاجتماعات", "Meeting room")}</h2>
                <p className="muted">
                  {t(
                    "يتوقف التقدم التلقائي للوقت هنا. تُحفظ الأجندة في ذاكرة كل موظف؛ حوار AI غير مفعّل.",
                    "Automatic time pauses here. The agenda is saved in every employee’s memory; AI dialogue is not enabled.",
                  )}
                </p>
                <ActionForm
                  fields={[
                    [
                      "agenda",
                      t("جدول الأعمال والقرارات", "Agenda and decisions"),
                      "text",
                    ],
                  ]}
                  label={t("تسجيل اجتماع الفريق", "Record team meeting")}
                  onSubmit={(v) => act({ type: "meeting", agenda: v.agenda })}
                />
                {s!.messages.map((m) => (
                  <article className="message" key={m.id}>
                    <small>{m.from}</small>
                    <p>{m.text}</p>
                  </article>
                ))}
                {!s!.messages.length && (
                  <p className="empty">
                    {t("لا توجد مراسلات بعد.", "No messages yet.")}
                  </p>
                )}
              </section>
            )}
            {page === 8 && (
              <div className="two-col">
                <section className="panel">
                  <h2>{t("المسيرات والحفظ", "Careers & saves")}</h2>
                  <p>
                    {t("إصدار الحالة", "State revision")}: {save.revision}
                  </p>
                  {button(t("إنشاء نقطة استعادة", "Create restore point"), {
                    type: "snapshot",
                  })}
                  <button
                    className="secondary"
                    onClick={() => {
                      setSave(null);
                      setRunning(false);
                      void careers.refetch();
                    }}
                  >
                    {t("اختيار مسيرة أخرى", "Choose another career")}
                  </button>
                  <h3>{t("نقاط الاستعادة", "Restore points")}</h3>
                  {snapshots.data?.map((x) => (
                    <div className="event" key={x.id}>
                      <span>{new Date(x.created_at).toLocaleString(lang)}</span>
                      {button(
                        t("استعادة", "Restore") + " #" + x.revision,
                        { type: "restore", id: x.id },
                        true,
                      )}
                    </div>
                  ))}
                </section>
                <section className="panel">
                  <h2>{t("اللغة والخدمات", "Language & services")}</h2>
                  <button
                    className="secondary"
                    onClick={() => setLang(ar ? "en" : "ar")}
                  >
                    {ar ? "English" : "العربية"}
                  </button>
                  <h3>Ultra Token Saving</h3>
                  <p>
                    {t(
                      "الاستهلاك: ٠ توكن • التكلفة: ٠",
                      "Usage: 0 tokens • Cost: 0",
                    )}
                  </p>
                  <p className="muted">
                    {t(
                      "Gemini وClaude غير مهيأين. لا يُطلب تحقق بريدي. استعادة كلمة المرور تحتاج مزود بريد.",
                      "Gemini and Claude are unconfigured. No email verification is required. Password reset requires a mail provider.",
                    )}
                  </p>
                  <p className="muted">
                    {t(
                      "هذه محاكاة خيالية وليست خدمة حكومية أو مصرفية حقيقية.",
                      "This is a fictional simulation, not a real government or banking service.",
                    )}
                  </p>
                </section>
              </div>
            )}
          </div>
        )}
        {phone && (
          <div className="phone">
            <div className="phone-header">
              <Smartphone size={20} />
              <strong>CEO Connect</strong>
              <button onClick={() => setPhone(false)}>×</button>
            </div>
            <p>{t("أعمالك، أينما كنت.", "Your business, wherever you are.")}</p>
            {[1, 3, 5, 7, 8].map((i) => (
              <button
                key={i}
                onClick={() => {
                  setPage(i);
                  setPhone(false);
                }}
              >
                {ar ? navAr[i] : navEn[i]}
                <ChevronLeft size={16} />
              </button>
            ))}
            {s && (
              <small>
                {t("السيولة", "Cash")}: {money(s.cash)}
              </small>
            )}
          </div>
        )}
        {selected && s && (
          <div className="modal-backdrop" onClick={() => setSelected(null)}>
            <section
              role="dialog"
              aria-modal="true"
              aria-label={t("الموظف", "Employee")}
              className="modal panel"
              onClick={(e) => e.stopPropagation()}
            >
              <button className="close" onClick={() => setSelected(null)}>
                ×
              </button>
              {(() => {
                const e = s.employees.find((x) => x.id === selected);
                return e ? (
                  <>
                    <span className="pill">
                      {e.role} · {t("متاح", "Available")}
                    </span>
                    <h2>{e.name}</h2>
                    <p>
                      {t("الراتب", "Salary")}: {money(e.salary)} ·{" "}
                      {t("الثقة", "Trust")}: {e.trust}%
                    </p>
                    <ActionForm
                      fields={[["name", t("الاسم الجديد", "New name"), "text"]]}
                      label={t("تغيير الاسم", "Rename")}
                      onSubmit={(v) =>
                        act({ type: "rename", id: e.id, name: v.name })
                      }
                    />
                    <ActionForm
                      fields={[
                        ["text", t("رسالة أو مهمة", "Message or task"), "text"],
                      ]}
                      label={t("إرسال", "Send")}
                      onSubmit={(v) =>
                        act({ type: "message", id: e.id, text: v.text })
                      }
                    />
                    <Delegation s={s} ar={ar} act={act} employee={e} />
                    <h3>{t("الذاكرة", "Memory")}</h3>
                    {e.memory.map((m, i) => (
                      <p key={i}>{m}</p>
                    ))}
                    <button
                      className="danger"
                      onClick={() => {
                        void act({ type: "fire", id: e.id });
                        setSelected(null);
                      }}
                    >
                      {t(
                        "إنهاء الخدمة • تعويض راتب شهر",
                        "Terminate • One month severance",
                      )}
                    </button>
                  </>
                ) : null;
              })()}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
function eventLabel(type: string, ar: boolean) {
  const labels: Record<string, string[]> = {
    purchase: ["شراء مواد", "Materials purchased"],
    delegate: ["منح تفويض", "Delegation authorized"],
    revoke: ["إلغاء تفويض", "Delegation revoked"],
    tender: ["تقييم مناقصة", "Tender evaluated"],
    rent: ["استئجار المقر", "Office rented"],
    equip: ["تجهيز المقر", "Office equipped"],
    hire: ["توظيف عضو بالفريق", "Team member hired"],
    advance: ["تقدم وقت المحاكاة", "Simulation time advanced"],
    develop: ["بدء تطوير منتج", "Product development started"],
    marketing: ["إطلاق حملة تسويق", "Marketing campaign launched"],
    loan: ["الحصول على تمويل", "Loan funded"],
    repay: ["سداد القرض", "Loan repaid"],
    contract: ["قبول عقد", "Contract accepted"],
    meeting: ["تسجيل محضر اجتماع", "Meeting recorded"],
    rename: ["تحديث اسم الموظف", "Employee renamed"],
    message: ["إرسال رسالة", "Message sent"],
    fire: ["إنهاء خدمة موظف", "Employee terminated"],
    travel: ["انتقال إلى موقع", "Travelled to location"],
    branch: ["تأسيس فرع", "Branch opened"],
  };
  return labels[type]?.[ar ? 0 : 1] || type;
}
function ActionForm({
  fields,
  label,
  onSubmit,
}: {
  fields: string[][];
  label: string;
  onSubmit: (v: Record<string, string>) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="action-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const values = Object.fromEntries(new FormData(form)) as Record<
          string,
          string
        >;
        setBusy(true);
        try {
          await onSubmit(values);
        } finally {
          setBusy(false);
        }
      }}
    >
      {fields.map(([name, label, type]) => (
        <label key={name}>
          {label}
          <input
            required
            name={name}
            type={type}
            min={type === "number" ? 1 : undefined}
            maxLength={1000}
          />
        </label>
      ))}
      <button disabled={busy} className="primary" type="submit">
        {label}
      </button>
    </form>
  );
}
function Auth({
  t,
  onError,
}: {
  t: (a: string, b: string) => string;
  onError: (s: string) => void;
}) {
  const { setToken } = useUI();
  const [register, setRegister] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <div className="auth-layout">
      <div className="auth-copy">
        <div className="eyebrow">CEO SIMULATOR</div>
        <h1>
          {t(
            "الأعمال تبدأ بفكرة.\nوالنجاح يبدأ بك.",
            "Business starts with an idea.\nSuccess starts with you.",
          )}
        </h1>
        <p>
          {t(
            "عالم من القرارات. شركة تحمل رؤيتك. ومستقبل تبنيه خطوة بخطوة.",
            "A world of decisions. A company with your vision. A future built one move at a time.",
          )}
        </p>
        <div className="auth-features">
          <span>
            <ShieldCheck size={17} />
            {t("محاكاة مالية مترابطة", "Connected financial simulation")}
          </span>
          <span>
            <Building2 size={17} />
            {t("٢٠ قطاعًا اقتصاديًا", "20 economic sectors")}
          </span>
        </div>
        <img
          src={
            import.meta.env.BASE_URL +
            "assets/01_Offices/office_01_empty_startup_landscape.png"
          }
          alt={t("مكتب البداية", "Starting office")}
        />
      </div>
      <section className="auth-card panel">
        <span className="eyebrow">YOUR SEAT AT THE TABLE</span>
        <h2>
          {register
            ? t("ابدأ مسيرتك", "Start your journey")
            : t("أهلًا بعودتك", "Welcome back")}
        </h2>
        <p className="muted">
          {t(
            "مساحتك الخاصة لبناء شركتك القادمة.",
            "Your space to build your next company.",
          )}
        </p>
        <ActionForm
          fields={[
            ["email", t("البريد الإلكتروني", "Email"), "email"],
            [
              "password",
              t(
                "كلمة المرور • ١٢ حرفًا على الأقل",
                "Password • At least 12 characters",
              ),
              "password",
            ],
          ]}
          label={
            register
              ? t("إنشاء حساب", "Create account")
              : t("دخول مساحة العمل", "Enter workspace")
          }
          onSubmit={async (v) => {
            try {
              const result = await api<{ message: string; token: string }>(
                "/auth/" + (register ? "register" : "login"),
                "POST",
                v,
              );
              if (register) {
                setMessage(result.message);
                setRegister(false);
              } else setToken(result.token);
            } catch (e) {
              onError((e as Error).message);
            }
          }}
        />
        {message && <p role="status">{message}</p>}
        <button className="text-button" onClick={() => setRegister(!register)}>
          {register
            ? t("لديك حساب؟ تسجيل الدخول", "Have an account? Sign in")
            : t("مستخدم جديد؟ أنشئ حسابًا", "New here? Create an account")}
        </button>
        <GoogleSignIn
          base={API}
          onToken={setToken}
          onError={onError}
          ar={useUI.getState().lang === "ar"}
        />
        <p className="fine-print">
          {t(
            "حفظ آمن على الخادم • لا تتقدم اللعبة أثناء غيابك",
            "Server saves • Your game pauses while you are away",
          )}
        </p>
      </section>
    </div>
  );
}
function Found({
  t,
  onCreate,
}: {
  t: (a: string, b: string) => string;
  onCreate: (v: CareerInput) => Promise<void>;
}) {
  const ar = useUI((s) => s.lang) === "ar";
  return (
    <section className="panel founding">
      <h2>{t("تأسيس شركة جديدة", "Found a new company")}</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const v = Object.fromEntries(new FormData(e.currentTarget));
          await onCreate({
            name: String(v.name),
            ceo: String(v.ceo),
            city: v.city as CareerInput["city"],
            legal: v.legal as CareerInput["legal"],
            sector: Number(v.sector),
            capital: Number(v.capital),
            difficulty: v.difficulty as CareerInput["difficulty"],
          });
        }}
      >
        <div className="form-grid">
          <label>
            {t("اسم الرئيس التنفيذي", "CEO name")}
            <input name="ceo" required minLength={2} maxLength={80} />
          </label>
          <label>
            {t("اسم الشركة", "Company name")}
            <input name="name" required minLength={2} maxLength={80} />
          </label>
          <label>
            {t("القطاع الاقتصادي", "Economic sector")}
            <select name="sector">
              {sectors.map((s, i) => (
                <option value={i} key={i}>
                  {s[ar ? 0 : 1]}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("المدينة", "City")}
            <select name="city">
              <option value="الرياض">{t("الرياض", "Riyadh")}</option>
              <option value="جدة">{t("جدة", "Jeddah")}</option>
              <option value="الدمام">{t("الدمام", "Dammam")}</option>
            </select>
          </label>
          <label>
            {t("رأس المال بالريال", "Starting capital in SAR")}
            <input
              name="capital"
              type="number"
              min={500000}
              max={10000000}
              step={10000}
              defaultValue={1000000}
              required
            />
          </label>
          <label>
            {t("الشكل القانوني الافتراضي", "Fictional legal form")}
            <select name="legal">
              <option value="llc">
                {t("شركة ذات مسؤولية محدودة", "Limited liability company")}
              </option>
              <option value="sole">
                {t("مؤسسة فردية", "Sole proprietor")}
              </option>
              <option value="joint">
                {t("شركة مساهمة", "Joint stock company")}
              </option>
            </select>
          </label>
          <label>
            {t("الصعوبة", "Difficulty")}
            <select name="difficulty">
              <option value="relaxed">Relaxed</option>
              <option value="realistic">Realistic</option>
              <option value="hardcore">Hardcore</option>
            </select>
          </label>
        </div>
        <p className="muted">
          {t(
            "تبدأ برأس المال فقط، دون موظفين أو معدات أو عملاء. التسجيل داخل اللعبة افتراضي بالكامل.",
            "You start with capital only, without employees, equipment or customers. Registration is entirely fictional.",
          )}
        </p>
        <button className="primary" type="submit">
          <Plus size={16} />
          {t("تأسيس الشركة وبدء المسيرة", "Found company & start career")}
        </button>
      </form>
    </section>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
