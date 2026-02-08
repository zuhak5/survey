import { expect, test } from "@playwright/test";

test("driver MVP flow works end-to-end", async ({ page, request }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "دخول تجريبي للاختبارات" }).click();

  await page.getByRole("button", { name: "تأكيد النقطة" }).click();

  const coordinateInputs = page.locator("input[type='number']");
  await coordinateInputs.first().fill("33.3250");
  await coordinateInputs.nth(1).fill("44.3800");
  await page.getByRole("button", { name: "تأكيد النقطة" }).click();

  await page.locator("section:has-text('اختر السعر') button").first().click();
  await page.getByRole("button", { name: "حفظ الإرسال" }).click();

  await expect(page.getByText("شكراً لك! +1 مساهمة جديدة تم تسجيلها.")).toBeVisible();

  const suggestResponse = await request.get(
    "/api/suggest-price?start=33.3128,44.3615&end=33.3152,44.3661",
  );
  expect(suggestResponse.ok()).toBeTruthy();
  const suggestBody = await suggestResponse.json();
  expect(suggestBody.suggested_price).not.toBeNull();
});
