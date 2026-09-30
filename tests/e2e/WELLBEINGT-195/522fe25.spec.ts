import { expect, request as pwRequest, test } from "@playwright/test";
import { BASE_URL } from "../infra/env";
import { apiCreateEvent, apiListEvents, apiRegister, findOwnEventId, uniqueEmail } from "../helpers";

test("QA: Repeating a finished deletion ends as already-done instead of failing [WELLBEINGT-195]", async () => {
  const account = await pwRequest.newContext({ baseURL: BASE_URL });
  await apiRegister(account, uniqueEmail("repeat"));
  await apiCreateEvent(account, "Repeat target note");
  const eventId = await findOwnEventId(account, "Repeat target note");

  const first = await account.delete(`/api/events/${eventId}`);
  expect(first.status()).toBe(200);
  expect(((await first.json()) as { ok?: boolean }).ok).toBe(true);

  const second = await account.delete(`/api/events/${eventId}`);
  expect(second.status()).toBe(200);
  expect(((await second.json()) as { ok?: boolean }).ok).toBe(true);

  const events = await apiListEvents(account);
  expect(events.filter((e) => e.raw_text === "Repeat target note")).toHaveLength(0);
});
