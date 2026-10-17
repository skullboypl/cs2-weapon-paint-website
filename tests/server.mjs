import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
const root = process.cwd();
if (!/^\/workspace\/[a-zA-Z0-9_./-]+$/.test(process.env.CLOUDHUB_TEST_SOCKET || ''))
  throw new Error(
    "Set CLOUDHUB_TEST_SOCKET to a local MariaDB Unix socket. Tests never use production config.",
  );
const runtime = fs.mkdtempSync(path.join(os.tmpdir(), "cloudhub-test-"));
const db = `cloudhub_test_${crypto.randomBytes(6).toString("hex")}`;
const ingestKey = crypto.randomBytes(32).toString("hex");
const config = path.join(runtime, "config.php");
const php = (value) => JSON.stringify(value).replaceAll("$", "\\$");
fs.writeFileSync(
  config,
  `<?php
 define('DOMAIN_NAME','http://127.0.0.1:5175');
 define('STEAM_API_KEY','');
 define('DB_HOST',${php('localhost;unix_socket=' + process.env.CLOUDHUB_TEST_SOCKET)});
 define('DB_PORT','3306');
 define('DB_NAME',${php(db)});
 define('DB_USER',${php(process.env.CLOUDHUB_TEST_DB_USER || os.userInfo().username)});
 define('DB_PASS','');
 if (!defined('DB_AUTO_MIGRATE')) { define('DB_AUTO_MIGRATE',true); }
 define('CLOUDHUB_CORE_ENABLED',true);
 define('CLOUDHUB_INGEST_ENABLED',true);
 define('CLOUDHUB_INGEST_KEYS',['test'=>${php(ingestKey)}]);
 define('STORAGE_PATH',${php(runtime + "/storage")});
 define('API_DOMAIN_NAME', DOMAIN_NAME.'/api');
 define('API_READ_CACHE_TTL',0);
 define('API_RATE_LIMIT',0);
 ini_set('pdo_mysql.default_socket',${php(process.env.CLOUDHUB_TEST_SOCKET)});
`,
);
const disabledConfig=path.join(runtime,"disabled.php");
fs.writeFileSync(disabledConfig, "<?php define('CLOUDHUB_CORE_ENABLED',true); define('CLOUDHUB_INGEST_ENABLED',false);");
const env = {
  ...process.env,
  CLOUDHUB_CONFIG: config,
  CLOUDHUB_TEST_DATABASE: db,
  WP_BACKEND_PORT: "8082",
};
const sessions = JSON.parse(
  execFileSync("php", ["tests/database.php", "create"], {
    env,
    encoding: "utf8",
  }),
);
// Exercise the public CLI entry point too; it must leave WeaponPaints intact.
execFileSync("php", ["bin/cloudhub-migrate.php", "--apply"], { env, stdio: "inherit" });
fs.mkdirSync(path.join(root, "test-results"), { recursive: true });
fs.writeFileSync(
  path.join(root, "test-results/sessions.json"),
  JSON.stringify(sessions),
);
fs.writeFileSync(path.join(root,"test-results/ingest-key.txt"),ingestKey,{mode:0o600});
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  execFileSync("php", ["tests/database.php", "drop"], {
    env,
    stdio: "inherit",
  });
  fs.rmSync(runtime, { recursive: true, force: true });
  process.exit(code);
}
process.on("SIGTERM", () => stop());
process.on("SIGINT", () => stop());
for (const [cmd, args] of [
  ["php", ["-S", "127.0.0.1:8082", "-t", "backend"]],
  ["php", ["-S", "127.0.0.1:8083", "-t", "backend"]],
  [
    "node",
    [
      "frontend/node_modules/vite/bin/vite.js",
      "frontend",
      "--host",
      "127.0.0.1",
      "--port",
      "5175",
      "--strictPort",
    ],
  ],
]) {
  const child = spawn(cmd, args, { cwd: root, env: args.includes("127.0.0.1:8083") ? {...env,CLOUDHUB_CONFIG:disabledConfig} : env, stdio: "inherit" });
  children.push(child);
  child.on("exit", (code) => {
    if (!stopping) stop(code || 1);
  });
}
