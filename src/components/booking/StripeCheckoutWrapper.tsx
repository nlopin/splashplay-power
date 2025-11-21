import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { useState, type FC } from "react";
import { PUBLIC_STRIPE_PUBLISHABLE_KEY } from "astro:env/client";

const stripePromise = loadStripe(PUBLIC_STRIPE_PUBLISHABLE_KEY);

interface StripeCheckoutWrapperProps {
  clientSecret: string | null;
  isLoading: boolean;
  translations: any;
}

export const StripeCheckoutWrapper: FC<StripeCheckoutWrapperProps> = ({
  clientSecret,
  isLoading,
  translations,
}) => {
  if (isLoading || !clientSecret) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "48px",
          backgroundColor: "#f8f9fa",
          borderRadius: "12px",
        }}
      >
        <div
          style={{
            fontSize: "18px",
            color: "#666",
            marginBottom: "16px",
          }}
        >
          {translations.loading || "Loading payment form..."}
        </div>
        <div
          style={{
            width: "40px",
            height: "40px",
            border: "4px solid #e9ecef",
            borderTop: "4px solid #007cba",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto",
          }}
        />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      className="checkout-wrapper"
      style={{
        backgroundColor: "white",
        padding: "24px",
        borderRadius: "12px",
        border: "1px solid #e9ecef",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
      }}
    >
      <h3
        style={{
          textAlign: "center",
          marginBottom: "24px",
          color: "#333",
          fontSize: "1.5rem",
        }}
      >
        {translations.payment_header || "Complete Your Payment"}
      </h3>

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
