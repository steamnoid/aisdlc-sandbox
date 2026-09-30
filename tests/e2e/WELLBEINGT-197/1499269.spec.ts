import { expect, test } from "@playwright/test";
import { apiCreateEvent, apiRegister, confirmDialog, eventCard, trackDeleteRequests, uniqueEmail } from "../helpers";

test("QA: Cancelling the shared confirmation protects the whole batch [WELLBEINGT-197]", async ({ page }) => {
  const request = page.context().request;
  await apiRegister(request, uniqueEmail("bulkguard"));
  await apiCreateEvent(request, "guard bystander note");
  await apiCreateEvent(request, "guard marked one");
  await apiCreateEvent(request, "guard marked two");
  await apiCreateEvent(request, "guard marked three");

  await page.goto("/");
  await eventCard(page, "guard bystander note").waitFor();
  const deleteCount = trackDeleteRequests(page);

  for (const snippet of ["guard marked one", "guard marked two", "guard marked three"]) {
    const select = eventCard(page, snippet).getByTestId("event-select");
    await select.click();
    await expect(select).toHaveAttribute("aria-checked", "true");
  }

  const bulkBar = page.getByTestId("bulk-bar");
  await expect(bulkBar).toContainText("3");

  await page.getByTestId("bulk-delete").click();
  const dialog = confirmDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("delete-cancel").click();
  await expect(dialog).toHaveCount(0);

  expect(deleteCount()).toBe(0);
  for (const snippet of ["guard marked one", "guard marked two", "guard marked three"]) {
    const select = eventCard(page, snippet).getByTestId("event-select");
    await expect(eventCard(page, snippet)).toBeVisible();
    await expect(select).toHaveAttribute("aria-checked", "true");
  }
  await expect(bulkBar).toBeVisible();
  await expect(bulkBar).toContainText("3");
});
