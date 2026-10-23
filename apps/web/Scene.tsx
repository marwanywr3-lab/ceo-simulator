import { useEffect, useState } from "react";
import manifest from "../../public/assets/01_Offices/assets-manifest.json";
import type { State } from "../../packages/simulation";
export function Scene({
  s,
  ar,
  onNavigate,
}: {
  s: State;
  ar: boolean;
  onNavigate: (page: number) => void;
}) {
  const [portrait, setPortrait] = useState(window.innerWidth <= 600);
  useEffect(() => {
    const m = window.matchMedia("(max-width:600px)");
    const change = () => setPortrait(m.matches);
    m.addEventListener("change", change);
    return () => m.removeEventListener("change", change);
  }, []);
  const scene = manifest.locations.find(
    (x) =>
      x.id ===
      (s.equipment ? "office_02_furnished_startup" : "office_01_empty_startup"),
  )!;
  const variant = portrait ? scene.portrait : scene.landscape;
  return (
    <>
      <picture>
        <source media="(max-width:600px)" srcSet={asset(s, "portrait")} />
        <img
          src={asset(s, "landscape")}
          alt={
            ar
              ? "مشهد المقر من الأصول المرفقة"
              : "Office scene from supplied assets"
          }
        />
      </picture>
      {s.location === "office" &&
        variant.interactions.map((h) => {
          const page = h.id.includes("computer")
            ? 5
            : h.id === "whiteboard"
              ? 7
              : 6;
          const name =
            page === 5
              ? ar
                ? "التقارير"
                : "Reports"
              : page === 7
                ? ar
                  ? "الاجتماعات"
                  : "Meetings"
                : ar
                  ? "استكشف المدينة"
                  : "Explore city";
          return (
            <button
              key={h.id}
              className="hotspot"
              aria-label={name}
              style={{
                left: h.box[0] * 100 + "%",
                top: h.box[1] * 100 + "%",
                width: h.box[2] * 100 + "%",
                height: h.box[3] * 100 + "%",
              }}
              onClick={() => onNavigate(page)}
            >
              <span>{name}</span>
            </button>
          );
        })}
    </>
  );
}
export function asset(s: State, ratio: string) {
  const base = import.meta.env.BASE_URL + "assets/";
  if (s.location === "city") {
    const city =
      s.company.city === "جدة"
        ? "03_jeddah_business_district"
        : s.company.city === "الدمام"
          ? "04_dammam_business_district"
          : "01_riyadh_skyline";
    return base + "03_Cities/location_" + city + "_" + ratio + ".png";
  }
  if (s.location === "industry")
    return (
      base + "03_Cities/location_05_saudi_industrial_city_" + ratio + ".png"
    );
  return (
    base +
    "01_Offices/office_0" +
    (s.equipment ? "2_furnished_startup" : "1_empty_startup") +
    "_" +
    ratio +
    ".png"
  );
}
