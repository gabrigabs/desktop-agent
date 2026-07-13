import { describe, expect, test } from "bun:test";
import { normalizeNativeError } from "../native";

describe("native error normalization", () => {
  test("keeps typed native errors", () => {
    expect(normalizeNativeError({ code: "CAPTURE_EXPIRED", message: "expired", recoverable: true })).toEqual({
      code: "CAPTURE_EXPIRED",
      message: "expired",
      recoverable: true,
    });
  });

  test("maps unknown bridge errors to a safe typed error", () => {
    expect(normalizeNativeError(new Error("socket closed")).code).toBe("BRIDGE_UNAVAILABLE");
    expect(normalizeNativeError("PERMISSION_DENIED: denied")).toEqual({
      code: "PERMISSION_DENIED",
      message: "denied",
      recoverable: false,
    });
  });
});
