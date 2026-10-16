import { test, expect } from "@playwright/test";
import fs from "node:fs";
const base = "http://127.0.0.1:5175";
async function client(playwright, index) {
  const context = await playwright.request.newContext({ baseURL: base });
  if (index !== undefined) {
    const user = JSON.parse(fs.readFileSync("test-results/sessions.json"))[
      index
    ];
    await context.storageState();
    await context.dispose();
    return playwright.request.newContext({
      baseURL: base,
      storageState: {
        cookies: [
          {
            name: "wp_session",
            value: user.id,
            domain: "127.0.0.1",
            path: "/",
            expires: -1,
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
          },
        ],
        origins: [],
      },
    });
  }
  return context;
}
async function post(ctx, endpoint, form, expected = 200) {
  const session = await ctx.get("/api/session.php");
  const { csrf_token } = await session.json();
  const response = await ctx.post("/api/" + endpoint, {
    form,
    headers: { "X-CSRF-Token": csrf_token, Origin: base },
  });
  expect(response.status(), await response.text()).toBe(expected);
  return response.json();
}
test("API: anonymous authorization, CSRF, origins and method restrictions", async ({
  playwright,
}) => {
  const anon = await client(playwright);
  for (const endpoint of ["skins.php", "knife.php", "loadouts.php"])
    expect(
      (
        await anon.post("/api/" + endpoint, {
          form: { action: "save", team: "T" },
        })
      ).status(),
    ).toBe(401);
  const ctx = await client(playwright, 0);
  expect(
    (
      await ctx.post("/api/skins.php", { form: { action: "save", team: "T" } })
    ).status(),
  ).toBe(403);
  expect((await ctx.get("/api/loadouts.php?action=delete&id=1")).status()).toBe(
    405,
  );
  expect((await ctx.get("/api/steamauth/logout.php")).status()).toBe(405);
  const token = (await (await ctx.get("/api/session.php")).json()).csrf_token;
  expect(
    (
      await ctx.post("/api/skins.php", {
        form: { action: "bootstrap", team: "T" },
        headers: { "X-CSRF-Token": token, Origin: "https://evil.example" },
      })
    ).status(),
  ).toBe(403);
  await ctx.dispose();
  await anon.dispose();
});
test("API: skin round trip, validation, team isolation and account isolation", async ({
  playwright,
}) => {
  const ctx = await client(playwright, 0),
    other = await client(playwright, 1);
  const sticker = JSON.parse(
    fs.readFileSync("frontend/public/data/stickers_en.json"),
  ).find((x) => Number(x.id) > 0);
  const charm = JSON.parse(
    fs.readFileSync("frontend/public/data/keychains_en.json"),
  ).find((x) => Number(x.id) > 0);
  const skin = {
    action: "save",
    team: "T",
    weapon_defindex: 7,
    paint: 180,
    wear: 0.123,
    seed: 321,
    nametag: "CloudHub",
    stattrak: 1,
    stattrak_count: 42,
    keychainId: charm.id,
    offsetX: 0.1,
    offsetY: -0.1,
    offsetZ: 0,
    keychainSeed: 12,
    weapon_sticker_0: `${sticker.id};0;0.1;-0.1;0.2;1;45`,
  };
  await post(ctx, "skins.php", skin);
  const rows = await post(ctx, "skins.php", { action: "getall", team: "T" });
  const saved = rows.find((row) => Number(row.weapon_defindex) === 7);
  expect(saved.weapon_seed).toBe(321);
  expect(Number(saved.weapon_wear)).toBeCloseTo(0.123, 4);
  expect(saved.weapon_stattrak_count).toBe(42);
  expect(saved.weapon_sticker_0).toBe(skin.weapon_sticker_0);
  expect(saved.weapon_keychain).toBe(`${charm.id};0.1;-0.1;0;12`);
  expect(
    await post(ctx, "skins.php", { action: "getall", team: "CT" }),
  ).toEqual([]);
  expect(
    await post(other, "skins.php", { action: "getall", team: "T" }),
  ).toEqual([]);
  for (const invalid of [
    { wear: -1 },
    { seed: 1001 },
    { paint: 99999 },
    { weapon_defindex: "7 OR 1=1" },
    { nametag: "x".repeat(21) },
    { weapon_sticker_0: "1;NaN;0;0;0;1;0" },
    { keychainId: 99999 },
  ])
    await post(ctx, "skins.php", { ...skin, ...invalid }, 422);
  await ctx.dispose();
  await other.dispose();
});
test("API: knives, gloves, agents, music and pins persist", async ({
  playwright,
}) => {
  const ctx = await client(playwright, 0);
  await post(ctx, "knife.php", {
    action: "set",
    team: "CT",
    knife: "weapon_knife_karambit",
  });
  expect(
    (await post(ctx, "knife.php", { action: "get", team: "CT" })).knife,
  ).toBe("weapon_knife_karambit");
  await post(
    ctx,
    "knife.php",
    { action: "set", team: "CT", knife: "../../../invalid" },
    422,
  );
  const glove = JSON.parse(
    fs.readFileSync("frontend/public/data/gloves_en.json"),
  ).find((x) => Number(x.paint) > 0);
  await post(ctx, "skins.php", {
    action: "gloves_save",
    team: "CT",
    weapon_defindex: glove.weapon_defindex,
    paint: glove.paint,
    wear: 0.01,
    seed: 5,
  });
  const agent = JSON.parse(
    fs.readFileSync("frontend/public/data/agents_en.json"),
  ).find((x) => x.team === 3 && x.model !== "null");
  await post(ctx, "skins.php", {
    action: "agent_save",
    team: "CT",
    agent_team: 3,
    agent_model: agent.model,
  });
  expect(
    (await post(ctx, "skins.php", { action: "agent_get", team: "CT" }))
      .agent_ct,
  ).toBe(agent.model);
  for (const [action, field, file] of [
    ["music_save", "music_id", "music_en.json"],
    ["pin_save", "pin_id", "collectibles_en.json"],
  ]) {
    const item = JSON.parse(
      fs.readFileSync("frontend/public/data/" + file),
    ).find((x) => Number(x.id) > 0);
    const result = await post(ctx, "skins.php", {
      action,
      team: "CT",
      both_teams: 1,
      [field]: item.id,
    });
    expect(result.success).toBe(true);
    expect(result.teams).toEqual([2, 3]);
  }
  const bootstrap = await post(ctx, "skins.php", {
    action: "bootstrap",
    team: "CT",
  });
  expect(bootstrap).toBeTruthy();
  await ctx.dispose();
});
test("API: saved loadout ownership, sharing, copy, restore and delete", async ({
  playwright,
}) => {
  const ctx = await client(playwright, 0),
    other = await client(playwright, 1);
  await post(ctx, "skins.php", {
    action: "save",
    team: "T",
    weapon_defindex: 7,
    paint: 180,
    wear: 0.12,
    seed: 321,
  });
  const saved = await post(ctx, "loadouts.php", {
    action: "save",
    name: "CloudHub integration",
    scope: "both",
    team: "T",
    is_public: 0,
  });
  const id = saved.id;
  expect(Number(id)).toBeGreaterThan(0);
  await post(other, "loadouts.php", { action: "get", id }, 404);
  await post(other, "loadouts.php", { action: "apply", id }, 404);
  await post(
    other,
    "loadouts.php",
    { action: "set_public", id, is_public: 1 },
    404,
  );
  await post(other, "loadouts.php", { action: "copy", id }, 403);
  await post(ctx, "loadouts.php", { action: "set_public", id, is_public: 1 });
  const copy = await post(other, "loadouts.php", {
    action: "copy",
    id,
    name: "Copied loadout",
  });
  expect(Number(copy.id)).toBeGreaterThan(0);
  await post(ctx, "skins.php", { action: "reset_both" });
  expect(await post(ctx, "skins.php", { action: "getall", team: "T" })).toEqual(
    [],
  );
  await post(ctx, "loadouts.php", { action: "apply", id });
  expect(
    (await post(ctx, "skins.php", { action: "getall", team: "T" })).some(
      (x) => Number(x.weapon_defindex) === 7,
    ),
  ).toBe(true);
  await post(ctx, "loadouts.php", { action: "delete", id });
  await post(ctx, "loadouts.php", { action: "get", id }, 404);
  await ctx.dispose();
  await other.dispose();
});
test("Steam challenge uses fixed provider, callback and state; forged responses fail", async ({
  playwright,
}) => {
  const ctx = await client(playwright);
  const start = await ctx.get("/api/steamauth/steamlogin.php", {
    maxRedirects: 0,
  });
  expect(start.status()).toBe(302);
  const target = new URL(start.headers().location);
  expect(target.origin).toBe("https://steamcommunity.com");
  const callback = new URL(target.searchParams.get("openid.return_to"));
  expect(callback.origin).toBe(base);
  expect(callback.searchParams.get("state")).toHaveLength(64);
  callback.searchParams.set("openid.mode", "id_res");
  callback.searchParams.set("openid.claimed_id", "http://127.0.0.1/internal");
  const result = await ctx.get(callback.toString(), { maxRedirects: 0 });
  expect(result.headers().location).toBe(base + "/?login=failed");
  expect((await (await ctx.get("/api/getUserProfile.php")).json()).error).toBe(
    "Not logged in",
  );
  await ctx.dispose();
});

test("CloudHub account: authentication, private wallet, session identity and no role/currency writes", async ({ playwright }) => {
  const anon = await client(playwright);
  expect((await anon.get('/api/cloudhub.php')).status()).toBe(401);
  const player = await client(playwright, 1);
  const response = await player.get('/api/cloudhub.php?steamid=76561198000000001&role=OWNER');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-store');
  const { account, features } = await response.json();
  expect(account.steamid).toBe('76561198000000002');
  expect(account.roles).toEqual(['PLAYER']);
  expect(account.balance).toBe('0');
  expect(account.rp).toBe('0');
  expect(account.rank.rank_key).toBe('bronze');
  expect(features).toEqual({ shop_purchases: false, ownership_enforcement: false });
  await post(player, 'cloudhub.php', { action: 'grant_role', role: 'OWNER', balance: '5000' }, 405);
  const unchanged = await (await player.get('/api/cloudhub.php')).json();
  expect(unchanged.account).toEqual(account);
  const owner = await client(playwright, 0);
  expect((await (await owner.get('/api/cloudhub.php')).json()).account.roles).toEqual(['OWNER','PLAYER']);
  await anon.dispose(); await player.dispose(); await owner.dispose();
});
