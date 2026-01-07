type BaseEvent = {
  timestamp: string;
  event: string;
};

type EventData = Record<string, unknown>;

/**
 * Creates a base event object with shared fields.
 */
export function createEvent<T extends EventData>(
  eventName: string,
  data: T,
): BaseEvent & T {
  return {
    timestamp: new Date().toISOString(),
    event: eventName,
    ...data,
  };
}

/**
 * Logs an existing event.
 */
export function logEvent(event: BaseEvent & EventData): void {
  console.log(JSON.stringify(event));
}

/**
 * Creates an event and logs it immediately.
 */
export function createAndLogEvent<T extends EventData>(
  eventName: string,
  data: T,
): BaseEvent & T {
  const event = createEvent(eventName, data);
  logEvent(event);
  return event;
}
