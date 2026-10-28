import { describe, expect, it } from "vitest";

import {
  applyCouplesPatch,
  applyFamilyPatch,
  applyFriendsPatch,
  applyOpenSessionPatch,
  couplesSetActivityFormat,
  couplesSetPicture,
  familySetActivityFormat,
  familySetAdults,
  familySetCanvasType,
  familySetKids,
  friendsSetGuests,
  type CouplesFormState,
  type FamilyFormData,
  type FriendsFormData,
} from "./formState";

const family: FamilyFormData = {
  adults: 2,
  kids: 1,
  canvases: 3,
  canvasType: "standard",
  activityFormat: "splash",
};

const friends: FriendsFormData = {
  guests: 2,
  canvases: 2,
  canvasType: "standard",
  activityFormat: "splash",
};

const couples: CouplesFormState = {
  picture: "one_big",
  activityFormat: "splash",
  savedSplashPicture: "one_big",
};

describe("family transitions (same rules as the widget)", () => {
  it("defaults standard canvases to one per person", () => {
    expect(familySetKids(family, 3)).toMatchObject({
      adults: 2,
      kids: 3,
      canvases: 5,
    });
  });

  it("keeps the total at 6 by trimming the other count", () => {
    expect(familySetAdults({ ...family, kids: 4 }, 5)).toMatchObject({
      adults: 5,
      kids: 1,
    });
    expect(familySetKids({ ...family, adults: 4 }, 5)).toMatchObject({
      adults: 1,
      kids: 5,
    });
  });

  it("pouring switches a big canvas back to standard", () => {
    const big = familySetCanvasType(family, "big");
    expect(big).toMatchObject({ canvasType: "big", canvases: 1 });
    expect(familySetActivityFormat(big, "pouring")).toMatchObject({
      activityFormat: "pouring",
      canvasType: "standard",
      canvases: 3,
    });
  });
});

describe("applyFamilyPatch", () => {
  it("applies a full selection in one call", () => {
    const { next, adjusted } = applyFamilyPatch(family, {
      adults: 2,
      kids: 2,
      activityFormat: "pouring",
    });
    expect(next).toEqual({
      adults: 2,
      kids: 2,
      canvases: 4,
      canvasType: "standard",
      activityFormat: "pouring",
    });
    expect(adjusted).toEqual([]);
  });

  it("reports values it couldn't set", () => {
    const { next, adjusted } = applyFamilyPatch(family, {
      activityFormat: "pouring",
      canvasType: "big",
    });
    expect(next.canvasType).toBe("standard");
    expect(adjusted).toEqual([
      { field: "canvasType", requested: "big", actual: "standard" },
    ]);
  });

  it("caps the group at 6", () => {
    const { next, adjusted } = applyFamilyPatch(family, { adults: 4, kids: 4 });
    expect(next.adults + next.kids).toBe(6);
    expect(adjusted.map((a) => a.field)).toContain("adults");
  });
});

describe("applyFriendsPatch", () => {
  it("clamps guests to 1–6", () => {
    expect(friendsSetGuests(friends, 9).guests).toBe(6);
    const { adjusted } = applyFriendsPatch(friends, { guests: 9 });
    expect(adjusted).toEqual([{ field: "guests", requested: 9, actual: 6 }]);
  });

  it("sets a big canvas for a Splash group", () => {
    const { next, adjusted } = applyFriendsPatch(friends, {
      guests: 4,
      canvasType: "big",
    });
    expect(next).toMatchObject({ guests: 4, canvasType: "big", canvases: 1 });
    expect(adjusted).toEqual([]);
  });
});

describe("couples transitions", () => {
  it("pouring uses individual canvases and restores the Splash choice after", () => {
    const pouring = couplesSetActivityFormat(
      couplesSetPicture(couples, "two_big"),
      "pouring",
    );
    expect(pouring).toMatchObject({
      picture: "individual",
      activityFormat: "pouring",
    });
    expect(couplesSetActivityFormat(pouring, "splash").picture).toBe("two_big");
  });

  it("a Splash-only canvas switches to Splash when no format was asked for", () => {
    const pouring = couplesSetActivityFormat(couples, "pouring");
    const { next, adjusted } = applyCouplesPatch(pouring, {
      picture: "two_big",
    });
    expect(next).toMatchObject({
      picture: "two_big",
      activityFormat: "splash",
    });
    expect(adjusted).toEqual([]);
  });

  it("refuses a Splash-only canvas with Pouring", () => {
    const { next, adjusted } = applyCouplesPatch(couples, {
      activityFormat: "pouring",
      picture: "one_big",
    });
    expect(next.picture).toBe("individual");
    expect(adjusted).toEqual([
      { field: "picture", requested: "one_big", actual: "individual" },
    ]);
  });
});

describe("applyOpenSessionPatch", () => {
  const empty = { solo: 0, pair_shared: 0, pair_two: 0 };

  it("sets ticket counts", () => {
    const { next, adjusted } = applyOpenSessionPatch(empty, {
      solo: 1,
      pair_two: 1,
    });
    expect(next).toEqual({ solo: 1, pair_shared: 0, pair_two: 1 });
    expect(adjusted).toEqual([]);
  });

  it("caps at the spots left in the slot", () => {
    const { next, adjusted } = applyOpenSessionPatch(empty, { pair_two: 2 }, 3);
    expect(next.pair_two).toBe(1);
    expect(adjusted).toEqual([{ field: "pair_two", requested: 2, actual: 1 }]);
  });
});
