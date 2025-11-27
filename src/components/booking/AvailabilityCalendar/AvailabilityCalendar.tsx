import { useEffect, useMemo, useState } from "react";
import type { ISODatetime } from "@/types";
import { groupWeeks } from "./groupWeeks";
import { formatTime, formatWeek, formatWeekday } from "@/utils/formatters";
import { usePageLanguage, useTranslator } from "@/components/TranslatorContext";

type Availability = {
  startTime: ISODatetime;
};

type SelectedTimeSlot = ISODatetime;

export function AvailabilityCalendar({
  availability,
  onTimeSlotSelect,
  selectedTimeSlot,
}: {
  availability: Availability[];
  onTimeSlotSelect?: (slot: SelectedTimeSlot | null) => void;
  selectedTimeSlot?: SelectedTimeSlot | null;
}) {
  const t = useTranslator();
  const language = usePageLanguage();
  const weeks = useMemo(
    () =>
      groupWeeks(availability.map((availability) => availability.startTime)),
    [availability],
  );
  const [selectedWeek, setSelectedWeek] = useState<number>(0); // 0 — current week
  const currentWeek = weeks[selectedWeek];

  return (
    <div
      className="availability-calendar"
      style={{ display: "flex", gap: "2rem", marginBottom: "2rem" }}
    >
      <div className="dates-column" style={{ flex: 1 }}>
        <h3 style={{ marginBottom: "1rem", color: "#333" }}>Available Dates</h3>
        <div style={{ display: "flex" }}>
          <div>
            <button
              type="button"
              onClick={() => {
                setSelectedWeek((cur) => cur - 1);
              }}
              disabled={selectedWeek === 0}
            >
              ←
            </button>
          </div>
          <div>
            {formatWeek(currentWeek[0].date, currentWeek[6].date, language)}
          </div>
          <div>
            <button
              type="button"
              disabled={selectedWeek === weeks.length - 1}
              onClick={() => {
                setSelectedWeek((cur) => cur + 1);
              }}
            >
              →
            </button>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: "2rem",
          }}
        >
          {currentWeek.map((day) => {
            const [weekday, dateString] = formatWeekday(day.date);
            return (
              <div key={dateString}>
                <p>{weekday}</p>
                <p>{dateString}</p>
              </div>
            );
          })}
          {currentWeek.map(({ times }: { times: ISODatetime[] }) => {
            return (
              <div>
                <ul>
                  {times.map((time) => (
                    <li
                      onClick={() => {
                        setInternalSelectedSlot(time);
                        onTimeSlotSelect?.(time);
                      }}
                    >
                      {formatTime(time)}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
