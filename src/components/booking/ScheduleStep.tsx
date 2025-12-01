import { type FC, useState } from "react";

import { useTranslator } from "@/components/TranslatorContext";

import type { SelectedTimeSlot } from "./types";
import { AvailabilityCalendar } from "./AvailabilityCalendar";
import { CouplesOptions } from "./eventTypeOptions/CouplesOptions";

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

export interface ScheduleStepProps {
  initialAvailability: Availability[];
  selectedTimeSlot: SelectedTimeSlot | null;
  isLoading: boolean;
  onTimeSlotSelect: (slot: SelectedTimeSlot | null) => void;
  onPriceChange: (data: PricingData) => void;
  onPayToBook: () => void;
}

export const ScheduleStep: FC<ScheduleStepProps> = ({
  initialAvailability,
  selectedTimeSlot,
  isLoading,
  onTimeSlotSelect,
  onPriceChange,
  onPayToBook,
}) => {
  const t = useTranslator();
  const [currentAmount, setCurrentAmount] = useState<number | null>(null);

  const isScheduleComplete =
    selectedTimeSlot !== null && currentAmount !== null;
  const hasAvailability = initialAvailability.length > 0;

  const handlePriceChange = (data: PricingData) => {
    setCurrentAmount(data.amount);
    onPriceChange(data);
  };

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
        <CouplesOptions onChange={handlePriceChange} />
      </div>

      {!isScheduleComplete && (
        <p className="schedule-error">{t("select_time_to_continue")}</p>
      )}
      <button
        className="pay-to-book-btn"
        disabled={!isScheduleComplete || isLoading}
        onClick={onPayToBook}
      >
        {isLoading ? t("loading") : `${t("pay_to_book")}`}
      </button>
    </div>
  );
};
