import { describe, expect, it, test } from "vitest";
import {
  formatEventComment,
  getTransactionIdFromEventComment,
} from "./eventMessage";

const TRANSACTION_ID = "pm_1SehIx4egtrwKqHbO2Ua5pPS";

describe("formatEventComment", () => {
  it("formats event comment with session title and transaction ID", () => {
    const sessionTitle = "Family Session - 2 hours";

    const result = formatEventComment(TRANSACTION_ID, sessionTitle);

    expect(result).toBe(
      `Family Session - 2 hours\nTransaction ID: ${TRANSACTION_ID}`,
    );
  });

  it("handles empty transaction ID", () => {
    const transactionId = "";
    const sessionTitle = "Group Workshop";

    const result = formatEventComment(transactionId, sessionTitle);

    expect(result).toBe("Group Workshop\nTransaction ID: ");
  });

  it("handles empty session title", () => {
    const transactionId = "DEF456";
    const sessionTitle = "";

    const result = formatEventComment(transactionId, sessionTitle);

    expect(result).toBe("\nTransaction ID: DEF456");
  });

  it("handles multi-line session title", () => {
    const transactionId = "JKL012";
    const sessionTitle =
      "Creative Workshop\nFor Beginners\n(Materials Included)";

    const result = formatEventComment(transactionId, sessionTitle);

    expect(result).toBe(
      "Creative Workshop\nFor Beginners\n(Materials Included)\nTransaction ID: JKL012",
    );
  });
});

describe("getTransactionIdFromEventComment", () => {
  it("should extract transaction ID from properly formatted comment", () => {
    const eventComment = `Family Session - 2 hours\nTransaction ID: ${TRANSACTION_ID}`;

    const result = getTransactionIdFromEventComment(eventComment);

    expect(result).toBe(TRANSACTION_ID);
  });

  it("returns empty string when transaction ID is not found", () => {
    const eventComment = "Family Session - 2 hours\nNo transaction info here";

    const result = getTransactionIdFromEventComment(eventComment);

    expect(result).toBe("");
  });

  it("returns empty string for empty input", () => {
    const result = getTransactionIdFromEventComment("");

    expect(result).toBe("");
  });

  it("with multiple transaction IDs, should extract last one", () => {
    const eventComment =
      "Event\nTransaction ID: FIRST123\nSome text\nTransaction ID: SECOND456";

    const result = getTransactionIdFromEventComment(eventComment);

    expect(result).toBe("SECOND456");
  });
});
