import { describe, expect, it } from "vitest";
import { CONTENT_SECURITY_POLICY, SECURITY_HEADERS, renderHeadersFile } from "./security-headers";

describe("security headers", () => {
  it("renders every header under a catch-all path", () => {
    const lines = renderHeadersFile().trimEnd().split("\n");
    expect(lines[0]).toBe("/*");
    expect(lines.slice(1)).toEqual(
      Object.entries(SECURITY_HEADERS).map(([key, value]) => `  ${key}: ${value}`),
    );
  });

  it("only allows the external origins the app calls", () => {
    expect(CONTENT_SECURITY_POLICY).toContain("connect-src 'self' https://www.googleapis.com");
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(CONTENT_SECURITY_POLICY).not.toContain("'unsafe-eval'");
  });
});
