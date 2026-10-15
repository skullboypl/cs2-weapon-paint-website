import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
const upstream = "6b1039d63042b0bbadbf142054c86f79284fdb6a";
const root = path.resolve(import.meta.dirname, "..");
const sourceFlag = process.argv.indexOf("--source");
const source =
  sourceFlag >= 0
    ? path.resolve(process.argv[sourceFlag + 1])
    : path.join(root, "plugin");
try {
  await fs.access(path.join(source, "website/img/skins"));
} catch {
  execFileSync(
    "git",
    [
      "clone",
      "--filter=blob:none",
      "--no-checkout",
      "https://github.com/Nereziel/cs2-WeaponPaints.git",
      source,
    ],
    { stdio: "inherit" },
  );
  execFileSync(
    "git",
    [
      "-C",
      source,
      "sparse-checkout",
      "set",
      "website/img/skins",
      "website/data",
    ],
    { stdio: "inherit" },
  );
  execFileSync("git", ["-C", source, "checkout", upstream], {
    stdio: "inherit",
  });
}
const actual = execFileSync("git", ["-C", source, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
if (actual !== upstream)
  throw new Error(`Expected upstream ${upstream}; got ${actual}`);
const publicDir = path.join(root, "frontend/public"),
  out = path.join(publicDir, "catalog-images");
await fs.mkdir(out, { recursive: true });
const sourceNames = await fs.readdir(path.join(source, "website/img/skins"));
const available = new Set(sourceNames);
const mappings = {},
  queue = new Map(),
  missing = [];
for (const name of [
  "skins_en.json",
  "gloves_en.json",
  "agents_en.json",
  "stickers_en.json",
  "keychains_en.json",
  "music_en.json",
  "collectibles_en.json",
]) {
  const catalog = JSON.parse(
    await fs.readFile(path.join(publicDir, "data", name), "utf8"),
  );
  for (const row of catalog) {
    if (!row.image) continue;
    let file = row.image.includes("/website/img/skins/")
      ? row.image.split("/").at(-1)
      : null;
    if (!file && row.weapon_name)
      file = `${row.weapon_name}${Number(row.paint) ? "-" + row.paint : ""}.png`;
    if (!file && name === "gloves_en.json")
      file = sourceNames.find(
        (n) =>
          n.endsWith(`-${row.paint}.png`) &&
          !n.startsWith("weapon_") &&
          !n.startsWith("sticker-"),
      );
    if (!file || !available.has(file)) {
      missing.push(row.image);
      mappings[row.image] = "/images/cloudhub/item-placeholder.svg";
      continue;
    }
    const target = file.replace(/\.png$/, ".webp");
    mappings[row.image] = "/catalog-images/" + target;
    queue.set(file, target);
  }
}
sharp.concurrency(1);
const work = [...queue.entries()];
let cursor = 0,
  done = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (cursor < work.length) {
      const [file, target] = work[cursor++];
      try {
        await fs.access(path.join(out, target));
      } catch {
        await sharp(path.join(source, "website/img/skins", file))
          .resize({
            width: file.startsWith("weapon_") ? 640 : 256,
            height: 480,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 82, effort: 3 })
          .toFile(path.join(out, target));
      }
      done++;
      if (done % 2000 === 0)
        console.log(`Prepared ${done}/${work.length} images`);
    }
  }),
);
await fs.writeFile(
  path.join(publicDir, "data/image-manifest.json"),
  JSON.stringify({ upstream, images: mappings }),
);
console.log(
  `Prepared ${done} local images; ${missing.length} have no upstream image and use the preview-unavailable placeholder.`,
);
