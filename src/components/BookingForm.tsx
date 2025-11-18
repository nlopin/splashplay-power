import { loadStripe } from "@stripe/stripe-js";
import {
  CheckoutProvider,
  PaymentElement,
  useCheckout,
} from "@stripe/react-stripe-js/checkout";
import {
  useState,
  useMemo,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
} from "react";
import AvailabilityCalendar from "./AvailabilityCalendar";
import CouplesOptions from "./checkout/CouplesOptions";
import type { createAstroTranslator } from "../utils/i18n";

const stripePromise = loadStripe(
  "pk_test_51Qyruz4egtrwKqHbiNj9GZWNMlws7RNZDLFBMCIHdACP2vgcEnFIZOLOzFqXIf7iKVBeX14WrmxHun1dMIuA67ic00PavaO1vu",
);

import { TranslatorProvider } from "./TranslatorContext";

export default function BookingForm({
  translations,
}: {
  translations: Record<string, string>;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/payment-session", {
      method: "POST",
    })
      .then((res) => res.json())
      .then((data) => {
        setClientSecret(data.clientSecret);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load payment session");
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error || !clientSecret) {
    return <div>Error: {error || "Could not initialize payment"}</div>;
  }

  return (
    <TranslatorProvider translations={translations}>
      <AvailabilityCalendar />
      <CouplesOptions />
      <CheckoutProvider
        stripe={stripePromise}
        options={{
          clientSecret,
          elementsOptions: {
            appearance: {
              theme: "stripe",
            },
          },
        }}
      >
        <CheckoutForm />
      </CheckoutProvider>
    </TranslatorProvider>
  );
}

const validateEmail = async (email, checkout) => {
  const updateResult = await checkout.updateEmail(email);
  const isValid = updateResult.type !== "error";

  return { isValid, message: !isValid ? updateResult.error.message : null };
};

const EmailInput = ({ email, setEmail, error, setError }) => {
  const checkoutState = useCheckout();
  if (checkoutState.type === "loading") {
    return <div>Loading...</div>;
  } else if (checkoutState.type === "error") {
    return <div>Error: {checkoutState.error.message}</div>;
  }
  const { checkout } = checkoutState;

  const handleBlur = async () => {
    if (!email) {
      return;
    }

    const { isValid, message } = await validateEmail(email, checkout);
    if (!isValid) {
      setError(message);
    }
  };

  const handleChange = (e) => {
    setError(null);
    setEmail(e.target.value);
  };

  return (
    <>
      <label>
        Email
        <input
          id="email"
          type="text"
          value={email}
          onChange={handleChange}
          onBlur={handleBlur}
          className={error ? "error" : ""}
        />
      </label>
      {error && <div id="email-errors">{error}</div>}
    </>
  );
};

const CheckoutForm = () => {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState(null);
  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkoutState = useCheckout();
  if (checkoutState.type === "error") {
    return <div>Error: {checkoutState.error.message}</div>;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { checkout } = checkoutState;
    setIsLoading(true);

    // const { isValid, message } = await validateEmail(email, checkout);
    // if (!isValid) {
    // setEmailError(message);
    // setMessage(message);
    // setIsLoading(false);
    // return;
    // }

    const confirmResult = await checkout.confirm();

    // This point will only be reached if there is an immediate error when
    // confirming the payment. Otherwise, your customer will be redirected to
    // your `return_url`. For some payment methods like iDEAL, your customer will
    // be redirected to an intermediate site first to authorize the payment, then
    // redirected to the `return_url`.
    if (confirmResult.type === "error") {
      setMessage(confirmResult.error.message);
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/*<EmailInput
        email={email}
        setEmail={setEmail}
        error={emailError}
        setError={setEmailError}
      />*/}
      <h4>Payment</h4>
      <PaymentElement id="payment-element" />
      <button disabled={isLoading} id="submit">
        {isLoading || checkoutState.type === "loading" ? (
          <div className="spinner">Thinking</div>
        ) : (
          `Pay ${checkoutState.checkout.total.total.amount} now`
        )}
      </button>
      {/* Show any error or success messages */}
      {message && <div id="payment-message">{message}</div>}
    </form>
  );
};
