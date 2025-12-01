import { useState, useRef, useEffect } from "react";

import { TranslatorProvider } from "@/components/TranslatorContext";
import { CreatePaymentSessionResponseSchema } from "@/pages/api/types";

import { PaymentStep } from "./PaymentStep";
import { ScheduleStep, type ScheduleStepProps } from "./ScheduleStep";
import type { SelectedTimeSlot } from "./types";

type Availability = {
  inviteesRemaining: number;
  schedulingUrl: string;
  startTime: string;
  status: string;
};

type Step = "schedule" | "payment";

export default function BookingForm({
  translations,
  initialAvailability,
  lang,
}: {
  translations: any;
  initialAvailability: Availability[];
  lang: string;
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

  // Payment state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Unified URL state management and validation
  useEffect(() => {
    if (typeof window === "undefined") return;

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

  const createSession = async (amount: number, productName: string) => {
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
          productName,
          lang,
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
  }) => {
    setCurrentAmount(amount);
    setCurrentProductName(productName);
  };

  const handleTimeSlotSelect: ScheduleStepProps["onTimeSlotSelect"] = (
    slot,
  ) => {
    setSelectedTimeSlot(slot);
  };

  const handlePayToBook: ScheduleStepProps["onPayToBook"] = async () => {
    if (!selectedTimeSlot || !currentAmount || !currentProductName) return;

    setIsLoading(true);
    try {
      await createSession(currentAmount, currentProductName);
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
          initialAvailability={initialAvailability}
          selectedTimeSlot={selectedTimeSlot}
          isLoading={isLoading}
          onTimeSlotSelect={handleTimeSlotSelect}
          onPriceChange={handlePriceChange}
          onPayToBook={handlePayToBook}
        />
      ) : (
        <PaymentStep
          selectedTimeSlot={selectedTimeSlot!}
          currentAmount={currentAmount!}
          currentProductName={currentProductName!}
          clientSecret={clientSecret}
          isLoading={isLoading}
          onEditSelections={handleEditSelections}
          translations={translations}
        />
      )}
    </TranslatorProvider>
  );
}

function getCurrentStepFromURL(): Step {
  if (typeof window === "undefined") return "schedule";

  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("step") === "payment" ? "payment" : "schedule";
}

function updateURLForStep(step: Step): void {
  if (typeof window === "undefined") return;

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
  if (typeof window === "undefined") return;

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
