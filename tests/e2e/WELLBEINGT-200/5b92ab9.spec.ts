import { expect, test } from "@playwright/test";
import { apiCreateEvent, apiRegister, confirmDialog, eventCard, uniqueEmail } from "../helpers";

test("QA: Successful deletion flashes a self-dismissing confirmation [WELLBEINGT-200]", async ({ page }) => {
  const request = page.context().request;
  await apiRegister(request, uniqueEmail("flash"));
  await apiCreateEvent(request, "flash trigger note");

  await page.goto("/");
  await eventCard(page, "flash trigger note").waitFor();

  await eventCard(page, "flash trigger note").getByTestId("event-delete").click();
  const dialog = confirmDialog(page);
  await expect(dialog).toBeVisible();

  const flash = page.getByTestId("delete-flash");
  await dialog.getByTestId("delete-confirm").click();
  await expect(flash).toBeVisible();
  await expect(dialog).toHaveCount(0);

  await expect(flash).toHaveCount(0, { timeout: 3500 });
});
