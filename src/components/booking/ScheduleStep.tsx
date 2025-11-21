import AvailabilityCalendar from "../AvailabilityCalendar";
import CouplesOptions from "./eventTypeOptions/CouplesOptions";
import { BookingSummary } from "./BookingSummary";
import type { FC } from "react";

type SelectedTimeSlot = {
  startTime: string;
  formattedDate: string;
  formattedTime: string;
  schedulingUrl: string;
};

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
  currentProductName: string;
  isLoading: boolean;
  onTimeSlotSelect: (slot: SelectedTimeSlot | null) => void;
  onPriceChange: (data: PricingData) => void;
  onPayToBook: () => void;
  translations: any;
}

export const ScheduleStep: FC<ScheduleStepProps> = ({
  initialAvailability,
  selectedTimeSlot,
  currentAmount,
  currentProductName,
  isLoading,
  onTimeSlotSelect,
  onPriceChange,
  onPayToBook,
  translations,
}) => {
  const isScheduleComplete = selectedTimeSlot !== null;
  const priceInEuros = (currentAmount / 100).toFixed(0);

  return (
    <div
      className="schedule-step"
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "20px",
      }}
    >
      <h2
        style={{
          textAlign: "center",
          marginBottom: "2rem",
          color: "#333",
          fontSize: "2rem",
        }}
      >
        {translations.select_time_and_size || "Select Time & Canvas Size"}
      </h2>

      <AvailabilityCalendar
        availability={initialAvailability}
        onTimeSlotSelect={onTimeSlotSelect}
        selectedTimeSlot={selectedTimeSlot}
      />

      <div
        className="canvas-options"
        style={{
          backgroundColor: "#f8f9fa",
          padding: "20px",
          borderRadius: "12px",
          marginBottom: "2rem",
        }}
      >
        <h3
          style={{
            marginBottom: "1rem",
            color: "#333",
            textAlign: "center",
          }}
        >
          {translations.canvas_size || "Canvas Size"}
        </h3>
        <CouplesOptions onChange={onPriceChange} />
      </div>

      <BookingSummary
        selectedTimeSlot={selectedTimeSlot}
        currentAmount={currentAmount}
        currentProductName={currentProductName}
        mode="preview"
        translations={translations}
      />

      {selectedTimeSlot && (
        <button
          className="pay-to-book-btn"
          disabled={!isScheduleComplete || isLoading}
          onClick={onPayToBook}
          style={{
            width: "100%",
            padding: "18px 32px",
            fontSize: "20px",
            fontWeight: "bold",
            backgroundColor: isScheduleComplete ? "#007cba" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "12px",
            cursor: isScheduleComplete ? "pointer" : "not-allowed",
            transition: "all 0.2s ease",
            boxShadow: isScheduleComplete
              ? "0 4px 12px rgba(0, 124, 186, 0.3)"
              : "none",
            marginTop: "16px",
          }}
          onMouseEnter={(e) => {
            if (isScheduleComplete && !isLoading) {
              e.currentTarget.style.backgroundColor = "#0056b3";
              e.currentTarget.style.transform = "translateY(-2px)";
            }
          }}
          onMouseLeave={(e) => {
            if (isScheduleComplete && !isLoading) {
              e.currentTarget.style.backgroundColor = "#007cba";
              e.currentTarget.style.transform = "translateY(0)";
            }
          }}
        >
          {isLoading
            ? translations.loading || "Loading..."
            : `${translations.pay_to_book || "Pay to book"} €${priceInEuros}`}
        </button>
      )}

      {!isScheduleComplete && (
        <p
          style={{
            marginTop: "12px",
            color: "#666",
            fontSize: "14px",
            textAlign: "center",
          }}
        >
          {translations.select_time_to_continue ||
            "Please select a time slot to continue"}
        </p>
      )}
    </div>
  );
};
