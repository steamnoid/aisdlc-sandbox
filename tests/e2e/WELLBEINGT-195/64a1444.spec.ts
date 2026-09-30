import { expect, test } from "@playwright/test";
import {
  apiCreateEvent,
  apiListEvents,
  apiLogout,
  apiRegister,
  deleteViaUi,
  eventCard,
  loginViaForm,
  uniqueEmail,
} from "../helpers";

test("QA: Deletion is permanent across sessions [WELLBEINGT-195]", async ({ page }) => {
  const email = uniqueEmail("perm");
  const request = page.context().request;
  await apiRegister(request, email);
  await apiCreateEvent(request, "Permanence alpha note");

  await page.goto("/");
  await eventCard(page, "Permanence alpha note").waitFor();

  await deleteViaUi(page, "Permanence alpha note");
  await expect(eventCard(page, "Permanence alpha note")).toHaveCount(0);

  await apiLogout(request);

  await page.goto("/");
  await page.locator('input[type="email"]').waitFor();
  await loginViaForm(page, email);
  await page.goto("/");
  await expect(eventCard(page, "Permanence alpha note")).toHaveCount(0);

  const events = await apiListEvents(request);
  expect(events.filter((e) => e.raw_text === "Permanence alpha note")).toHaveLength(0);
});
