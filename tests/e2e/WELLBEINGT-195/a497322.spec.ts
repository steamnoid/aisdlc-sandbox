import { expect, request as pwRequest, test } from "@playwright/test";
import { BASE_URL } from "../infra/env";
import { apiCreateEvent, apiListEvents, apiRegister, findOwnEventId, uniqueEmail } from "../helpers";

test("QA: A foreign event cannot be removed through my session [WELLBEINGT-195]", async () => {
  const accountA = await pwRequest.newContext({ baseURL: BASE_URL });
  const accountB = await pwRequest.newContext({ baseURL: BASE_URL });

  await apiRegister(accountA, uniqueEmail("foreign-a"));
  await apiCreateEvent(accountA, "A own note");

  await apiRegister(accountB, uniqueEmail("foreign-b"));
  await apiCreateEvent(accountB, "B secret note");
  const bEventId = await findOwnEventId(accountB, "B secret note");

  const refusal = await accountA.delete(`/api/events/${bEventId}`);
  expect(refusal.status()).toBeGreaterThanOrEqual(400);

  const bEvents = await apiListEvents(accountB);
  expect(bEvents.filter((e) => e.raw_text === "B secret note")).toHaveLength(1);
});
