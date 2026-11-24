const { test, expect } = require("@playwright/test");

const viewports = [
  { width: 320, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 900 },
  { width: 1440, height: 1000 }
];

test("Employee Help Desk loads without sign-in and starts with empty local data", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page).toHaveTitle("Employee Help Desk");
  await expect(page.getByRole("heading", { name: "Good day. Here's your workspace." })).toBeVisible();
  await expect(page.getByText("LOCAL PREVIEW · NO SIGN-IN REQUIRED")).toBeVisible();
  await expect(page.locator("#openCount")).toHaveText("0");
  await expect(page.locator("#requestCount")).toHaveText("0");
  await expect(page.locator("#editorDialog")).toBeAttached();
});

for (const viewport of viewports) {
  test(`workspace has no horizontal overflow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/index.html");
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth
    }));
    expect(dimensions.document, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.body, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport);
    await expect(page.locator(".sidebar")).toBeAttached();
    await expect(page.locator(".main")).toBeVisible();
  });
}

test("navigation opens each workspace section", async ({ page }) => {
  await page.goto("/index.html");
  for (const [label, view] of [
    ["Help requests", "requests"],
    ["Knowledge base", "knowledge"],
    ["FAQs", "faqs"],
    ["Guides & SOPs", "sops"],
    ["Team directory", "team"]
  ]) {
    await page.locator(`.nav-item[data-view="${view}"]`).click();
    await expect(page.locator(`#view-${view}`)).toHaveClass(/active/);
  }
});

test("create, update status, search and delete a help request", async ({ page }) => {
  await page.goto("/index.html");
  await page.locator("#newRequestBtn").click();
  await page.getByLabel("Request title").fill("Laptop access issue");
  await page.getByLabel("Category").selectOption("IT support");
  await page.getByLabel("Describe the issue").fill("Cannot access the shared workspace.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("#recentRequests")).toContainText("Laptop access issue");
  await expect(page.locator("#openCount")).toHaveText("1");

  await page.locator('.nav-item[data-view="requests"]').click();
  await page.locator("#requestSearch").fill("Laptop");
  await expect(page.locator("#requestList")).toContainText("Laptop access issue");
  await page.locator('#requestList [data-action="status"]').click();
  await expect(page.locator("#requestList")).toContainText("In progress");
  page.once("dialog", dialog => dialog.accept());
  await page.locator('#requestList [data-action="delete"]').click();
  await expect(page.locator("#requestCount")).toHaveText("0");
});

test("create and find a knowledge article", async ({ page }) => {
  await page.goto("/index.html");
  await page.locator('.nav-item[data-view="knowledge"]').click();
  await page.locator("#addArticleBtn").click();
  await page.getByLabel("Article title").fill("Getting started");
  await page.getByLabel("Category").fill("Onboarding");
  await page.getByLabel("Article content").fill("Use the workspace navigation to find support.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.locator('.nav-item[data-view="knowledge"]').click();
  await expect(page.locator("#knowledgeList")).toContainText("Getting started");
  await page.locator("#articleSearch").fill("onboarding");
  await expect(page.locator("#knowledgeList")).toContainText("Getting started");
});

test("clear workspace removes preview data", async ({ page }) => {
  await page.goto("/index.html");
  await page.locator("#newRequestBtn").click();
  await page.getByLabel("Request title").fill("Temporary request");
  await page.getByLabel("Category").selectOption("General");
  await page.getByLabel("Describe the issue").fill("Temporary test data");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  page.once("dialog", dialog => dialog.accept());
  await page.locator("#resetData").click();
  await expect(page.locator("#requestCount")).toHaveText("0");
  await expect(page.locator("#openCount")).toHaveText("0");
});
