"use client";

import { useEffect, useState } from "react";
import { Modal, Field, inputCls, TextButton, PrimaryButton, toDateStr, addDaysStr } from "@/components/ui";

/**
 * "New event" form, shared by the Calendar tile and the Home Schedule tile
 * so both add events identically. Saving dispatches `btos:data-changed`,
 * which both tiles already listen for — the caller only needs `onClose`.
 */
export default function EventModal({
  open,
  onClose,
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  /** YYYY-MM-DD to preselect (e.g. the day clicked, or the Schedule tile's
   *  currently viewed day); defaults to today. */
  defaultDate?: string;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(toDateStr(new Date()));
  const [endDate, setEndDate] = useState("");
  const [time, setTime] = useState("");
  const [multiDay, setMultiDay] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDate(defaultDate ?? toDateStr(new Date()));
    setEndDate("");
    setTime("");
    setMultiDay(false);
  }, [open, defaultDate]);

  const save = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        date,
        end_date: multiDay && endDate ? endDate : null,
        time: multiDay ? null : time || null,
      }),
    });
    setSaving(false);
    onClose();
    window.dispatchEvent(new Event("btos:data-changed"));
  };

  return (
    <Modal open={open} onClose={onClose} title="New event">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Title">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What's happening?" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={multiDay ? "Start date" : "Date"}>
            <input
              type="date"
              className={inputCls}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                if (multiDay && endDate && endDate < e.target.value) setEndDate(e.target.value);
              }}
            />
          </Field>
          {multiDay ? (
            <Field label="End date">
              <input
                type="date"
                className={inputCls}
                value={endDate}
                min={date}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
          ) : (
            <Field label="Time">
              <input
                type="time"
                className={inputCls}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="All day"
              />
            </Field>
          )}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-2">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-[var(--accent)]"
            checked={multiDay}
            onChange={(e) => {
              setMultiDay(e.target.checked);
              if (e.target.checked && !endDate) setEndDate(addDaysStr(date, 1));
            }}
          />
          Multi-day event (vacation, trip…)
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <TextButton onClick={onClose}>Cancel</TextButton>
          <PrimaryButton type="submit">{saving ? "Adding…" : "Add"}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
