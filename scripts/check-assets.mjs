import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const stages = ["01_Offices", "03_Cities", "04_Industries", "05_Objects"];
const report = [];
for (const stage of stages) {
  const dir = "public/assets/" + stage;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".png")) continue;
    const b = fs.readFileSync(path.join(dir, file));
    assert.equal(b.subarray(1, 4).toString(), "PNG");
    const width = b.readUInt32BE(16),
      height = b.readUInt32BE(20);
    assert.ok(width > 0 && height > 0);
    report.push({ stage, file, width, height, bytes: b.length });
  }
}
for (const stage of stages.slice(0, 3)) {
  const dir = "public/assets/" + stage;
  for (const file of fs
    .readdirSync(dir)
    .filter((f) => f.endsWith("_landscape.png")))
    assert.ok(
      fs.existsSync(
        path.join(dir, file.replace("_landscape.png", "_portrait.png")),
      ),
      "Missing portrait: " + file,
    );
}
const manifest = JSON.parse(
  fs.readFileSync("public/assets/01_Offices/assets-manifest.json", "utf8"),
);
for (const scene of manifest.locations)
  for (const ratio of ["landscape", "portrait"]) {
    const v = scene[ratio];
    assert.ok(fs.existsSync("public/assets/01_Offices/" + v.file));
    for (const h of v.interactions) {
      assert.equal(h.box.length, 4);
      assert.ok(h.box.every((n) => n >= 0 && n <= 1));
      assert.ok(h.box[0] + h.box[2] <= 1.001 && h.box[1] + h.box[3] <= 1.001);
    }
  }
fs.writeFileSync(
  "asset-inventory.json",
  JSON.stringify(
    {
      date: new Date().toISOString(),
      checks:
        "PNG headers, matching variants, office manifest paths and normalized hotspots. Not a visual inspection of every asset.",
      count: report.length,
      images: report,
    },
    null,
    2,
  ),
);
console.log(
  report.length +
    " PNG assets verified; office hotspots and paired orientations valid.",
);
