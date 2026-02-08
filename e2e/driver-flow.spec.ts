import { expect, test } from "@playwright/test";

test("driver MVP flow works end-to-end", async ({ page, request }) => {
  await page.goto("/");

  const coordinateInputs = page.locator("input[type='number']");

  await coordinateInputs.first().fill("33.3150");
  await coordinateInputs.nth(1).fill("44.3660");
  await page.getByRole("button", { name: "تأكيد النقطة" }).click();

  await coordinateInputs.first().fill("33.3250");
  await coordinateInputs.nth(1).fill("44.3800");
  await page.getByRole("button", { name: "تأكيد النقطة" }).click();

  await page.locator("select").selectOption({ index: 1 });
  await page.getByRole("button", { name: "إرسال" }).click();

  await expect(page.getByText("شكراً لك! تم تسجيل السعر.")).toBeVisible();

  const suggestResponse = await request.get(
    "/api/suggest-price?start=33.3128,44.3615&end=33.3152,44.3661&time_bucket=12&day_of_week=-1",
  );
  expect(suggestResponse.ok()).toBeTruthy();
  const suggestBody = await suggestResponse.json();
  expect(suggestBody.suggested_price).not.toBeNull();
});

