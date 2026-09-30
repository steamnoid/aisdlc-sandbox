import { expect, test } from "@playwright/test";
import { apiCreateEvent, apiRegister, confirmDialog, eventCard, localDayKey, uniqueEmail } from "../helpers";

test("QA: Day count drops by one right after deleting that day's event [WELLBEINGT-198]", async ({ page }) => {
  const request = page.context().request;
  await apiRegister(request, uniqueEmail("countdrop"));
  await apiCreateEvent(request, "count drop note one");
  await apiCreateEvent(request, "count drop note two");

  const today = localDayKey(new Date());
  const badge = page.getByTestId(`count-${today}`);

  await page.goto("/");
  await eventCard(page, "count drop note one").waitFor();
  await expect(page.getByTestId(`day-${today}`)).toBeVisible();
  await expect(badge).toHaveText("2");

  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__qaNoReload = true;
  });
  const urlBefore = page.url();

  await eventCard(page, "count drop note one").getByTestId("event-delete").click();
  const dialog = confirmDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("delete-confirm").click();
  await expect(dialog).toHaveCount(0);

  await expect(badge).toHaveText("1");
  await expect(eventCard(page, "count drop note one")).toHaveCount(0);

  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__qaNoReload)).toBe(true);
  expect(page.url()).toBe(urlBefore);
});
