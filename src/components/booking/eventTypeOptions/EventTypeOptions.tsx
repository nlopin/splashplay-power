import type { Ref } from "react";

import type { EventType, PricingData } from "../types";

import { CouplesOptions } from "./CouplesOptions";
import { FamilyOptions } from "./FamilyOptions";
import { FriendsOptions } from "./FriendsOptions";
import { IndividualOptions } from "./IndividualOptions";
import { OpenSessionOptions } from "./OpenSessionOptions";
import type { OptionsHandle } from "./formState";

export type EventTypeOptionsProps = {
  eventType: EventType;
  onChange: (data: PricingData) => void;
  showPrice?: boolean;
  discount?: number;
  spotsLeft?: number;
  // For WebMCP's set_booking_options. Individual sessions have no handle.
  ref?: Ref<OptionsHandle>;
};

export function EventTypeOptions(props: EventTypeOptionsProps) {
  switch (props.eventType) {
    case "family":
      return <FamilyOptions {...props} />;
    case "friends":
      return <FriendsOptions {...props} />;
    case "individual":
      return <IndividualOptions {...props} />;
    case "open_session":
      return <OpenSessionOptions {...props} />;
    case "couples":
    default:
      return <CouplesOptions {...props} />;
  }
}
