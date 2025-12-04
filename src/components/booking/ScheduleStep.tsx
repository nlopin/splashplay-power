import { useTranslator } from "@/components/TranslatorContext";

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
  isLoading: boolean;
  eventType: EventType;
  onTimeSlotSelect: (slot: SelectedTimeSlot | null) => void;
  onPriceChange: (data: PricingData) => void;
  onPayToBook: () => void;
}

export function ScheduleStep({
  availability,
  selectedTimeSlot,
  isLoading,
  eventType,
  onTimeSlotSelect,
  onPriceChange,
  onPayToBook,
}: ScheduleStepProps) {
  const t = useTranslator();

  return (
    <div className="schedule-step">
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
          className="pay-to-book-btn"
          disabled={!(selectedTimeSlot !== null) || isLoading}
          onClick={onPayToBook}
        >
          {isLoading ? t("loading") : `${t("pay_to_book")}`}
        </button>
        {!(selectedTimeSlot !== null) && (
          <p className="schedule-error">{t("select_time_to_continue")}</p>
        )}
      </div>
    </div>
  );
}
