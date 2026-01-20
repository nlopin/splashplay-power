declare global {
  interface Window {
    amplitude?: {
      track: (
        eventName: string,
        eventProperties?: Record<string, unknown>,
      ) => void;
    };
  }
}

export const AnalyticsEvents = {
  BookButtonClicked: "BookButtonClicked",
  ScheduleStepOpened: "ScheduleStepOpened",
  SessionDateSelected: "SessionDateSelected",
  PaymentPageOpened: "PaymentPageOpened",
  BookingScheduled: "BookingScheduled",
} as const;

export type AnalyticsEvent =
  (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

export function trackEvent(
  eventName: AnalyticsEvent,
  properties?: Record<string, unknown>,
): void {
  if (typeof window !== "undefined" && window.amplitude) {
    window.amplitude.track(eventName, properties);
  }
}
