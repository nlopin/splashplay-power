import { Fragment, useEffect, useMemo, useState } from "react";

import type { ISODatetime } from "@/types";
import { formatTime, formatWeek, formatWeekday } from "@/utils/formatters";
import { usePageLanguage } from "@/components/TranslatorContext";

import type { Availability, SelectedTimeSlot } from "../types";
import { groupWeeks } from "./groupWeeks";

const hoursRegex = /T(\d{2}):/;

export function AvailabilityCalendar({
  availability,
  onTimeSlotSelect,
  selectedTimeSlot,
}: {
  availability: Availability;
  onTimeSlotSelect?: (slot: SelectedTimeSlot | null) => void;
  selectedTimeSlot?: SelectedTimeSlot | null;
}) {
  const language = usePageLanguage();
  const [internalSelectedSlot, setInternalSelectedSlot] =
    useState<SelectedTimeSlot | null>(null);

  useEffect(() => {
    setInternalSelectedSlot(selectedTimeSlot ?? null);
  }, [selectedTimeSlot]);

  const weeks = useMemo(() => groupWeeks(availability), [availability]);

  const hours = useMemo(() => {
    const START_HOUR = 9;
    const DEFAULT_END_HOUR = 21;
    if (availability.length === 0) {
      return Array.from(
        { length: DEFAULT_END_HOUR - START_HOUR + 1 },
        (_, i) => i + START_HOUR,
      ); // Default 9-21
    }
    const endHour = availability.reduce((curMax, slot) => {
      const execResult = hoursRegex.exec(slot);
      if (!execResult) return curMax;
      return Math.max(parseInt(execResult[1], 10) + 1, curMax);
    }, START_HOUR);

    return Array.from(
      { length: endHour - START_HOUR + 1 },
      (_, i) => i + START_HOUR,
    );
  }, [availability]);

  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);
  const currentWeek = weeks[selectedWeekIndex];

  if (!currentWeek) {
    // todo: allow to book without a calendar
    return <div>Error! No calendar available</div>;
  }

  // Track the index of the next time slot to process for each day
  const dayIndices = new Array(currentWeek.length).fill(0);

  return (
    <div className="availability-calendar">
      <div className="calendar-header">
        <button
          type="button"
          onClick={() => setSelectedWeekIndex((cur) => cur - 1)}
          disabled={selectedWeekIndex === 0}
          className="nav-button"
        >
          ←
        </button>
        <span className="week-display">
          {formatWeek(currentWeek[0].date, currentWeek[6].date, language)}
        </span>
        <button
          type="button"
          disabled={selectedWeekIndex === weeks.length - 1}
          onClick={() => setSelectedWeekIndex((cur) => cur + 1)}
          className="nav-button"
        >
          →
        </button>
      </div>

      <div className="calendar-grid">
        {currentWeek.map((day) => {
          const [longWeekday, longDate] = formatWeekday(
            day.date,
            language,
            "long",
          );
          const [shortWeekday, shortDate] = formatWeekday(
            day.date,
            language,
            "short",
          );
          const isAlmostFilled = day.times.length > 0 && day.times.length < 5;

          return (
            <div key={longDate} className="grid-cell header-cell">
              <div className="weekday desktop-only">{longWeekday}</div>
              <div className="weekday mobile-only">{shortWeekday}</div>
              <div className="date desktop-only">{longDate}</div>
              <div className="date mobile-only">{shortDate}</div>
              {isAlmostFilled && <div className="busy-label">Last spots!</div>}
            </div>
          );
        })}

        {/* Time Rows */}
        {hours.map((hour) => (
          <Fragment key={hour}>
            {currentWeek.map((day, dayIndex) => {
              const slotsInHour: ISODatetime[] = [];
              let idx = dayIndices[dayIndex];

              // Consume slots that belong to the current hour
              // assumes day.times is sorted ascending
              while (idx < day.times.length) {
                const time = day.times[idx];
                const timeStr = formatTime(time);
                const [h] = timeStr.split(":").map(Number);

                if (h === hour) {
                  slotsInHour.push(time);
                  idx++;
                } else if (h < hour) {
                  // Skip past times (shouldn't happen if sorted and starting from 9)
                  idx++;
                } else {
                  // Future time, stop for this hour
                  break;
                }
              }

              // Update the index for the next hour iteration
              dayIndices[dayIndex] = idx;

              return (
                <div
                  key={`cell-${dayIndex}-${hour}`}
                  className="grid-cell slot-cell"
                >
                  {slotsInHour.map((time) => {
                    const formattedTime = formatTime(time);

                    return (
                      <button
                        key={time}
                        type="button"
                        onClick={() => {
                          setInternalSelectedSlot(time);
                          onTimeSlotSelect?.(time);
                        }}
                        data-minute={formattedTime.split(":")[1]}
                        className={`time-slot-button ${internalSelectedSlot === time ? "selected" : ""}`}
                      >
                        {formattedTime}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
