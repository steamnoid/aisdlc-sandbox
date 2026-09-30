import { expect, test } from "@playwright/test";
import {
  apiCreateEvent,
  apiRegister,
  confirmDialog,
  eventCard,
  timelineTexts,
  trackDeleteRequests,
  uniqueEmail,
} from "../helpers";

test("QA: Cancelling the confirmation changes nothing [WELLBEINGT-196]", async ({ page }) => {
  const request = page.context().request;
  await apiRegister(request, uniqueEmail("cancel"));
  await apiCreateEvent(request, "cancel path note one");
  await apiCreateEvent(request, "cancel path note two");

  await page.goto("/");
  await eventCard(page, "cancel path note one").waitFor();
  const before = await timelineTexts(page);
  const deleteCount = trackDeleteRequests(page);

  await eventCard(page, "cancel path note one").getByTestId("event-delete").click();
  const dialog = confirmDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("delete-cancel").click();
  await expect(dialog).toHaveCount(0);
  expect(deleteCount()).toBe(0);
  expect(await timelineTexts(page)).toEqual(before);

  await eventCard(page, "cancel path note two").getByTestId("event-delete").click();
  const dialogAgain = confirmDialog(page);
  await expect(dialogAgain).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialogAgain).toHaveCount(0);
  expect(deleteCount()).toBe(0);
  expect(await timelineTexts(page)).toEqual(before);
});
