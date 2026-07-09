export type OptCell = { labelKey: string; priceKey: string } | null;

// Rows the discount badge spans
export const DISCOUNT_BADGE_ROW_SPAN = 2;

export interface PricingRow {
  cells: OptCell[];
   // Column index, the first empty cell will hosts the discount badge
  discountBadgeCol?: number;
}
