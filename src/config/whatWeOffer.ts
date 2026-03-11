import type { Language } from "../utils/i18n";
import { getLocalizedPath } from "../utils/i18n";
import { isActivityHidden, type ActivityId } from "./activities";

export type WhatWeOfferVariant =
  | "home"
  | "friends"
  | "family"
  | "couples"
  | "corporate";

export type ImageKey = "activity1" | "gallery4" | "activity3" | "gallery1";

export interface BookingRow {
  audienceKey: string;
  pageHref: string;
  href: string;
  ctaKey: string;
}

export interface ActivityConfig {
  id: ActivityId;
  titleKey: string;
  descriptionKey: string;
  detailsKey: string;
  includedKey: string;
  imageKey: ImageKey;
  imageAlt: string;
  /** Home: table rows for each audience */
  bookingRows?: BookingRow[];
  /** Friends/Family/Couples: single book URL for this activity */
  bookUrl?: string;
  /** Corporate: use corporate namespace for this activity */
  corporateOnly?: boolean;
}

export interface VariantConfig {
  localeNamespace: string;
  /** For section title; corporate uses "friends" */
  sectionTitleNamespace: string;
  /** For intro; corporate uses "corporate" */
  introNamespace: string;
  /** For included_title label; home uses "home", corporate uses "friends" */
  includedTitleNamespace: string;
  /** Namespace for activity details (activity_*_details); corporate has its own */
  detailsNamespace: string;
  /** Home uses "home" for activity content, corporate mixes */
  activityContentNamespace: string;
  bookingMode: "table" | "single-cta" | "contact";
  showHowItWorks?: boolean;
  ctaKey?: string;
  activities: ActivityConfig[];
}

function buildHomeBookingRows(lang: Language): {
  activity1: BookingRow[];
  activity2: BookingRow[];
  activity3: BookingRow[];
} {
  return {
    activity1: [
      { audienceKey: "booking_for_couples", pageHref: getLocalizedPath("/couples", lang), href: getLocalizedPath("/book/couples", lang), ctaKey: "booking_cta_book" },
      { audienceKey: "booking_for_friends", pageHref: getLocalizedPath("/friends", lang), href: getLocalizedPath("/book/friends", lang), ctaKey: "booking_cta_book" },
      { audienceKey: "booking_for_families", pageHref: getLocalizedPath("/family", lang), href: getLocalizedPath("/book/family", lang), ctaKey: "booking_cta_book" },
      { audienceKey: "booking_for_teams", pageHref: getLocalizedPath("/corporate", lang), href: "#contact", ctaKey: "booking_cta_contact" },
    ],
    activity2: [
      { audienceKey: "booking_for_couples", pageHref: getLocalizedPath("/couples", lang), href: getLocalizedPath("/book/throw-paint", lang), ctaKey: "booking_cta_book" },
      { audienceKey: "booking_for_friends", pageHref: getLocalizedPath("/friends", lang), href: getLocalizedPath("/book/throw-paint", lang), ctaKey: "booking_cta_book" },
      { audienceKey: "booking_for_families", pageHref: getLocalizedPath("/family", lang), href: getLocalizedPath("/book/throw-paint", lang), ctaKey: "booking_cta_book" },
      { audienceKey: "booking_for_teams", pageHref: getLocalizedPath("/corporate", lang), href: "#contact", ctaKey: "booking_cta_contact" },
    ],
    activity3: [
      { audienceKey: "booking_for_couples", pageHref: getLocalizedPath("/couples", lang), href: getLocalizedPath("/book/customize-clothes", lang), ctaKey: "booking_cta_book" },
      { audienceKey: "booking_for_friends", pageHref: getLocalizedPath("/friends", lang), href: getLocalizedPath("/book/customize-clothes", lang), ctaKey: "booking_cta_book" },
      { audienceKey: "booking_for_families", pageHref: getLocalizedPath("/family", lang), href: getLocalizedPath("/book/customize-clothes", lang), ctaKey: "booking_cta_book" },
      { audienceKey: "booking_for_teams", pageHref: getLocalizedPath("/corporate", lang), href: "#contact", ctaKey: "booking_cta_contact" },
    ],
  };
}

export function getWhatWeOfferConfig(
  variant: WhatWeOfferVariant,
  lang: Language,
): VariantConfig {
  const bookCouples = getLocalizedPath("/book/couples", lang);
  const bookFriends = getLocalizedPath("/book/friends", lang);
  const bookFamily = getLocalizedPath("/book/family", lang);
  const bookThrowPaint = getLocalizedPath("/book/throw-paint", lang);
  const bookCustomizeClothes = getLocalizedPath("/book/customize-clothes", lang);

  const baseActivity1: Omit<ActivityConfig, "imageKey" | "imageAlt" | "bookingRows" | "bookUrl"> = {
    id: "abstract_masterpiece",
    titleKey: "activity_1_title",
    descriptionKey: "activity_1_description",
    detailsKey: "activity_1_details",
    includedKey: "activity_1_included",
  };
  const baseActivity2: typeof baseActivity1 = {
    id: "throw_paint",
    titleKey: "activity_2_title",
    descriptionKey: "activity_2_description",
    detailsKey: "activity_2_details",
    includedKey: "activity_2_included",
  };
  const baseActivity3: typeof baseActivity1 = {
    id: "customize_clothes",
    titleKey: "activity_3_title",
    descriptionKey: "activity_3_description",
    detailsKey: "activity_3_details",
    includedKey: "activity_3_included",
  };

  const standardActivity1 = {
    ...baseActivity1,
    imageKey: "activity1" as ImageKey,
    imageAlt: "Abstract painting with pouring and spinning techniques",
  };
  const standardActivity2 = {
    ...baseActivity2,
    imageKey: "gallery4" as ImageKey,
    imageAlt: "Throwing paint and playful painting techniques",
  };
  const standardActivity3 = {
    ...baseActivity3,
    imageKey: "activity3" as ImageKey,
    imageAlt: "Customizing clothes with abstract painting",
  };

  if (variant === "home") {
    const rows = buildHomeBookingRows(lang);
    return {
      localeNamespace: "home",
      sectionTitleNamespace: "home",
      introNamespace: "home",
      includedTitleNamespace: "home",
      detailsNamespace: "home",
      activityContentNamespace: "home",
      bookingMode: "table",
      activities: [
        {
          ...standardActivity1,
          detailsKey: "activity_1_details",
          bookingRows: rows.activity1,
        },
        {
          ...standardActivity2,
          detailsKey: "activity_2_details",
          bookingRows: rows.activity2,
        },
        {
          ...standardActivity3,
          detailsKey: "activity_3_details",
          bookingRows: rows.activity3,
        },
      ].filter((a) => !isActivityHidden(a.id)),
    };
  }

  if (variant === "friends") {
    return {
      localeNamespace: "friends",
      sectionTitleNamespace: "friends",
      introNamespace: "friends",
      includedTitleNamespace: "friends",
      detailsNamespace: "friends",
      activityContentNamespace: "home",
      bookingMode: "single-cta",
      ctaKey: "cta_book",
      activities: [
        { ...standardActivity1, detailsKey: "activity_1_details", bookUrl: bookFriends },
        { ...standardActivity2, detailsKey: "activity_2_details", bookUrl: bookThrowPaint },
        { ...standardActivity3, detailsKey: "activity_3_details", bookUrl: bookCustomizeClothes },
      ].filter((a) => !isActivityHidden(a.id)),
    };
  }

  if (variant === "family") {
    return {
      localeNamespace: "family",
      sectionTitleNamespace: "family",
      introNamespace: "family",
      includedTitleNamespace: "family",
      detailsNamespace: "family",
      activityContentNamespace: "home",
      bookingMode: "single-cta",
      ctaKey: "cta_book",
      activities: [
        { ...standardActivity1, detailsKey: "activity_1_details_family", bookUrl: bookFamily },
        { ...standardActivity2, detailsKey: "activity_2_details_family", bookUrl: bookThrowPaint },
        { ...standardActivity3, detailsKey: "activity_3_details_family", bookUrl: bookCustomizeClothes },
      ].filter((a) => !isActivityHidden(a.id)),
    };
  }

  if (variant === "couples") {
    const bookCouplesUrl = bookCouples;
    return {
      localeNamespace: "couples",
      sectionTitleNamespace: "couples",
      introNamespace: "couples",
      includedTitleNamespace: "couples",
      detailsNamespace: "couples",
      activityContentNamespace: "home",
      bookingMode: "single-cta",
      ctaKey: "cta_book",
      activities: [
        { ...standardActivity1, detailsKey: "activity_1_details_couples", bookUrl: bookCouplesUrl },
        { ...standardActivity2, detailsKey: "activity_2_details_couples", bookUrl: bookCouplesUrl },
        { ...standardActivity3, detailsKey: "activity_3_details_couples", bookUrl: bookCustomizeClothes },
      ].filter((a) => !isActivityHidden(a.id)),
    };
  }

  // corporate
  const teambuildingActivity: ActivityConfig = {
    id: "teambuilding",
    titleKey: "activity_teambuilding_title",
    descriptionKey: "activity_teambuilding_description",
    detailsKey: "activity_teambuilding_details",
    includedKey: "activity_teambuilding_included",
    imageKey: "gallery1",
    imageAlt: "Team building painting session",
    corporateOnly: true,
  };

  return {
    localeNamespace: "corporate",
    sectionTitleNamespace: "friends",
    introNamespace: "corporate",
    includedTitleNamespace: "friends",
    detailsNamespace: "corporate",
    activityContentNamespace: "home",
    bookingMode: "contact",
    showHowItWorks: true,
    ctaKey: "cta_book",
    activities: [
      teambuildingActivity,
      { ...standardActivity1, detailsKey: "activity_1_details" },
      { ...standardActivity2, detailsKey: "activity_2_details" },
      { ...standardActivity3, detailsKey: "activity_3_details" },
    ].filter((a) => !isActivityHidden(a.id)),
  };
}
