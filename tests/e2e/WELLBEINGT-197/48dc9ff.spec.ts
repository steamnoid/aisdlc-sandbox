import { expect, test } from "@playwright/test";
import {
  apiCreateEvent,
  apiRegister,
  confirmDialog,
  eventCard,
  trackDeleteRequests,
  uniqueEmail,
} from "../helpers";

test("QA: Marked events vanish together after one shared confirmation [WELLBEINGT-197]", async ({ page }) => {
  const request = page.context().request;
  await apiRegister(request, uniqueEmail("bulk"));
  await apiCreateEvent(request, "bulk survivor note");
  await apiCreateEvent(request, "bulk marked one");
  await apiCreateEvent(request, "bulk marked two");
  await apiCreateEvent(request, "bulk marked three");

  await page.goto("/");
  await eventCard(page, "bulk survivor note").waitFor();
  const deleteCount = trackDeleteRequests(page);

  for (const snippet of ["bulk marked one", "bulk marked two", "bulk marked three"]) {
    const select = eventCard(page, snippet).getByTestId("event-select");
    await select.click();
    await expect(select).toHaveAttribute("aria-checked", "true");
  }

  const bulkBar = page.getByTestId("bulk-bar");
  await expect(bulkBar).toBeVisible();
  await expect(bulkBar).toContainText("3");

  await page.getByTestId("bulk-delete").click();
  const dialog = confirmDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("delete-confirm").click();
  await expect(dialog).toHaveCount(0);

  for (const snippet of ["bulk marked one", "bulk marked two", "bulk marked three"]) {
    await expect(eventCard(page, snippet)).toHaveCount(0);
  }
  await expect(eventCard(page, "bulk survivor note")).toBeVisible();

  await expect(bulkBar).toHaveCount(0);
  expect(deleteCount()).toBe(3);
});
