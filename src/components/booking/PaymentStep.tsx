import { useEffect, type FC } from "react";

import { StripeCheckoutWrapper } from "./StripeCheckoutWrapper";
import { useTranslator } from "@/components/TranslatorContext";
import { AnalyticsEvents, trackEvent } from "@/services/analytics";

interface PaymentStepProps {
  clientSecret: string | null;
  isLoading: boolean;
  onEditSelections: () => void;
}

export const PaymentStep: FC<PaymentStepProps> = ({
  clientSecret,
  isLoading,
  onEditSelections,
}) => {
  const t = useTranslator();

  useEffect(() => {
    trackEvent(AnalyticsEvents.PaymentPageOpened);
  }, []);

  return (
    <div className="payment-step">
      <h2>{t("complete_booking")}</h2>

      <button className="change-selection-link" onClick={onEditSelections}>
        ← {t("edit_selections")}
      </button>

      <StripeCheckoutWrapper
        clientSecret={clientSecret}
        isLoading={isLoading}
      />
    </div>
  );
};
