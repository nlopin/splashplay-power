import { useTranslator } from "@/components/TranslatorContext";
import type { EventType } from "./types";

interface EventTypeSelectorProps {
  currentEventType: EventType;
}

const EVENT_TYPE_OPTIONS: ReadonlyArray<{
  value: EventType;
  labelKey: string;
  descriptionKey: string;
}> = [
  {
    value: "couples",
    labelKey: "event_type_couples",
    descriptionKey: "event_type_couples_desc",
  },
  {
    value: "family",
    labelKey: "event_type_family",
    descriptionKey: "event_type_family_desc",
  },
  {
    value: "friends",
    labelKey: "event_type_friends",
    descriptionKey: "event_type_friends_desc",
  },
  {
    value: "individual",
    labelKey: "event_type_individual",
    descriptionKey: "event_type_individual_desc",
  },
];

export function EventTypeSelector({
  currentEventType,
}: EventTypeSelectorProps) {
  const t = useTranslator();

  const handleEventTypeChange = (eventType: EventType) => {
    if (eventType !== currentEventType) {
      // Navigate to the appropriate route
      const currentPath = window.location.pathname;
      const pathParts = currentPath.split("/");

      pathParts[pathParts.length - 1] = eventType;
      window.location.href = pathParts.join("/");
    }
  };

  return (
    <div className="event-type-selector">
      <h3>{t("select_event_type")}</h3>
      <div className="event-type-grid">
        {EVENT_TYPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            className={`event-type-card ${
              currentEventType === option.value ? "selected" : ""
            }`}
            onClick={() => handleEventTypeChange(option.value)}
          >
            <div className="event-type-content">
              <div className="event-type-label">{t(option.labelKey)}</div>
              <div className="event-type-description">
                {t(option.descriptionKey)}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
