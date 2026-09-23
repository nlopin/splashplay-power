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
  currentGuests: number | null;
  isLoading: boolean;
  eventType: EventType;
  bookingError?: string | null;
  onTimeSlotSelect: (slot: SelectedTimeSlot | null) => void;
  onPriceChange: (data: PricingData) => void;
  onPayToBook: () => void;
}

export function ScheduleStep({
  availability,
  selectedTimeSlot,
  currentAmount,
  currentGuests,
  isLoading,
  eventType,
  bookingError,
  onTimeSlotSelect,
  onPriceChange,
  onPayToBook,
}: ScheduleStepProps) {
  const t = useTranslator();
  const lang = usePageLanguage();

  const selectedSlot = selectedTimeSlot
    ? availability.find((a) => a.time === selectedTimeSlot)
    : undefined;
  const notEnoughSpots =
    selectedSlot?.spotsLeft != null &&
    currentGuests != null &&
    currentGuests > selectedSlot.spotsLeft;

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
        <EventTypeOptions
          eventType={eventType}
          onChange={onPriceChange}
          showPrice={!!selectedTimeSlot}
          discount={selectedSlot?.discount}
          spotsLeft={selectedSlot?.spotsLeft}
        />
      </div>

      <div className="book-button-container">
        <button
          className={`pay-to-book-btn ${isLoading ? "loading" : ""}`}
          disabled={
            !selectedTimeSlot ||
            isLoading ||
            notEnoughSpots ||
            (currentAmount != null && currentAmount <= 0)
          }
          onClick={onPayToBook}
        >
          {isLoading ? t("loading") : `${t("pay_to_book")}`}
        </button>
        {!selectedTimeSlot && (
          <p className="schedule-error">{t("select_time_to_continue")}</p>
        )}
        {selectedTimeSlot && currentAmount != null && currentAmount <= 0 && (
          <p className="schedule-error">{t("select_min_participants")}</p>
        )}
        {notEnoughSpots && (
          <p className="schedule-error">{t("error_slot_full")}</p>
        )}
        {bookingError && (
          <p className="schedule-error">{bookingError}</p>
        )}
      </div>
    </div>
  );
}
