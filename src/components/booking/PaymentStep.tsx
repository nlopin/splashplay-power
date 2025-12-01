import type { FC } from "react";

import { StripeCheckoutWrapper } from "./StripeCheckoutWrapper";
import type { SelectedTimeSlot } from "./types";
import { BookingSummary } from "./BookingSummary";

interface PaymentStepProps {
  selectedTimeSlot: SelectedTimeSlot;
  currentAmount: number;
  currentProductName: string;
  clientSecret: string | null;
  isLoading: boolean;
  onEditSelections: () => void;
}

export const PaymentStep: FC<PaymentStepProps> = ({
  selectedTimeSlot,
  currentAmount,
  currentProductName,
  clientSecret,
  isLoading,
  onEditSelections,
}) => {
  return (
    <div className="payment-step">
      <div className="payment-layout">
        <div className="summary-column">
          <BookingSummary
            selectedTimeSlot={selectedTimeSlot}
            currentAmount={currentAmount}
            currentProductName={currentProductName}
            onEdit={onEditSelections}
          />
        </div>

        <div className="payment-column">
          <StripeCheckoutWrapper
            clientSecret={clientSecret}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
};
