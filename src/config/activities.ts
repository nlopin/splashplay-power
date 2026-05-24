export type ActivityId =
  | "abstract_masterpiece"
  | "throw_paint"
  | "customize_clothes"
  | "teambuilding";

/**
 * Activity IDs to hide from Packages and Prices sections.
 * Set to [] to show all activities.
 */
export const HIDDEN_ACTIVITY_IDS: ActivityId[] = [
  "throw_paint",
  "customize_clothes",
];

export function isActivityHidden(activityId: ActivityId): boolean {
  return HIDDEN_ACTIVITY_IDS.includes(activityId);
}
