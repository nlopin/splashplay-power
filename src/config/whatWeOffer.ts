import type { Language, TranslationNamespace } from "../utils/i18n";
import { isActivityHidden, type ActivityId } from "./activities";

export type WhatWeOfferVariant =
  | "home"
  | "friends"
  | "family"
  | "couples"
  | "corporate";

export type ImageKey = "activity1" | "gallery4" | "activity3" | "gallery1";
export type FormatImageKey = "largeCanvas" | "twoCanvases" | "twoCanvasesPouring" | "sharedCanvas" | "sharedCanvasPouring";

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
  includedKey?: string;
  techniqueIds?: string[];
  formatCards?: {
    titleKey: string;
    descriptionKey: string;
    imageKey: FormatImageKey;
  }[];
  formatNoteKey?: string;
  imageKey: ImageKey;
  imageAlt: string;
  /** Home: table rows for each audience */
  bookingRows?: BookingRow[];
  /** Friends/Family/Couples: single book URL for this activity */
  bookUrl?: string;
  /** Corporate: use corporate namespace for this activity */
  corporateOnly?: boolean;
  /** Override variant detailsNamespace for this activity */
  detailsNamespace?: TranslationNamespace;
}

export interface VariantConfig {
  localeNamespace: TranslationNamespace;
  /** For section title; corporate uses "friends" */
  sectionTitleNamespace: TranslationNamespace;
  /** For intro; corporate uses "corporate" */
  introNamespace: TranslationNamespace;
  /** For included_title label; home uses "home", corporate uses "friends" */
  includedTitleNamespace: TranslationNamespace;
  /** Namespace for activity details (activity_*_details); corporate has its own */
  detailsNamespace: TranslationNamespace;
  /** Home uses "home" for activity content, corporate mixes */
  activityContentNamespace: TranslationNamespace;
  /** Optional namespace for format card copy; defaults to activityContentNamespace */
  formatContentNamespace?: TranslationNamespace;
  bookingMode: "none" | "table" | "single-cta" | "contact";
  showHowItWorks?: boolean;
  ctaKey?: string;
  activities: ActivityConfig[];
}

export function getWhatWeOfferConfig(
  variant: WhatWeOfferVariant,
  lang: Language,
): VariantConfig {
  const baseActivity1: Omit<
    ActivityConfig,
    "imageKey" | "imageAlt" | "bookingRows" | "bookUrl"
  > = {
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

  const splashPouringActivities: ActivityConfig[] = [
    {
      id: "splash",
      titleKey: "activity_splash_title",
      descriptionKey: "activity_splash_description",
      detailsKey: "activity_splash_details",
      includedKey: "activity_1_included",
      techniqueIds: ["boxing", "balloons", "balls", "guns"],
      formatCards: [
        {
          titleKey: "activity_splash_format_big_title",
          descriptionKey: "activity_splash_format_big_description",
          imageKey: "largeCanvas",
        },
        {
          titleKey: "activity_splash_format_standard_title",
          descriptionKey: "activity_splash_format_standard_description",
          imageKey: "twoCanvases",
        },
        {
          titleKey: "activity_splash_format_team_title",
          descriptionKey: "activity_splash_format_team_description",
          imageKey: "sharedCanvas",
        },
      ],
      imageKey: "gallery4",
      imageAlt: "Splash painting with playful throwing techniques",
    },
    {
      id: "pouring",
      titleKey: "activity_pouring_title",
      descriptionKey: "activity_pouring_description",
      detailsKey: "activity_pouring_details",
      includedKey: "activity_1_included",
      techniqueIds: ["pouring", "spinning", "dripping", "surprise"],
      formatCards: [
        {
          titleKey: "activity_pouring_format_standard_title",
          descriptionKey: "activity_pouring_format_standard_description",
          imageKey: "twoCanvasesPouring",
        },
        {
          titleKey: "activity_pouring_format_team_title",
          descriptionKey: "activity_pouring_format_team_description",
          imageKey: "sharedCanvasPouring",
        },
      ],
      imageKey: "activity1",
      imageAlt: "Pouring and spinning abstract painting",
    },
  ];

  if (variant === "home") {
    return {
      localeNamespace: "home",
      sectionTitleNamespace: "home",
      introNamespace: "home",
      includedTitleNamespace: "home",
      detailsNamespace: "home",
      activityContentNamespace: "home",
      formatContentNamespace: "home",
      bookingMode: "none",
      activities: splashPouringActivities.filter((a) => !isActivityHidden(a.id)),
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
      formatContentNamespace: "friends",
      bookingMode: "none",
      activities: splashPouringActivities.filter((a) => !isActivityHidden(a.id)),
    };
  }

  if (variant === "family") {
    // Copy the friends "Qué ofrecemos" structure (Splash + Pouring with format
    // cards and technique videos), but use family-specific format copy.
    return {
      localeNamespace: "family",
      sectionTitleNamespace: "family",
      introNamespace: "family",
      includedTitleNamespace: "family",
      detailsNamespace: "family",
      activityContentNamespace: "home",
      formatContentNamespace: "family",
      bookingMode: "none",
      activities: splashPouringActivities.filter((a) => !isActivityHidden(a.id)),
    };
  }

  if (variant === "couples") {
    // Copy the friends "Qué ofrecemos" structure, but hide formats (already in pricing)
    // while keeping techniques videos/cards.
    return {
      localeNamespace: "friends",
      sectionTitleNamespace: "friends",
      introNamespace: "friends",
      includedTitleNamespace: "friends",
      // Couples section pricing lines should be per pareja (not per persona).
      detailsNamespace: "couples",
      activityContentNamespace: "home",
      bookingMode: "none",
      activities: splashPouringActivities
        .filter((a) => !isActivityHidden(a.id))
        .map((a) => ({
          ...a,
          formatCards: undefined,
          formatNoteKey: undefined,
        })),
    };
  }

  // corporate: Team Building Special + Splash & Pouring (from friends)
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

  const splashPouringForCorporate: ActivityConfig[] = splashPouringActivities
    .filter((a) => !isActivityHidden(a.id))
    .map((a) => ({
      ...a,
      includedKey: undefined,
    }));

  return {
    localeNamespace: "corporate",
    sectionTitleNamespace: "friends",
    introNamespace: "corporate",
    includedTitleNamespace: "friends",
    detailsNamespace: "corporate",
    activityContentNamespace: "home",
    formatContentNamespace: "corporate",
    bookingMode: "contact",
    showHowItWorks: true,
    ctaKey: "cta_book",
    activities: [
      teambuildingActivity,
      ...splashPouringForCorporate,
      { ...standardActivity2, detailsKey: "activity_2_details" },
      { ...standardActivity3, detailsKey: "activity_3_details" },
    ].filter((a) => !isActivityHidden(a.id)),
  };
}
