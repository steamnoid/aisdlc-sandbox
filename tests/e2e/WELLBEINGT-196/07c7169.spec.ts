import { expect, test } from "@playwright/test";
import { apiCreateEvent, apiRegister, confirmDialog, eventCard, timelineTexts, uniqueEmail } from "../helpers";

test("QA: Only the chosen event is removed while others stay untouched [WELLBEINGT-196]", async ({ page }) => {
  const request = page.context().request;
  await apiRegister(request, uniqueEmail("surgical"));
  await apiCreateEvent(request, "surgical alpha note");
  await apiCreateEvent(request, "surgical beta note");
  await apiCreateEvent(request, "surgical gamma note");

  await page.goto("/");
  await eventCard(page, "surgical alpha note").waitFor();

  const before = await timelineTexts(page);
  expect(before.some((t) => t.includes("surgical beta note"))).toBe(true);

  await eventCard(page, "surgical beta note").getByTestId("event-delete").click();
  const dialog = confirmDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("delete-confirm").click();
  await expect(dialog).toHaveCount(0);

  await expect(eventCard(page, "surgical beta note")).toHaveCount(0);
  const after = await timelineTexts(page);
  expect(after).toEqual(before.filter((t) => !t.includes("surgical beta note")));
});
