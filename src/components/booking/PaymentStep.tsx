import type { FC } from "react";
import { BookingSummary } from "./BookingSummary";
import { StripeCheckoutWrapper } from "./StripeCheckoutWrapper";
import type { ISODatetime } from "@/types";

type SelectedTimeSlot = ISODatetime;

interface PaymentStepProps {
  selectedTimeSlot: SelectedTimeSlot;
  currentAmount: number;
  currentProductName: string;
  clientSecret: string | null;
  isLoading: boolean;
  onEditSelections: () => void;
  translations: any;
}

export const PaymentStep: FC<PaymentStepProps> = ({
  selectedTimeSlot,
  currentAmount,
  currentProductName,
  clientSecret,
  isLoading,
  onEditSelections,
  translations,
}) => {
  return (
    <div
      className="payment-step"
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "20px",
      }}
    >
      <BookingSummary
        selectedTimeSlot={selectedTimeSlot}
        currentAmount={currentAmount}
        currentProductName={currentProductName}
        mode="confirmation"
        showEditButton={true}
        onEdit={onEditSelections}
        translations={translations}
      />

      <div style={{ marginTop: "32px" }}>
        <StripeCheckoutWrapper
          clientSecret={clientSecret}
          isLoading={isLoading}
          translations={translations}
        />
      </div>
    </div>
  );
};
