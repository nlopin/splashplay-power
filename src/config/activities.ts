/**
 * Activity IDs to hide from Packages and Prices sections.
 * Set to [] to show all activities. Use ['activity_2'] to hide Throw Paint.
 */
export const HIDDEN_ACTIVITY_IDS = ["activity_2"] as const;

export function isActivityHidden(activityId: string): boolean {
  return (HIDDEN_ACTIVITY_IDS as readonly string[]).includes(activityId);
}
