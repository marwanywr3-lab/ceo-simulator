import { z } from "zod";
export const sectors = [
  ["البرمجيات", "Software", 120000, 30, 1800, "subscription"],
  ["الذكاء الاصطناعي", "AI", 240000, 60, 3200, "subscription"],
  ["الإلكترونيات", "Electronics", 450000, 45, 1400, "manufacturing"],
  ["الصناعات الغذائية", "Food manufacturing", 320000, 25, 120, "manufacturing"],
  ["الأزياء", "Fashion", 160000, 20, 240, "retail"],
  ["المطاعم", "Restaurants", 220000, 15, 85, "hospitality"],
  ["المقاهي", "Cafés", 130000, 10, 35, "hospitality"],
  ["تجارة التجزئة", "Retail", 180000, 12, 160, "retail"],
  ["التجارة الإلكترونية", "E-commerce", 100000, 18, 210, "retail"],
  ["العقارات", "Real estate", 800000, 90, 45000, "project"],
  ["المقاولات", "Construction", 650000, 80, 65000, "project"],
  ["الخدمات اللوجستية", "Logistics", 350000, 30, 450, "logistics"],
  ["الخدمات الصحية", "Healthcare", 900000, 60, 650, "service"],
  ["التعليم", "Education", 280000, 45, 1200, "service"],
  ["الإعلام", "Media", 140000, 25, 2400, "project"],
  ["الإعلانات", "Advertising", 100000, 20, 1800, "project"],
  ["الخدمات المالية", "Finance", 1000000, 90, 4200, "service"],
  ["الطاقة", "Energy", 1500000, 120, 8500, "manufacturing"],
  ["الزراعة", "Agriculture", 400000, 90, 180, "agriculture"],
  ["الضيافة", "Hospitality", 700000, 60, 850, "hospitality"],
] as const;
export const careerInput = z.object({
  name: z.string().trim().min(2).max(80),
  ceo: z.string().trim().min(2).max(80),
  city: z.enum(["الرياض", "جدة", "الدمام"]),
  legal: z.enum(["llc", "sole", "joint"]),
  sector: z.number().int().min(0).max(19),
  capital: z.number().int().min(500000).max(10000000),
  difficulty: z.enum(["relaxed", "realistic", "hardcore"]),
});
export const credentials = z.object({
  email: z.email().max(254),
  password: z.string().min(12).max(128),
});
export const commandInput = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("purchase"),
    quantity: z.number().int().min(1).max(10000),
  }),
  z.object({
    type: z.literal("delegate"),
    id: z.string(),
    budget: z.number().int().min(1000).max(1000000),
  }),
  z.object({ type: z.literal("revoke"), id: z.string() }),
  z.object({
    type: z.literal("tender"),
    bid: z.number().int().min(10000).max(10000000),
  }),
  z.object({
    type: z.literal("advance"),
    minutes: z.number().int().min(1).max(10080),
  }),
  z.object({ type: z.literal("rent") }),
  z.object({ type: z.literal("equip") }),
  z.object({
    type: z.literal("hire"),
    candidate: z.number().int().min(0).max(3),
  }),
  z.object({
    type: z.literal("rename"),
    id: z.string(),
    name: z.string().trim().min(2).max(80),
  }),
  z.object({ type: z.literal("fire"), id: z.string() }),
  z.object({
    type: z.literal("develop"),
    name: z.string().trim().min(2).max(100),
    price: z.number().int().min(1).max(1000000),
  }),
  z.object({
    type: z.literal("marketing"),
    budget: z.number().int().min(1000).max(1000000),
  }),
  z.object({
    type: z.literal("loan"),
    amount: z.number().int().min(10000).max(1000000),
  }),
  z.object({ type: z.literal("repay") }),
  z.object({ type: z.literal("contract") }),
  z.object({
    type: z.literal("meeting"),
    agenda: z.string().trim().min(2).max(500),
  }),
  z.object({
    type: z.literal("message"),
    id: z.string(),
    text: z.string().trim().min(1).max(1000),
  }),
  z.object({
    type: z.literal("travel"),
    location: z.enum(["office", "city", "industry"]),
  }),
  z.object({
    type: z.literal("branch"),
    city: z.string().trim().min(2).max(50),
  }),
  z.object({ type: z.literal("snapshot") }),
  z.object({ type: z.literal("restore"), id: z.string() }),
]);
export type Command = z.infer<typeof commandInput>;
export type CareerInput = z.infer<typeof careerInput>;
export const candidates = [
  {
    name: "أحمد العتيبي",
    en: "Ahmed Alotaibi",
    role: "CFO",
    salary: 18000,
    skill: 82,
  },
  {
    name: "نورة القحطاني",
    en: "Noura Alqahtani",
    role: "COO",
    salary: 16000,
    skill: 78,
  },
  {
    name: "خالد الدوسري",
    en: "Khalid Aldosari",
    role: "CTO",
    salary: 20000,
    skill: 88,
  },
  {
    name: "سارة الحربي",
    en: "Sara Alharbi",
    role: "CMO",
    salary: 14000,
    skill: 76,
  },
];
