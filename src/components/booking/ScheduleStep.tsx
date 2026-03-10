import { usePageLanguage, useTranslator } from "@/components/TranslatorContext";
import { isServer } from "@/utils/environment";

import type {
  SelectedTimeSlot,
  EventType,
  PricingData,
  Availability,
} from "./types";
import { AvailabilityCalendar } from "./AvailabilityCalendar";
import { EventTypeSelector } from "./EventTypeSelector";
import { EventTypeOptions } from "./eventTypeOptions";

export interface ScheduleStepProps {
  availability: Availability;
  selectedTimeSlot: SelectedTimeSlot | null;
  currentAmount: number | null;
  isLoading: boolean;
  eventType: EventType;
  onTimeSlotSelect: (slot: SelectedTimeSlot | null) => void;
  onPriceChange: (data: PricingData) => void;
  onPayToBook: () => void;
}

export function ScheduleStep({
  availability,
  selectedTimeSlot,
  currentAmount,
  isLoading,
  eventType,
  onTimeSlotSelect,
  onPriceChange,
  onPayToBook,
}: ScheduleStepProps) {
  const t = useTranslator();
  const lang = usePageLanguage();

  const handleBackClick = () => {
    if (isServer()) return;

    const langPrefix = lang === "es" ? "/" : `/${lang}`;
    window.location.href = langPrefix;
  };

  return (
    <div className="schedule-step">
      <button onClick={handleBackClick} className="back-link">
        ← {t("back_to_main")}
      </button>

      <EventTypeSelector currentEventType={eventType} />

      {availability.length > 0 ? (
        <AvailabilityCalendar
          availability={availability}
          onTimeSlotSelect={onTimeSlotSelect}
          selectedTimeSlot={selectedTimeSlot}
        />
      ) : (
        "No calendar available"
      )}

      <div className="canvas-options">
        <EventTypeOptions eventType={eventType} onChange={onPriceChange} />
      </div>

      <div className="book-button-container">
        <button
          className={`pay-to-book-btn ${isLoading ? "loading" : ""}`}
          disabled={
            !selectedTimeSlot ||
            isLoading ||
            (currentAmount != null && currentAmount <= 0)
          }
          onClick={onPayToBook}
        >
          {isLoading ? t("loading") : `${t("pay_to_book")}`}
        </button>
        {!selectedTimeSlot && (
          <p className="schedule-error">{t("select_time_to_continue")}</p>
        )}
        {selectedTimeSlot &&
          currentAmount != null &&
          currentAmount <= 0 && (
            <p className="schedule-error">{t("select_min_participants")}</p>
          )}
      </div>
    </div>
  );
}
