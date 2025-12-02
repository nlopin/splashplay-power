import type { EventType, PricingData } from "../types";

import { CouplesOptions } from "./CouplesOptions";
import { FamilyOptions } from "./FamilyOptions";

export type EventTypeOptionsProps = {
  eventType: EventType;
  onChange: (data: PricingData) => void;
};

export function EventTypeOptions(props: EventTypeOptionsProps) {
  switch (props.eventType) {
    case "family":
      return <FamilyOptions {...props} />;
    case "friends":
      // TODO: Implement FriendsOptions
      return <div>Friends options coming soon...</div>;
    case "individual":
      // TODO: Implement IndividualOptions
      return <div>Individual options coming soon...</div>;
    case "couples":
    default:
      return <CouplesOptions {...props} />;
  }
}
