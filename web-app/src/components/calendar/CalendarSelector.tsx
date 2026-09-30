"use client";

import { useEffect, useMemo, useState } from "react";
import {
  WEEKDAY_LABELS,
  applyDayClick,
  buildMonthGrid,
  formatMonthLabel,
  shiftWindow,
  todayDayKey,
  windowBounds,
  type SelectionState,
  type YearMonth,
} from "../../lib/daykeys.js";

type CalendarSelectorProps = {
  anchor: YearMonth;
  selection: SelectionState;
  onAnchorShift: (delta: number) => void;
  onSelectDay: (nextSelection: SelectionState) => void;
  onClear: () => void;
  refreshToken?: string | number;
};

function isDaySelected(selection: SelectionState, dayKey: string): boolean {
  if (selection.kind === "day") return selection.day === dayKey;
  if (selection.kind === "range") return selection.start <= dayKey && dayKey <= selection.end;
  return false;
}

export function useBrowserTimeZone(): string {
  return useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
}

export default function CalendarSelector({
  anchor,
  selection,
  onAnchorShift,
  onSelectDay,
  onClear,
  refreshToken,
}: CalendarSelectorProps) {
  const timeZone = useBrowserTimeZone();
  const [mounted, setMounted] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const months = useMemo(() => shiftWindow(anchor, 0), [anchor]);
  const bounds = useMemo(() => windowBounds(months), [months]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!bounds) return;
    let cancelled = false;
    const params = new URLSearchParams({ from: bounds.from, to: bounds.to, tz: timeZone });
    fetch(`/api/events/counts?${params.toString()}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("counts failed"))))
      .then((data: { counts: Record<string, number> }) => {
        if (!cancelled) setCounts(data.counts ?? {});
      })
      .catch(() => {
        if (!cancelled) setCounts({});
      });
    return () => {
      cancelled = true;
    };
  }, [bounds?.from, bounds?.to, timeZone, refreshToken]);

  if (!mounted) {
    return (
      <section aria-label="Calendar selector" className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="h-6 w-40 animate-pulse rounded bg-slate-100" />
      </section>
    );
  }

  const today = todayDayKey(timeZone);
  const filterActive = selection.kind !== "none";

  return (
    <section aria-label="Calendar selector" className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous months"
          data-testid="calendar-prev"
          onClick={() => onAnchorShift(-1)}
          className="rounded-lg px-3 py-1.5 font-medium text-indigo-600 hover:bg-indigo-50"
        >
          ‹
        </button>
        <p data-testid="calendar-window" className="text-sm font-medium text-slate-700">
          {formatMonthLabel(months[0])} – {formatMonthLabel(months[2])}
        </p>
        <button
          type="button"
          aria-label="Next months"
          data-testid="calendar-next"
          onClick={() => onAnchorShift(1)}
          className="rounded-lg px-3 py-1.5 font-medium text-indigo-600 hover:bg-indigo-50"
        >
          ›
        </button>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-3">
        {months.map((ym) => (
          <div key={`${ym.year}-${ym.month}`}>
            <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
              {formatMonthLabel(ym)}
            </p>
            <div className="grid grid-cols-7 gap-y-1 text-center text-[10px] font-medium text-slate-400">
              {WEEKDAY_LABELS.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {buildMonthGrid(ym).map((cell, index) => {
                const dayKey = cell.dayKey;
                if (!dayKey) {
                  return <span key={`filler-${index}`} aria-hidden className="h-10" />;
                }
                const selected = isDaySelected(selection, dayKey);
                return (
                  <button
                    key={dayKey}
                    type="button"
                    data-testid={`day-${dayKey}`}
                    aria-pressed={selected}
                    onClick={() => onSelectDay(applyDayClick(selection, dayKey))}
                    className={[
                      "flex h-10 flex-col items-center justify-center rounded-lg border text-xs transition",
                      selected
                        ? "border-indigo-600 bg-indigo-600 font-semibold text-white"
                        : "border-transparent hover:bg-indigo-50",
                      !selected && dayKey === today
                        ? "ring-1 ring-indigo-400 font-semibold text-indigo-700"
                        : "",
                    ].join(" ")}
                  >
                    <span>{cell.label}</span>
                    {(counts[dayKey] ?? 0) > 0 && (
                      <span
                        data-testid={`count-${dayKey}`}
                        className={[
                          "text-[10px] leading-none",
                          selected ? "text-indigo-100" : "text-slate-500",
                        ].join(" ")}
                      >
                        {counts[dayKey]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {filterActive && (
        <div className="mt-4 flex items-center justify-between">
          <p data-testid="active-filter" className="text-sm text-slate-500">
            Filter:{" "}
            {selection.kind === "day" ? selection.day : `${selection.start} → ${selection.end}`}
          </p>
          <button
            type="button"
            data-testid="calendar-clear"
            onClick={onClear}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
          >
            Clear selection
          </button>
        </div>
      )}
    </section>
  );
}
