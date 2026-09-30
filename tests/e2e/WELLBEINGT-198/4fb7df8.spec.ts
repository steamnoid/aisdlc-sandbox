import { expect, test } from "@playwright/test";
import { apiCreateEvent, apiRegister, confirmDialog, eventCard, localDayKey, uniqueEmail } from "../helpers";

test("QA: A day emptied by deletion stops showing a number [WELLBEINGT-198]", async ({ page }) => {
  const request = page.context().request;
  await apiRegister(request, uniqueEmail("countzero"));
  await apiCreateEvent(request, "last event on the day");

  const today = localDayKey(new Date());
  const badge = page.getByTestId(`count-${today}`);

  await page.goto("/");
  await eventCard(page, "last event on the day").waitFor();
  await expect(badge).toHaveText("1");

  await eventCard(page, "last event on the day").getByTestId("event-delete").click();
  const dialog = confirmDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("delete-confirm").click();
  await expect(dialog).toHaveCount(0);

  await expect(badge).toHaveCount(0);
});
