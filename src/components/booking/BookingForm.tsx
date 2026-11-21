import { useState, useRef, useEffect } from "react";

import { TranslatorProvider } from "@/components/TranslatorContext";
import { CreatePaymentSessionResponseSchema } from "@/pages/api/types";
import type { BookingSelection } from "@/services/catalog/bookingSelection";
import { findOpenSlotOnDate } from "@/services/catalog/themedOpenSessions";
import { isServer } from "@/utils/environment";
import { trackEvent, AnalyticsEvents } from "@/services/analytics";
import type { ISODatetime } from "@/types";
import { isWebMcpEventType } from "@/services/agentTools/eventTypes";
import { buildBookingTools, type PaymentResult } from "@/webmcp/bookingTools";
import { loadWebMcpData } from "@/webmcp/data";
import { useWebMcpTools } from "@/webmcp/useWebMcpTools";

import { PaymentStep } from "./PaymentStep";
import { ScheduleStep, type ScheduleStepProps } from "./ScheduleStep";
import type { OptionsHandle } from "./eventTypeOptions/formState";
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
  const [currentGuests, setCurrentGuests] = useState<number | null>(null);
  const [currentSelection, setCurrentSelection] =
    useState<BookingSelection | null>(null);

  // Payment state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // ?partner=<key>, else sessionStorage fallback on reload
  const [partnerKey] = useState<string | undefined>(getInitialPartnerKey);

  const abortControllerRef = useRef<AbortController | null>(null);
  // Options widget handle, used by the WebMCP set_booking_options tool.
  const optionsRef = useRef<OptionsHandle>(null);

  // Track ScheduleStepOpened on initial mount
  useEffect(() => {
    trackEvent(AnalyticsEvents.ScheduleStepOpened);
  }, []);

  // ?date=YYYY-MM-DD: an open session has one slot per day, so select it;
  // other experiences open the calendar on that week.
  const [focusTime, setFocusTime] = useState<SelectedTimeSlot | null>(null);
  useEffect(() => {
    if (selectedTimeSlot) return;
    const date = new URLSearchParams(window.location.search).get("date");
    if (!date) return;
    const slot = findOpenSlotOnDate(availability, date);
    if (!slot) return;
    if (eventType === "open_session") {
      setSelectedTimeSlot(slot.time);
    } else {
      setFocusTime(slot.time);
    }
  }, [availability, eventType, selectedTimeSlot]);

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
    selection,
    datetime,
  }: {
    selection: BookingSelection;
    datetime: ISODatetime;
  }): Promise<PaymentResult> => {
    setError(null);
    setBookingError(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/payment-session", {
        method: "POST",
        // Price, discount and product name are decided by the server.
        body: JSON.stringify({
          selection,
          datetime,
          lang,
          partner: partnerKey,
        }),
        signal: controller.signal,
      });

      if (res.status === 409) {
        setBookingError(translations.error_slot_full);
        return { ok: false, reason: "slot_full" };
      }

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
      return { ok: true, amountCents: parseResult.data.amountCents };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        console.log("Request aborted");
        return { ok: false, reason: "failed" };
      }
      console.error(err);
      setError(translations.error_load);
      return { ok: false, reason: "failed" };
    }
  };

  const handlePriceChange: ScheduleStepProps["onPriceChange"] = ({
    amount,
    guests,
    selection,
  }) => {
    setCurrentAmount(amount);
    setCurrentGuests(guests);
    setCurrentSelection(selection);
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

  const handlePayToBook = async (): Promise<PaymentResult> => {
    if (!selectedTimeSlot || !currentSelection) {
      return { ok: false, reason: "not_ready" };
    }

    setIsLoading(true);
    try {
      const result = await createSession({
        selection: currentSelection,
        datetime: selectedTimeSlot,
      });
      if (result.ok) {
        setCurrentStep("payment");
      }
      return result;
    } catch (error) {
      console.error(error);
      return { ok: false, reason: "failed" };
    } finally {
      setIsLoading(false);
    }
  };

  // WebMCP tools for browser agents, only on the schedule step (the payment
  // step is human-only). Individual sessions aren't exposed to agents.
  useWebMcpTools(
    currentStep === "schedule" && isWebMcpEventType(eventType)
      ? buildBookingTools({
          eventType,
          lang,
          availability,
          selectedTimeSlot,
          pricing:
            currentSelection && currentAmount != null && currentGuests != null
              ? {
                  amount: currentAmount,
                  guests: currentGuests,
                  selection: currentSelection,
                }
              : null,
          isLoading,
          now: () => new Date(),
          themeName: (slug) => translations[`theme_${slug}`],
          selectTimeSlot: handleTimeSlotSelect,
          applyOptions: (patch) => optionsRef.current?.apply(patch) ?? null,
          startPayment: handlePayToBook,
          loadData: loadWebMcpData,
        })
      : null,
  );

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
          focusTime={focusTime}
          currentAmount={currentAmount}
          currentGuests={currentGuests}
          isLoading={isLoading}
          eventType={eventType}
          bookingError={bookingError}
          onTimeSlotSelect={handleTimeSlotSelect}
          onPriceChange={handlePriceChange}
          onPayToBook={handlePayToBook}
          optionsRef={optionsRef}
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
  const next = url.pathname + (url.search ? url.search : "");
  window.history.replaceState({}, "", next);
}

function shouldRedirectToSchedule(
  step: Step,
  selectedTimeSlot: SelectedTimeSlot | null,
): boolean {
  return step === "payment" && !selectedTimeSlot;
}

