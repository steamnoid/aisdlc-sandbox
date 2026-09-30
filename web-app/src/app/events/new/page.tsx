"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CalendarSelector, { useBrowserTimeZone } from "../../../components/calendar/CalendarSelector";
import {
  defaultWindow,
  selectionFromParams,
  selectionToParams,
  shiftWindow,
  type SelectionState,
  type YearMonth,
} from "../../../lib/daykeys.js";

type EventRow = {
  id: string;
  raw_text: string;
  created_at: string;
  timezone: string;
};

type PendingDeletion =
  | { kind: "single"; eventId: string }
  | { kind: "bulk"; eventIds: string[] }
  | null;

const MAX_LENGTH = 1000;

function formatTimestamp(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function readInitialSelection(): SelectionState {
  if (typeof window === "undefined") return { kind: "none" };
  return selectionFromParams((key) => new URLSearchParams(window.location.search).get(key));
}

export default function EventsNewPage() {
  const router = useRouter();
  const timeZone = useBrowserTimeZone();
  const [text, setText] = useState("");
  const [allEvents, setAllEvents] = useState<EventRow[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<EventRow[]>([]);
  const [filterLoading, setFilterLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [deletedFlash, setDeletedFlash] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const deletedFlashTimer = useRef<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState<SelectionState>(readInitialSelection);
  const [anchor, setAnchor] = useState<YearMonth>(() => defaultWindow()[2]);
  const [refreshToken, setRefreshToken] = useState(0);

  const filterActive = selection.kind !== "none";
  const selectionKey = JSON.stringify(selectionToParams(selection));
  const visibleEvents = filterActive ? filteredEvents : allEvents;

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("unauthorized"))))
      .then((data) => setEmail(data.email))
      .catch(() => router.replace("/login"));
    fetch("/api/events")
      .then((response) => {
        if (!response.ok) throw new Error("unauthorized");
        return response.json();
      })
      .then((data) => setAllEvents(data.events))
      .catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    if (!filterActive) return;
    const from = selection.kind === "range" ? selection.start : selection.day;
    const to = selection.kind === "range" ? selection.end : selection.day;
    let cancelled = false;
    setFilterLoading(true);
    fetch(`/api/events?from=${from}&to=${to}&tz=${encodeURIComponent(timeZone)}`)
      .then((response) => {
        if (!response.ok) throw new Error("filter failed");
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setFilteredEvents(data.events ?? []);
      })
      .catch(() => {
        if (!cancelled) setFilteredEvents([]);
      })
      .finally(() => {
        if (!cancelled) setFilterLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectionKey, filterActive, refreshToken, timeZone]);

  useEffect(() => {
    const query = new URLSearchParams(selectionToParams(selection)).toString();
    window.history.replaceState(null, "", query ? `/events/new?${query}` : "/events/new");
  }, [selectionKey]);

  function handleSelectDay(nextSelection: SelectionState) {
    setSelection(nextSelection);
  }

  function handleAnchorShift(delta: number) {
    setAnchor((current) => shiftWindow(current, delta)[2]);
  }

  function handleClear() {
    setSelection({ kind: "none" });
    setAnchor(defaultWindow(Date.now(), timeZone)[2]);
  }

  function showDeletedFlash() {
    setDeletedFlash(true);
    if (deletedFlashTimer.current !== null) window.clearTimeout(deletedFlashTimer.current);
    deletedFlashTimer.current = window.setTimeout(() => setDeletedFlash(false), 2000);
  }

  function requestDelete(eventId: string) {
    setError(null);
    setPendingDeletion({ kind: "single", eventId });
  }

  function requestBulkDelete() {
    setError(null);
    setPendingDeletion({ kind: "bulk", eventIds: [...selectedIds] });
  }

  function cancelPendingDeletion() {
    setPendingDeletion(null);
  }

  function applyRemovals(removedIds: string[]) {
    const removed = new Set(removedIds);
    setAllEvents((previous) => previous.filter((item) => !removed.has(item.id)));
    setFilteredEvents((previous) => previous.filter((item) => !removed.has(item.id)));
    setSelectedIds((previous) => previous.filter((id) => !removed.has(id)));
  }

  async function confirmPendingDeletion() {
    const target = pendingDeletion;
    if (!target || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      let removedIds: string[] = [];
      let failed = false;
      if (target.kind === "single") {
        const response = await fetch(`/api/events/${target.eventId}`, { method: "DELETE" });
        if (response.ok) removedIds = [target.eventId];
        else failed = true;
      } else {
        const outcomes = await Promise.all(
          target.eventIds.map(async (eventId) => ({
            eventId,
            ok: (await fetch(`/api/events/${eventId}`, { method: "DELETE" })).ok,
          }))
        );
        removedIds = outcomes.filter((outcome) => outcome.ok).map((outcome) => outcome.eventId);
        failed = removedIds.length < target.eventIds.length;
      }
      setPendingDeletion(null);
      if (target.kind === "bulk") setSelectedIds([]);
      if (removedIds.length > 0) {
        applyRemovals(removedIds);
        setRefreshToken((token) => token + 1);
        showDeletedFlash();
      }
      if (failed) {
        setError("Could not delete - please retry");
      }
    } catch {
      setPendingDeletion(null);
      setError("Failed to delete - check your connection and retry");
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (!pendingDeletion) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") cancelPendingDeletion();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingDeletion]);

  function toggleSelected(eventId: string) {
    setSelectedIds((previous) =>
      previous.includes(eventId)
        ? previous.filter((id) => id !== eventId)
        : [...previous, eventId]
    );
  }

  const trimmedLength = text.trim().length;
  const tooLong = text.length > MAX_LENGTH;
  const canSubmit = trimmedLength > 0 && !tooLong && !saving;
  const counterTone =
    tooLong ? "text-red-600" : text.length >= MAX_LENGTH - 100 ? "text-amber-600" : "text-slate-400";
  const dialogMessage =
    pendingDeletion === null
      ? ""
      : pendingDeletion.kind === "single"
        ? "Delete this event?"
        : `Delete ${pendingDeletion.eventIds.length} ${
            pendingDeletion.eventIds.length === 1 ? "event" : "events"
          }?`;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ text, timezone }),
      });
      if (response.status === 201) {
        const created = (await response.json()) as EventRow;
        setAllEvents((previous) => [created, ...previous]);
        setText("");
        setSavedFlash(true);
        setRefreshToken((token) => token + 1);
        window.setTimeout(() => setSavedFlash(false), 2000);
        return;
      }
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Could not save - please retry");
    } catch {
      setError("Failed to save - check your connection and retry");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your wellbeing timeline</h1>
        <div className="flex items-center gap-3 text-sm">
          {email && <span className="text-slate-500">{email}</span>}
          <button
            onClick={logout}
            className="rounded-lg px-3 py-1.5 font-medium text-indigo-600 hover:bg-indigo-50"
          >
            Log out
          </button>
        </div>
      </header>

      <CalendarSelector
        anchor={anchor}
        selection={selection}
        onAnchorShift={handleAnchorShift}
        onSelectDay={handleSelectDay}
        onClear={handleClear}
        refreshToken={refreshToken}
      />

      <form onSubmit={onSubmit} className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <label htmlFor="event-text" className="block text-sm font-medium text-slate-700">
          What is on your mind?
        </label>
        <textarea
          id="event-text"
          autoFocus
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Woke up at 6:00..."
          className="mt-2 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className={`text-xs tabular-nums ${counterTone}`}>
            {text.length}/{MAX_LENGTH}
          </span>
          {savedFlash && (
            <span role="status" className="text-sm font-medium text-emerald-600">
              Saved ✓
            </span>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          {saving ? "Saving..." : "Submit"}
        </button>
      </form>

      {selectedIds.length > 0 && (
        <div
          data-testid="bulk-bar"
          className="flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-3 ring-1 ring-indigo-200"
        >
          <span className="text-sm font-medium text-indigo-800">
            {selectedIds.length} selected
          </span>
          <button
            type="button"
            data-testid="bulk-delete"
            disabled={deleting}
            onClick={requestBulkDelete}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
          >
            Delete selected
          </button>
        </div>
      )}

      <section aria-label="Your events" className="space-y-3">
        {deletedFlash && (
          <p role="status" data-testid="delete-flash" className="text-sm font-medium text-emerald-600">
            Deleted ✓
          </p>
        )}
        {filterLoading ? (
          <p data-testid="timeline-loading" className="rounded-xl bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
            Loading events for the selected period...
          </p>
        ) : visibleEvents.length === 0 ? (
          <p data-testid="timeline-empty" className="rounded-xl bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
            {filterActive
              ? "No events in the selected period."
              : "No events yet - add your first remark above."}
          </p>
        ) : (
          visibleEvents.map((item) => (
            <article
              key={item.id}
              data-testid="timeline-event"
              className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="whitespace-pre-wrap break-words text-sm">{item.raw_text}</p>
                <div className="shrink-0 text-right">
                  <time className="block text-xs text-slate-500">{formatTimestamp(item.created_at)}</time>
                  <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                    {item.timezone}
                  </span>
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      data-testid="event-select"
                      role="checkbox"
                      aria-checked={selectedIds.includes(item.id)}
                      onClick={() => toggleSelected(item.id)}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Select
                    </button>
                    <button
                      type="button"
                      data-testid="event-delete"
                      onClick={() => requestDelete(item.id)}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      {pendingDeletion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            data-testid="delete-confirm-dialog"
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg ring-1 ring-slate-200"
          >
            <p className="text-sm font-medium text-slate-800">{dialogMessage}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                data-testid="delete-cancel"
                onClick={cancelPendingDeletion}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="delete-confirm"
                disabled={deleting}
                onClick={confirmPendingDeletion}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
