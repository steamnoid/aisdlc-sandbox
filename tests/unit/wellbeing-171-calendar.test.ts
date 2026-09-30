import { describe, it, expect } from "vitest";
import * as daykeys from "../../web-app/src/lib/daykeys.js";

describe("WELLBEINGT-171 daykeys — approved Product AC foundations", () => {
  it("isValidDayKey accepts real calendar days and rejects malformed ones", () => {
    expect(daykeys.isValidDayKey("2026-08-23")).toBe(true);
    expect(daykeys.isValidDayKey("2024-02-29")).toBe(true);
    expect(daykeys.isValidDayKey("2026-02-30")).toBe(false);
    expect(daykeys.isValidDayKey("2026-13-01")).toBe(false);
    expect(daykeys.isValidDayKey("23-08-2026")).toBe(false);
    expect(daykeys.isValidDayKey(null)).toBe(false);
    expect(daykeys.isValidDayKey(undefined)).toBe(false);
  });

  it("WELLBEINGT-187 AC-1 defaultWindow shows current month followed by the two previous months", () => {
    const window = daykeys.defaultWindow(new Date("2026-08-23T12:00:00Z"));
    expect(window).toEqual([
      { year: 2026, month: 6 },
      { year: 2026, month: 7 },
      { year: 2026, month: 8 },
    ]);
  });

  it("defaultWindow respects the time zone when picking the current month", () => {
    const instant = "2026-01-01T00:30:00Z";
    expect(daykeys.defaultWindow(instant, "Europe/Warsaw")[2]).toEqual({ year: 2026, month: 1 });
    expect(daykeys.defaultWindow(instant, "America/New_York")[2]).toEqual({ year: 2025, month: 12 });
  });

  it("shiftWindow rolls across year boundaries while paging months (anchor = newest visible month)", () => {
    expect(daykeys.shiftWindow({ year: 2026, month: 12 }, 1)[2]).toEqual({ year: 2027, month: 1 });
    expect(daykeys.shiftWindow({ year: 2026, month: 1 }, -1)[2]).toEqual({ year: 2025, month: 12 });
    expect(daykeys.shiftWindow({ year: 2026, month: 6 }, 0)).toEqual([
      { year: 2026, month: 4 },
      { year: 2026, month: 5 },
      { year: 2026, month: 6 },
    ]);
    expect(daykeys.shiftWindow({ year: 2026, month: 8 }, -1)).toEqual([
      { year: 2026, month: 5 },
      { year: 2026, month: 6 },
      { year: 2026, month: 7 },
    ]);
  });

  it("buildMonthGrid lays out Monday-first weeks padded to whole weeks", () => {
    const grid = daykeys.buildMonthGrid({ year: 2026, month: 8 });
    expect(grid.length % 7).toBe(0);
    const inMonth = grid.filter((cell) => cell.inMonth);
    expect(inMonth[0].dayKey).toBe("2026-08-01");
    expect(inMonth[inMonth.length - 1].dayKey).toBe("2026-08-31");
    expect(inMonth).toHaveLength(31);
    expect(grid[0].inMonth).toBe(false);
    expect(grid.filter((cell) => !cell.inMonth)).toHaveLength(grid.length - 31);
  });

  it("windowBounds spans the first day of the first month to the last day of the last month", () => {
    expect(daykeys.windowBounds([{ year: 2026, month: 6 }, { year: 2026, month: 7 }, { year: 2026, month: 8 }])).toEqual({
      from: "2026-06-01",
      to: "2026-08-31",
    });
    expect(daykeys.windowBounds([])).toBeNull();
  });
});

describe("WELLBEINGT-188 per-day counts foundations — approved Product AC", () => {
  it("eachDayKey enumerates closed ranges including month rollovers", () => {
    expect(daykeys.eachDayKey("2026-07-30", "2026-08-02")).toEqual([
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
    ]);
    expect(() => daykeys.eachDayKey("2026-08-02", "2026-08-01")).toThrow(/after/);
  });

  it("window counts fetch bounds feed the whole visible window", () => {
    const months = daykeys.shiftWindow({ year: 2026, month: 3 }, -1);
    expect(months).toEqual([
      { year: 2025, month: 12 },
      { year: 2026, month: 1 },
      { year: 2026, month: 2 },
    ]);
    expect(daykeys.windowBounds(months)).toEqual({ from: "2025-12-01", to: "2026-02-28" });
  });
});

describe("WELLBEINGT-190 date-range normalization — approved Product AC", () => {
  it("AC-6 an earlier second tap becomes the start without erroring", () => {
    expect(daykeys.normalizeRange("2026-08-20", "2026-08-15")).toEqual({
      start: "2026-08-15",
      end: "2026-08-20",
    });
  });

  it("a later second tap keeps natural order", () => {
    expect(daykeys.normalizeRange("2026-08-15", "2026-08-20")).toEqual({
      start: "2026-08-15",
      end: "2026-08-20",
    });
  });

  it("AC-8 selecting the same day twice collapses to a one-day range", () => {
    expect(daykeys.normalizeRange("2026-08-20", "2026-08-20")).toEqual({
      start: "2026-08-20",
      end: "2026-08-20",
    });
  });

  it("click model: first tap selects a day, second closes the range, next tap restarts", () => {
    const first = daykeys.applyDayClick({ kind: "none" }, "2026-08-15");
    expect(first).toEqual({ kind: "day", day: "2026-08-15" });
    const second = daykeys.applyDayClick(first, "2026-08-10");
    expect(second).toEqual({ kind: "range", start: "2026-08-10", end: "2026-08-15" });
    const third = daykeys.applyDayClick(second, "2026-09-01");
    expect(third).toEqual({ kind: "day", day: "2026-09-01" });
  });
});

describe("WELLBEINGT-193 URL persistence mapping — approved Product AC", () => {
  it("single-day selection serializes as ?day=", () => {
    expect(daykeys.selectionToParams({ kind: "day", day: "2026-08-23" })).toEqual({ day: "2026-08-23" });
    expect(daykeys.selectionToParams({ kind: "none" })).toEqual({});
  });

  it("range selection serializes as ?from=&to=", () => {
    expect(
      daykeys.selectionToParams({ kind: "range", start: "2026-08-01", end: "2026-08-07" })
    ).toEqual({ from: "2026-08-01", to: "2026-08-07" });
  });

  it("selection restores from params and ignores invalid or inverted input", () => {
    expect(daykeys.selectionFromParams((k) => (k === "day" ? "2026-08-23" : null))).toEqual({
      kind: "day",
      day: "2026-08-23",
    });
    expect(
      daykeys.selectionFromParams((k) => ({ from: "2026-08-01", to: "2026-08-07" }[k] ?? null))
    ).toEqual({ kind: "range", start: "2026-08-01", end: "2026-08-07" });
    expect(daykeys.selectionFromParams((k) => (k === "day" ? "garbage" : null))).toEqual({ kind: "none" });
    expect(
      daykeys.selectionFromParams((k) => ({ from: "2026-08-07", to: "2026-08-01" }[k] ?? null))
    ).toEqual({ kind: "none" });
    expect(daykeys.selectionFromParams(() => null)).toEqual({ kind: "none" });
  });
});

describe("time zone day boundaries (browser-local semantics)", () => {
  it("UTC identity boundaries", () => {
    expect(daykeys.dayKeyToUtcRange("2026-08-23")).toEqual({
      startUtcIso: "2026-08-23T00:00:00.000Z",
      endExclusiveUtcIso: "2026-08-24T00:00:00.000Z",
    });
  });

  it("Europe/Warsaw summer day starts at 22:00Z of the previous UTC day", () => {
    expect(daykeys.dayKeyToUtcRange("2026-08-23", "Europe/Warsaw")).toEqual({
      startUtcIso: "2026-08-22T22:00:00.000Z",
      endExclusiveUtcIso: "2026-08-23T22:00:00.000Z",
    });
  });

  it("DST spring-forward day is 23 hours long", () => {
    expect(daykeys.dayKeyToUtcRange("2026-03-29", "Europe/Warsaw")).toEqual({
      startUtcIso: "2026-03-28T23:00:00.000Z",
      endExclusiveUtcIso: "2026-03-29T22:00:00.000Z",
    });
  });

  it("DST fall-back day is 25 hours long", () => {
    expect(daykeys.dayKeyToUtcRange("2026-10-25", "Europe/Warsaw")).toEqual({
      startUtcIso: "2026-10-24T22:00:00.000Z",
      endExclusiveUtcIso: "2026-10-25T23:00:00.000Z",
    });
  });

  it("dayRangeToUtcRange composes inclusive multi-day bounds", () => {
    expect(daykeys.dayRangeToUtcRange("2026-08-22", "2026-08-23", "Europe/Warsaw")).toEqual({
      startUtcIso: "2026-08-21T22:00:00.000Z",
      endExclusiveUtcIso: "2026-08-23T22:00:00.000Z",
    });
  });

  it("invalid inputs are rejected with HTTP 400-style errors", () => {
    expect(() => daykeys.dayKeyToUtcRange("2026-02-30")).toThrow();
    expect(() => daykeys.dayRangeToUtcRange("2026-08-10", "2026-08-09")).toThrow(/after/);
  });

  it("dayKeyInZone buckets instants by the zone's wall clock", () => {
    expect(daykeys.dayKeyInZone("2026-08-23T21:59:00Z", "Europe/Warsaw")).toBe("2026-08-23");
    expect(daykeys.dayKeyInZone("2026-08-23T22:00:00Z", "Europe/Warsaw")).toBe("2026-08-24");
    expect(daykeys.dayKeyInZone(0, "UTC")).toBe("1970-01-01");
  });
});
