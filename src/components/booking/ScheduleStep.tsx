import { AvailabilityCalendar } from "./AvailabilityCalendar";
import { CouplesOptions } from "./eventTypeOptions/CouplesOptions";
import type { FC } from "react";
import type { ISODatetime } from "@/types";
import { formatVisitDateTime } from "@/utils/formatters";
import { usePageLanguage, useTranslator } from "../TranslatorContext";

type SelectedTimeSlot = ISODatetime;

type Availability = {
  inviteesRemaining: number;
  schedulingUrl: string;
  startTime: string;
  status: string;
};

interface PricingData {
  amount: number;
  productName: string;
}

interface ScheduleStepProps {
  initialAvailability: Availability[];
  selectedTimeSlot: SelectedTimeSlot | null;
  currentAmount: number;
  isLoading: boolean;
  onTimeSlotSelect: (slot: SelectedTimeSlot | null) => void;
  onPriceChange: (data: PricingData) => void;
  onPayToBook: () => void;
}

export const ScheduleStep: FC<ScheduleStepProps> = ({
  initialAvailability,
  selectedTimeSlot,
  currentAmount,
  isLoading,
  onTimeSlotSelect,
  onPriceChange,
  onPayToBook,
}) => {
  const t = useTranslator();
  const language = usePageLanguage();
  const isScheduleComplete = selectedTimeSlot !== null;
  const priceInEuros = (currentAmount / 100).toFixed(0);
  const hasAvailability = initialAvailability.length > 0;

  return (
    <div className="schedule-step">
      <h2>{t("select_time_and_size")}</h2>

      {hasAvailability ? (
        <AvailabilityCalendar
          availability={initialAvailability}
          onTimeSlotSelect={onTimeSlotSelect}
          selectedTimeSlot={selectedTimeSlot}
        />
      ) : (
        "No calendar available"
      )}

      <div className="canvas-options">
        <h3>{t("canvas_size")}</h3>
        <CouplesOptions onChange={onPriceChange} />
      </div>

      {selectedTimeSlot && (
        <button
          className="pay-to-book-btn"
          disabled={!isScheduleComplete || isLoading}
          onClick={onPayToBook}
        >
          {isLoading ? t("loading") : `${t("pay_to_book")} €${priceInEuros}`}
        </button>
      )}

      {!isScheduleComplete && (
        <p className="schedule-error">{t("select_time_to_continue")}</p>
      )}
    </div>
  );
};
