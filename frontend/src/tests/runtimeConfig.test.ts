import { describe, expect, it, beforeEach } from "vitest";
import { getRuntimeConfig, setRuntimeApiBaseUrl, setRuntimeBackendMode } from "@/lib/runtimeConfig";

describe("runtimeConfig", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists backend mode and API base URL with normalization", () => {
    setRuntimeBackendMode("fastapi");
    setRuntimeApiBaseUrl("http://localhost:8000///");

    const config = getRuntimeConfig();
    expect(config.backendMode).toBe("fastapi");
    expect(config.apiBaseUrl).toBe("http://localhost:8000");
  });

  it("removes API base URL when empty value is stored", () => {
    setRuntimeApiBaseUrl("http://localhost:8000");
    setRuntimeApiBaseUrl("   ");
    expect(localStorage.getItem("carfinder.apiBaseUrl")).toBeNull();
  });
});
