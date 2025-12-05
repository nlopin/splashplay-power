import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { type FC } from "react";
import { PUBLIC_STRIPE_PUBLISHABLE_KEY } from "astro:env/client";

import { useTranslator } from "@/components/TranslatorContext";

const stripePromise = loadStripe(PUBLIC_STRIPE_PUBLISHABLE_KEY);

interface StripeCheckoutWrapperProps {
  clientSecret: string | null;
  isLoading: boolean;
}

export const StripeCheckoutWrapper: FC<StripeCheckoutWrapperProps> = ({
  clientSecret,
  isLoading,
}) => {
  const t = useTranslator();

  if (isLoading || !clientSecret) {
    return (
      <div className="stripe-loading-container">
        <div className="stripe-loading-text">{t("loading")}</div>
        <div className="stripe-loading-spinner" />
      </div>
    );
  }

  return (
    <div className="checkout-wrapper">
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{
          clientSecret,
        }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
};
