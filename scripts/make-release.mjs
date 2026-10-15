import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { bumpCacheVersion } from "./bump-cache-version.mjs";
const root = path.resolve(import.meta.dirname, "..");
function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (!fs.existsSync(path.join(root, "frontend/public/data/image-manifest.json")))
  throw new Error(
    "Run pnpm assets:prepare before creating the production release.",
  );
bumpCacheVersion({ reason: "CloudHub release" });
run("pnpm", ["build"]);
const stage = path.join(root, "releases/newest-release");
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
fs.cpSync(path.join(root, "dist"), path.join(stage, "public"), {
  recursive: true,
});
for (const folder of ["deployment", "docs", "bin"])
  fs.cpSync(path.join(root, folder), path.join(stage, folder), {
    recursive: true,
  });
fs.copyFileSync(path.join(root, "README.md"), path.join(stage, "README.md"));
const forbidden = [];
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? files(path.join(dir, entry.name))
        : [path.join(dir, entry.name)],
    );
}
for (const file of files(stage)) {
  const relative = path.relative(stage, file).replaceAll(path.sep, "/");
  if (
    /(^|\/)(config\.php|\.env[^/]*|sess_[^/]+)$/.test(relative) ||
    /\/storage\/(sessions|ratelimit)\/(?!\.gitignore)/.test(relative)
  )
    forbidden.push(relative);
}
if (forbidden.length)
  throw new Error("Private runtime files in release: " + forbidden.join(", "));
const manifest =
  files(stage)
    .sort()
    .map(
      (file) =>
        `${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}  ${path.relative(stage, file).replaceAll(path.sep, "/")}`,
    )
    .join("\n") + "\n";
fs.writeFileSync(path.join(stage, "SHA256SUMS"), manifest);
const name = "cloudhub-cs2-1.0.0.tar.gz",
  archive = path.join(root, "releases", name);
run("tar", ["-czf", archive, "-C", stage, "."]);
fs.writeFileSync(
  archive + ".sha256",
  crypto.createHash("sha256").update(fs.readFileSync(archive)).digest("hex") +
    "  " +
    name +
    "\n",
);
console.log(
  `Ready: releases/${name} (${(fs.statSync(archive).size / 1024 / 1024).toFixed(1)} MiB). Contains public/, deployment/, docs/, bin/ and SHA256SUMS.`,
);
