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

  return (
    <div>
      <button
        className="event-type-trigger"
        popoverTarget="event-type-popover"
        aria-haspopup="true"
        type="button"
      >
        <h1 className="current-selection">
          {currentOption && t(currentOption.labelKey)}
        </h1>
        <span className="dropdown-arrow">▼</span>
      </button>

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
