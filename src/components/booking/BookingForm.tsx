import { useState, useRef, useEffect } from "react";

import { TranslatorProvider } from "@/components/TranslatorContext";
import { CreatePaymentSessionResponseSchema } from "@/pages/api/types";
import {
  formatBookingProductName,
  ProductNameKeyByEventType,
} from "@/services/catalog/productName";
import { isServer } from "@/utils/environment";
import { trackEvent, AnalyticsEvents } from "@/services/analytics";
import type { ISODatetime } from "@/types";

import { PaymentStep } from "./PaymentStep";
import { ScheduleStep, type ScheduleStepProps } from "./ScheduleStep";
import type { SelectedTimeSlot, EventType, Availability } from "./types";

type Step = "schedule" | "payment";

const PARTNER_SESSION_STORAGE_KEY = "splashplay:partner";

function getInitialPartnerKey(): string | undefined {
  if (isServer()) return undefined;

  const fromQuery = new URLSearchParams(window.location.search).get("partner");
  if (fromQuery) return fromQuery;

  try {
    return sessionStorage.getItem(PARTNER_SESSION_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export default function BookingForm({
  translations,
  availability,
  lang,
  eventType,
}: {
  translations: Record<string, any>;
  availability: Availability;
  lang: string;
  eventType: EventType;
}) {
  // Step management
  const [currentStep, setCurrentStep] = useState<Step>("schedule");

  // Selection state (kept in memory)
  const [selectedTimeSlot, setSelectedTimeSlot] =
    useState<SelectedTimeSlot | null>(null);
  const [currentAmount, setCurrentAmount] = useState<number | null>(null);
  const [currentProductName, setCurrentProductName] = useState<string | null>(
    null,
  );
  const [currentGuests, setCurrentGuests] = useState<number | null>(null);

  // Payment state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ?partner=<key>, else sessionStorage fallback on reload
  const [partnerKey] = useState<string | undefined>(getInitialPartnerKey);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Track ScheduleStepOpened on initial mount
  useEffect(() => {
    trackEvent(AnalyticsEvents.ScheduleStepOpened);
  }, []);

  useEffect(() => {
    if (!partnerKey) return;
    try {
      sessionStorage.setItem(PARTNER_SESSION_STORAGE_KEY, partnerKey);
    } catch {}
  }, [partnerKey]);

  // Unified URL state management and validation
  useEffect(() => {
    if (isServer()) return;

    // Validate payment step access - redirect if no selection
    if (shouldRedirectToSchedule(currentStep, selectedTimeSlot)) {
      redirectToSchedule();
      setCurrentStep("schedule");
      return; // Don't continue with URL updates if we're redirecting
    }

    // Handle browser back/forward navigation
    const handlePopState = () => {
      const urlStep = getCurrentStepFromURL();

      // If trying to go to payment without selections, redirect to schedule
      if (shouldRedirectToSchedule(urlStep, selectedTimeSlot)) {
        redirectToSchedule();
        setCurrentStep("schedule");
        return;
      }

      // Clear payment state when navigating back to schedule
      if (urlStep === "schedule" && currentStep === "payment") {
        setClientSecret(null);
        setError(null);
        setIsLoading(false);

        // Abort any pending session creation
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      }

      // Only update step if it's different to avoid infinite loops
      if (urlStep !== currentStep) {
        setCurrentStep(urlStep);
      }
    };

    // Update URL when step changes internally
    updateURLForStep(currentStep);

    // Listen for browser navigation
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [currentStep, selectedTimeSlot]);

  const createSession = async ({
    amount,
    formattedProductName,
    eventType,
    datetime,
    guests,
  }: {
    amount: number;
    formattedProductName: string;
    eventType: EventType;
    datetime: ISODatetime;
    guests: number;
  }) => {
    setError(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/payment-session", {
        method: "POST",
        body: JSON.stringify({
          amount,
          productName: formattedProductName,
          eventType,
          datetime,
          lang,
          partner: partnerKey,
          guests,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const responseData = await res.json();
      const parseResult =
        CreatePaymentSessionResponseSchema.safeParse(responseData);
      if (!parseResult.success) {
        throw new Error(translations.error_invalid_response, {
          cause: parseResult.error,
        });
      }

      setClientSecret(parseResult.data.clientSecret);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        console.log("Request aborted");
        return;
      }
      console.error(err);
      setError(translations.error_load);
    }
  };

  const handlePriceChange: ScheduleStepProps["onPriceChange"] = ({
    amount,
    productName,
    guests,
  }) => {
    setCurrentAmount(amount);
    setCurrentProductName(productName);
    setCurrentGuests(guests);
  };

  const handleTimeSlotSelect: ScheduleStepProps["onTimeSlotSelect"] = (
    slot,
  ) => {
    setSelectedTimeSlot(slot);
    if (slot) {
      trackEvent(AnalyticsEvents.SessionDateSelected, {
        sessionDate: slot,
        eventType,
      });
    }
  };

  const handlePayToBook: ScheduleStepProps["onPayToBook"] = async () => {
    if (
      !selectedTimeSlot ||
      !currentAmount ||
      !currentProductName ||
      !currentGuests
    )
      return;

    const formattedProductName = formatBookingProductName(
      translations[ProductNameKeyByEventType[eventType]],
      selectedTimeSlot,
      currentProductName,
      lang,
    );

    const slotDiscount = availability.find(
      (a) => a.time === selectedTimeSlot,
    )?.discount;
    const amount = slotDiscount
      ? Math.round(currentAmount * (1 - slotDiscount / 100))
      : currentAmount;

    setIsLoading(true);
    try {
      await createSession({
        amount,
        formattedProductName,
        eventType,
        datetime: selectedTimeSlot,
        guests: currentGuests,
      });
      // Navigate to payment step - URL will be updated by useEffect
      setCurrentStep("payment");
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditSelections = () => {
    // Clear payment state when going back to schedule
    setClientSecret(null);
    setError(null);
    setIsLoading(false);

    // Abort any pending session creation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setCurrentStep("schedule");
  };

  if (error) {
    return <div>Error: {error || translations.error_init}</div>;
  }

  return (
    <TranslatorProvider translations={translations} language={lang}>
      {currentStep === "schedule" ? (
        <ScheduleStep
          availability={availability}
          selectedTimeSlot={selectedTimeSlot}
          currentAmount={currentAmount}
          isLoading={isLoading}
          eventType={eventType}
          onTimeSlotSelect={handleTimeSlotSelect}
          onPriceChange={handlePriceChange}
          onPayToBook={handlePayToBook}
        />
      ) : (
        <PaymentStep
          clientSecret={clientSecret}
          isLoading={isLoading}
          onEditSelections={handleEditSelections}
        />
      )}
    </TranslatorProvider>
  );
}

function getCurrentStepFromURL(): Step {
  if (isServer()) return "schedule";

  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("step") === "payment" ? "payment" : "schedule";
}

function updateURLForStep(step: Step): void {
  if (isServer()) return;

  const url = new URL(window.location.href);
  if (step === "schedule") {
    url.searchParams.delete("step");
  } else {
    url.searchParams.set("step", "payment");
  }

  const newUrl = url.pathname + (url.search ? url.search : "");
  window.history.pushState({}, "", newUrl);
}

function redirectToSchedule(): void {
  if (isServer()) return;

  const url = new URL(window.location.href);
  url.searchParams.delete("step");
  window.history.replaceState({}, "", url.pathname);
}

function shouldRedirectToSchedule(
  step: Step,
  selectedTimeSlot: SelectedTimeSlot | null,
): boolean {
  return step === "payment" && !selectedTimeSlot;
}

