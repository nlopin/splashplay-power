import { describe, it, expect, vi, afterEach } from "vitest";
import { getRecursiveValue } from "./i18n";

describe("getRecursiveValue", () => {
  const translations = {
    simple: "Simple Value",
    nested: {
      key: "Nested Value",
      deep: {
        key: "Deep Value",
      },
    },
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return undefined if object is undefined", () => {
    expect(getRecursiveValue(undefined, ["key"])).toBeUndefined();
  });

  it("should return undefined if keys array is empty", () => {
    expect(getRecursiveValue(translations, [])).toBeUndefined();
  });

  it("should return simple value for single key", () => {
    expect(getRecursiveValue(translations, ["simple"])).toBe("Simple Value");
  });

  it("should return nested value for multiple keys", () => {
    expect(getRecursiveValue(translations, ["nested", "key"])).toBe(
      "Nested Value",
    );
  });

  it("should return deep nested value", () => {
    expect(getRecursiveValue(translations, ["nested", "deep", "key"])).toBe(
      "Deep Value",
    );
  });

  it("should return undefined if key does not exist", () => {
    expect(getRecursiveValue(translations, ["nonExistent"])).toBeUndefined();
  });

  it("should return undefined if nested key does not exist", () => {
    expect(
      getRecursiveValue(translations, ["nested", "nonExistent"]),
    ).toBeUndefined();
  });

  it("should return undefined and warn if key points to an object but no more keys provided", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(getRecursiveValue(translations, ["nested"])).toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Translation key \"nested\" points to a non-string value. The value type is object',
    );
  });

  it("should return undefined if trying to access property of a string", () => {
    expect(getRecursiveValue(translations, ["simple", "prop"])).toBeUndefined();
  });
});
