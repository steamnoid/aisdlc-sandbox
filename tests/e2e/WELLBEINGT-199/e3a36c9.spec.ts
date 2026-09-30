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

test("QA: Deleting inside an active single-day filter shrinks the list immediately [WELLBEINGT-199]", async ({ page }) => {
  const request = page.context().request;
  await apiRegister(request, uniqueEmail("dayfilter"));
  await apiCreateEvent(request, "filter survivor note");
  await apiCreateEvent(request, "filter delete target");
  await apiCreateEvent(request, "yesterday outside note");
  setEventTimestamp(await findOwnEventId(request, "yesterday outside note"), localNoonIso(-1));

  const today = localDayKey(new Date());

  await page.goto(`/events/new?day=${today}`);
  await eventCard(page, "filter survivor note").waitFor();
  await expect(page).toHaveURL(new RegExp(`day=${today}`));
  await expect(eventCard(page, "yesterday outside note")).toHaveCount(0);

  const before = await timelineTexts(page);
  expect(before.some((t) => t.includes("filter delete target"))).toBe(true);

  await eventCard(page, "filter delete target").getByTestId("event-delete").click();
  const dialog = confirmDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByTestId("delete-confirm").click();
  await expect(dialog).toHaveCount(0);

  await expect(eventCard(page, "filter delete target")).toHaveCount(0);
  await expect(eventCard(page, "filter survivor note")).toBeVisible();
  expect(await timelineTexts(page)).toEqual(before.filter((t) => !t.includes("filter delete target")));
  expect(page.url()).toContain(`day=${today}`);
});
