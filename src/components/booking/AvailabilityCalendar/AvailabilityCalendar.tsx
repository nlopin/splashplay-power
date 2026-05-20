import { Fragment, useEffect, useMemo, useState } from "react";

import type { ISODatetime } from "@/types";
import { formatTime, formatWeek, formatWeekday } from "@/utils/formatters";
import { usePageLanguage, useTranslator } from "@/components/TranslatorContext";
import type { Discount } from "@/services/availability/types";

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

  const discountMap = useMemo(
    () => new Map(availability.map((s) => [s.time, s.discount])),
    [availability],
  );
  const weeks = useMemo(
    () => groupWeeks(availability.map((s) => s.time)),
    [availability],
  );

  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);
  const [mobileWeekCount, setMobileWeekCount] = useState<number>(1);
  const currentWeek = weeks[selectedWeekIndex];

  const uniqueTimes = useMemo(() => {
    const set = new Set<string>();
    for (const day of currentWeek ?? []) {
      for (const slot of day.times) {
        set.add(formatTime(slot));
      }
    }
    return Array.from(set).sort();
  }, [currentWeek]);

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
            const dow = day.date.getUTCDay();
            const isPopular = dow === 5 || dow === 6 || dow === 0;
            return (
              <div
                key={meta.longDate}
                className={`grid-cell header-cell${isPopular ? " popular" : ""}`}
              >
                <div className="weekday desktop-only">{meta.longWeekday}</div>
                <div className="weekday mobile-only">{meta.shortWeekday}</div>
                <div className="date desktop-only">{meta.longDate}</div>
                <div className="date mobile-only">{meta.shortDate}</div>
              </div>
            );
          })}

          {uniqueTimes.map((timeStr) => (
            <Fragment key={timeStr}>
              {currentWeek.map((day, dayIndex) => {
                const slot = day.times.find((t) => formatTime(t) === timeStr);
                const dow = day.date.getUTCDay();
                return (
                  <div
                    key={`cell-${dayIndex}-${timeStr}`}
                    className="grid-cell slot-cell"
                  >
                    {slot && (
                      <TimeSlotButton
                        time={slot}
                        isSelected={internalSelectedSlot === slot}
                        onSelect={handleSelect}
                        discount={discountMap.get(slot)}
                      />
                    )}
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
              </div>
              {day.times.length > 0 ? (
                <div className="day-card-slots">
                  {day.times.map((time) => (
                    <TimeSlotButton
                      key={time}
                      time={time}
                      isSelected={internalSelectedSlot === time}
                      onSelect={handleSelect}
                      discount={discountMap.get(time)}
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
  return { longWeekday, longDate, shortWeekday, shortDate };
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
  discount,
}: {
  time: ISODatetime;
  isSelected: boolean;
  onSelect: (time: ISODatetime) => void;
  discount?: Discount;
}) => {
  const formattedTime = formatTime(time);
  return (
    <button
      type="button"
      onClick={() => onSelect(time)}
      className={`time-slot-button ${isSelected ? "selected" : ""}`}
    >
      {formattedTime}
      {discount && <span className="discount-badge">-{discount}%</span>}
    </button>
  );
};
