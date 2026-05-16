import { Fragment, useEffect, useMemo, useState } from "react";

import type { ISODatetime } from "@/types";
import {
  formatTime,
  formatWeek,
  formatWeekday,
  getHourInBusinessTimezone,
} from "@/utils/formatters";
import { usePageLanguage, useTranslator } from "@/components/TranslatorContext";

import type { Availability, SelectedTimeSlot } from "../types";
import type { Day } from "./groupWeeks";
import { groupWeeks } from "./groupWeeks";
import { ChevronDown } from "./ChevronDown";

type Translator = ReturnType<typeof useTranslator>;

export function AvailabilityCalendar({
  availability,
  onTimeSlotSelect,
  selectedTimeSlot,
}: {
  availability: Availability;
  onTimeSlotSelect?: (slot: SelectedTimeSlot | null) => void;
  selectedTimeSlot?: SelectedTimeSlot | null;
}) {
  const t = useTranslator();
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
      // Convert to business timezone before extracting hour (handles DST)
      const hour = getHourInBusinessTimezone(slot);
      // +1 to include the hour block containing this slot (e.g., slot at 15:30 needs a table till 16)
      return Math.max(hour + 1, curMax);
    }, START_HOUR);

    return Array.from(
      { length: endHour - START_HOUR + 1 },
      (_, i) => i + START_HOUR,
    );
  }, [availability]);

  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);
  const [mobileWeekCount, setMobileWeekCount] = useState<number>(1);
  const currentWeek = weeks[selectedWeekIndex];
  const mobileDays = weeks.slice(0, mobileWeekCount).flat();

  if (!currentWeek) {
    return <div>Error! No calendar available</div>;
  }

  const handleSelect = (time: ISODatetime) => {
    setInternalSelectedSlot(time);
    onTimeSlotSelect?.(time);
  };

  const isFirstWeek = selectedWeekIndex === 0;
  const isLastWeek = selectedWeekIndex === weeks.length - 1;
  const goPrev = () => setSelectedWeekIndex((cur) => cur - 1);
  const goNext = () => setSelectedWeekIndex((cur) => cur + 1);

  // Track the index of the next time slot to process for each day
  const dayIndices = new Array(currentWeek.length).fill(0);

  return (
    <div className="availability-calendar">
      <WeekNav
        weekLabel={formatWeek(
          currentWeek[0].date,
          currentWeek[6].date,
          language,
        )}
        isFirstWeek={isFirstWeek}
        isLastWeek={isLastWeek}
        onPrev={goPrev}
        onNext={goNext}
        t={t}
      />

      <div className="calendar-body">
        <button
          type="button"
          onClick={goPrev}
          disabled={isFirstWeek}
          className="nav-button nav-button-side"
          aria-label={t("previous_week")}
        >
          ‹
        </button>

        <div className="calendar-grid">
          {currentWeek.map((day) => {
            const meta = getDayMeta(day, language);
            return (
              <div key={meta.longDate} className="grid-cell header-cell">
                <div className="weekday desktop-only">{meta.longWeekday}</div>
                <div className="weekday mobile-only">{meta.shortWeekday}</div>
                <div className="date desktop-only">{meta.longDate}</div>
                <div className="date mobile-only">{meta.shortDate}</div>
                {meta.isAlmostFilled && (
                  <div className="busy-label">{t("last_spots")}</div>
                )}
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
                    {slotsInHour.map((time) => (
                      <TimeSlotButton
                        key={time}
                        time={time}
                        isSelected={internalSelectedSlot === time}
                        onSelect={handleSelect}
                        withMinuteAttr
                      />
                    ))}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>

        <button
          type="button"
          onClick={goNext}
          disabled={isLastWeek}
          className="nav-button nav-button-side"
          aria-label={t("next_week")}
        >
          ›
        </button>
      </div>

      <div className="calendar-day-list">
        {mobileDays.map((day) => {
          const meta = getDayMeta(day, language);
          return (
            <div key={`day-${day.date}`} className="day-card">
              <div className="day-card-header">
                <span className="weekday">{meta.longWeekday}</span>
                <span className="date">{meta.longDate}</span>
                {meta.isAlmostFilled && (
                  <span className="busy-label">{t("last_spots")}</span>
                )}
              </div>
              {day.times.length > 0 ? (
                <div className="day-card-slots">
                  {day.times.map((time) => (
                    <TimeSlotButton
                      key={time}
                      time={time}
                      isSelected={internalSelectedSlot === time}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              ) : (
                <span className="day-card-empty">—</span>
              )}
            </div>
          );
        })}

        <button
          type="button"
          disabled={mobileWeekCount >= weeks.length}
          onClick={() => setMobileWeekCount((cur) => cur + 1)}
          className="nav-button nav-button-bar"
          aria-label={t("next_week")}
        >
          <ChevronDown />
        </button>
      </div>
    </div>
  );
}

function getDayMeta(day: Day, language: string) {
  const [longWeekday, longDate] = formatWeekday(day.date, language, "long");
  const [shortWeekday, shortDate] = formatWeekday(day.date, language, "short");
  const isAlmostFilled = day.times.length > 0 && day.times.length < 5;
  return { longWeekday, longDate, shortWeekday, shortDate, isAlmostFilled };
}

const WeekNav = ({
  weekLabel,
  isFirstWeek,
  isLastWeek,
  onPrev,
  onNext,
  t,
}: {
  weekLabel: string;
  isFirstWeek: boolean;
  isLastWeek: boolean;
  onPrev: () => void;
  onNext: () => void;
  t: Translator;
}) => {
  return (
    <div className="calendar-header">
      <button
        type="button"
        onClick={onPrev}
        disabled={isFirstWeek}
        className="nav-button"
        aria-label={t("previous_week")}
      >
        ←
      </button>
      <span className="week-display">{weekLabel}</span>
      <button
        type="button"
        onClick={onNext}
        disabled={isLastWeek}
        className="nav-button"
        aria-label={t("next_week")}
      >
        →
      </button>
    </div>
  );
};

const TimeSlotButton = ({
  time,
  isSelected,
  onSelect,
  withMinuteAttr,
}: {
  time: ISODatetime;
  isSelected: boolean;
  onSelect: (time: ISODatetime) => void;
  withMinuteAttr?: boolean;
}) => {
  const formattedTime = formatTime(time);
  return (
    <button
      type="button"
      onClick={() => onSelect(time)}
      data-minute={withMinuteAttr ? formattedTime.split(":")[1] : undefined}
      className={`time-slot-button ${isSelected ? "selected" : ""}`}
    >
      {formattedTime}
    </button>
  );
};
