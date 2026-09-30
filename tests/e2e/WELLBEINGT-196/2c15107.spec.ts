import { expect, test } from "@playwright/test";
import {
  apiCreateEvent,
  apiRegister,
  confirmDialog,
  eventCard,
  trackDeleteRequests,
  uniqueEmail,
} from "../helpers";

test("QA: Delete always asks for confirmation before removing anything [WELLBEINGT-196]", async ({ page }) => {
  const request = page.context().request;
  await apiRegister(request, uniqueEmail("confirmgate"));
  await apiCreateEvent(request, "confirm gate note");

  await page.goto("/");
  await eventCard(page, "confirm gate note").waitFor();
  const deleteCount = trackDeleteRequests(page);

  await eventCard(page, "confirm gate note").getByTestId("event-delete").click();
  const dialog = confirmDialog(page);
  await expect(dialog).toBeVisible();

  await expect(eventCard(page, "confirm gate note")).toBeVisible();
  expect(deleteCount()).toBe(0);

  await dialog.getByTestId("delete-confirm").click();
  await expect(dialog).toHaveCount(0);
  expect(deleteCount()).toBe(1);
  await expect(eventCard(page, "confirm gate note")).toHaveCount(0);
});
