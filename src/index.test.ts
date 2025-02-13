import { describe, expect, test } from "bun:test";
import { googleLogin } from "./index.ts";

describe("googleLogin", () => {
  test("response_type is code", async () => {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.append("response_type", "token");
    const response = await googleLogin(new Request(url));
    expect(response.status).toBe(400);
    expect(response.text()).resolves.toBe(
      'Invalid response_type: "token". Expected "code".',
    );
  });

  test("client_id is required", async () => {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.append("response_type", "code");
    const response = await googleLogin(new Request(url));
    expect(response.status).toBe(400);
    expect(response.text()).resolves.toBe("Parameter client_id is required.");
  });

  test("redirect_uri is required", async () => {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.append("response_type", "code");
    url.searchParams.append("client_id", "123");
    const response = await googleLogin(new Request(url));
    expect(response.status).toBe(400);
    expect(response.text()).resolves.toBe(
      "Parameter redirect_uri is required.",
    );
  });

  test("state length is not 43", async () => {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.append("response_type", "code");
    url.searchParams.append("client_id", "123");
    url.searchParams.append("redirect_uri", "https://example.com");
    url.searchParams.append("state", "123");
    const response = await googleLogin(new Request(url));
    expect(response.status).toBe(400);
    expect(response.text()).resolves.toBe(
      "Invalid state length: 3. Expected 43.",
    );
  });

  test("state is not URL-safe", async () => {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.append("response_type", "code");
    url.searchParams.append("client_id", "123");
    url.searchParams.append("redirect_uri", "https://example.com");
    url.searchParams.append(
      "state",
      "[123456789abcdef0123456789abcdef0123456789a",
    );
    const response = await googleLogin(new Request(url));
    expect(response.status).toBe(400);
    expect(response.text()).resolves.toBe(
      `Invalid state character: "[". Expected URL-safe character.`,
    );
  });

  test("state is URL-safe", async () => {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.append("response_type", "code");
    url.searchParams.append("client_id", "123");
    url.searchParams.append("redirect_uri", "https://example.com");
    url.searchParams.append(
      "state",
      "0123456789abcdef0123456789abcdef0123456789a",
    );
    const response = await googleLogin(new Request(url));
    expect(response.status).toBe(200);
  });
});
