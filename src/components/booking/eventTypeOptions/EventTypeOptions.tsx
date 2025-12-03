import type { EventType, PricingData } from "../types";

import { CouplesOptions } from "./CouplesOptions";
import { FamilyOptions } from "./FamilyOptions";
import { FriendsOptions } from "./FriendsOptions";
import { IndividualOptions } from "./IndividualOptions";

export type EventTypeOptionsProps = {
  eventType: EventType;
  onChange: (data: PricingData) => void;
};

export function EventTypeOptions(props: EventTypeOptionsProps) {
  switch (props.eventType) {
    case "family":
      return <FamilyOptions {...props} />;
    case "friends":
      return <FriendsOptions {...props} />;
    case "individual":
      return <IndividualOptions {...props} />;
    case "couples":
    default:
      return <CouplesOptions {...props} />;
  }
}
