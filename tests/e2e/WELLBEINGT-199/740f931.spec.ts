import { expect, test } from "@playwright/test";
import {
  apiCreateEvent,
  apiRegister,
  confirmDialog,
  eventCard,
  findOwnEventId,
  localDayKey,
  localNoonIso,
  setEventTimestamp,
  timelineTexts,
  uniqueEmail,
} from "../helpers";

test("QA: Deleting inside a range filter keeps the surrounding entries [WELLBEINGT-199]", async ({ page }) => {
  const request = page.context().request;
  await apiRegister(request, uniqueEmail("rangefilter"));

  await apiCreateEvent(request, "range old edge note");
  setEventTimestamp(await findOwnEventId(request, "range old edge note"), localNoonIso(-1));
  await apiCreateEvent(request, "range middle target");
  await apiCreateEvent(request, "range future edge note");
  setEventTimestamp(await findOwnEventId(request, "range future edge note"), localNoonIso(1));

  const from = localDayKey(new Date(Date.now() - 86_400_000));
  const to = localDayKey(new Date(Date.now() + 86_400_000));

  await page.goto(`/events/new?from=${from}&to=${to}`);
  await eventCard(page, "range middle target").waitFor();
  await expect(eventCard(page, "range old edge note")).toBeVisible();
  await expect(eventCard(page, "range future edge note")).toBeVisible();

  const before = await timelineTexts(page);
  const urlBefore = page.url();

  await eventCard(page, "range middle target").getByTestId("event-delete").click();
  const dialog = confirmDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("delete-confirm").click();
  await expect(dialog).toHaveCount(0);

  await expect(eventCard(page, "range middle target")).toHaveCount(0);
  await expect(eventCard(page, "range old edge note")).toBeVisible();
  await expect(eventCard(page, "range future edge note")).toBeVisible();
  expect(await timelineTexts(page)).toEqual(before.filter((t) => !t.includes("range middle target")));
  expect(page.url()).toBe(urlBefore);
});
