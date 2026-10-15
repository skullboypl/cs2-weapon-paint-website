import { test, expect } from "@playwright/test";
import fs from "node:fs";
async function authenticate(context) {
  const user = JSON.parse(fs.readFileSync("test-results/sessions.json"))[0];
  await context.addCookies([
    {
      name: "wp_session",
      value: user.id,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
test("Steam landing: branding, local artwork, responsive layout and accessible login", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Akceptuję", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Twój arsenał",
  );
  await expect(
    page.getByRole("link", { name: "Kontynuuj przez Steam" }),
  ).toHaveAttribute("href", "/api/login-steam.php");
  for (const img of await page.locator(".ch-showroom img").all())
    expect(await img.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(
      true,
    );
  await page.screenshot({
    path: "test-results/cloudhub-login-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/cloudhub-login-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});
test("Dashboard: navigation, filters, editor, real save, profile and mobile menu", async ({
  page,
  context,
}) => {
  await authenticate(context);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/t/rifle");
  await page.getByRole("button", { name: "Akceptuję", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Arsenał", exact: false }),
  ).toBeVisible();
  await expect(page.locator(".weapon-card").first()).toBeVisible();
  await page.screenshot({
    path: "test-results/cloudhub-dashboard.png",
    fullPage: true,
    animations: "disabled",
  });
  const search = page.getByRole("searchbox", {
    name: "Szukaj broni lub skina…",
  });
  await search.fill("nonexistent-item");
  await expect(page.getByText("Brak pasujących przedmiotów")).toBeVisible();
  await page.getByRole("button", { name: "Wyczyść filtry" }).click();
  await search.fill("AK-47");
  await expect(page.locator(".weapon-card")).toHaveCount(1);
  await page.locator(".weapon-card").click();
  await expect(page.locator(".wc-skins__search")).toBeVisible();
  await page.locator(".wc-skins__search").fill("Redline");
  await page.locator(".skin-button").first().click();
  await page.screenshot({
    path: "test-results/cloudhub-editor.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.locator(".wc-btn--primary").click();
  await expect(page.locator(".weapon-card").first()).toBeVisible();
  await expect(
    page.getByText("Zapisano wyposażenie", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Profil gracza", exact: true })
    .click();
  await expect(page.locator(".ch-profile-card")).toContainText("Cloud Player");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Otwórz nawigację" }).click();
  await page.getByRole("button", { name: "Karabiny", exact: true }).click();
  await expect(page.locator(".weapon-card").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect
    .poll(() =>
      page
        .locator(".ch-sidebar")
        .evaluate((el) => Math.round(el.getBoundingClientRect().right)),
    )
    .toBe(0);
  await page.screenshot({
    path: "test-results/cloudhub-dashboard-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});
test("Failed save keeps the editor and displays the backend error", async ({
  page,
  context,
}) => {
  await authenticate(context);
  await page.goto("/t/rifle");
  await page.getByRole("button", { name: "Akceptuję", exact: true }).click();
  await page.locator(".weapon-card").first().click();
  await expect(page.locator(".wc-btn--primary")).toBeVisible();
  await page.route("**/api/skins.php", async (route) => {
    if (
      new URLSearchParams(route.request().postData()).get("action") === "save"
    )
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Database temporarily unavailable" }),
      });
    return route.continue();
  });
  await page.locator(".wc-btn--primary").click();
  await expect(page.getByRole("alert")).toContainText(
    "Database temporarily unavailable",
  );
  await expect(page.locator(".wc-btn--primary")).toBeEnabled();
});
