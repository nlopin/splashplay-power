import { useTranslator } from "@/components/TranslatorContext";
import type { EventType } from "./types";

interface EventTypeSelectorProps {
  currentEventType: EventType;
}

const EVENT_TYPE_OPTIONS: ReadonlyArray<{
  value: EventType;
  labelKey: string;
  descriptionKey: string;
  duration: number;
}> = [
  {
    value: "couples",
    labelKey: "creative_date",
    descriptionKey: "event_type_couples_desc",
    duration: 1.5,
  },
  {
    value: "family",
    labelKey: "family_session",
    descriptionKey: "event_type_family_desc",
    duration: 1.5,
  },
  {
    value: "friends",
    labelKey: "friends_session",
    descriptionKey: "event_type_friends_desc",
    duration: 2,
  },
  {
    value: "individual",
    labelKey: "individual_session",
    descriptionKey: "event_type_individual_desc",
    duration: 1.5,
  },
];

export function EventTypeSelector({
  currentEventType,
}: EventTypeSelectorProps) {
  const t = useTranslator();

  const currentOption = EVENT_TYPE_OPTIONS.find(
    (option) => option.value === currentEventType,
  );

  // Get other options (excluding the current one)
  const otherOptions = EVENT_TYPE_OPTIONS.filter(
    (option) => option.value !== currentEventType,
  );

  const handleEventTypeChange = (eventType: EventType) => {
    // Navigate to the appropriate route
    const currentPath = window.location.pathname;
    const pathParts = currentPath.split("/");
    pathParts[pathParts.length - 1] = eventType;
    window.location.href = pathParts.join("/");
  };

  const formatDuration = (hours: number) => {
    if (hours === 1) {
      return t("duration_hour").replace("{hours}", hours.toString());
    }
    return t("duration_hours").replace("{hours}", hours.toString());
  };

  if (!currentOption) {
    return null;
  }

  return (
    <div>
      <button
        className="event-type-trigger"
        popoverTarget="event-type-popover"
        aria-haspopup="true"
        type="button"
      >
        <h1 className="current-selection">{t(currentOption.labelKey)}</h1>
        <span className="dropdown-arrow">▼</span>
      </button>
      <p>⏰ {formatDuration(currentOption.duration)}</p>

      <div
        id="event-type-popover"
        popover="auto"
        className="event-type-popover"
      >
        <div className="popover-options">
          {otherOptions.map((option) => (
            <a
              key={option.value}
              href="#"
              className="event-type-option"
              onClick={(e) => {
                e.preventDefault();
                handleEventTypeChange(option.value);
              }}
            >
              <span className="option-label">{t(option.labelKey)}</span>
              <span className="option-description">
                {t(option.descriptionKey)}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
