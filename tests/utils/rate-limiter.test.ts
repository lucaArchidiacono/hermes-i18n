import { describe, it, expect, vi } from "vitest";
import { RateLimiter } from "../../src/utils/rate-limiter.js";

describe("RateLimiter", () => {
  it("should execute requests and track state", async () => {
    const limiter = new RateLimiter(50);
    expect(limiter.getCurrentRequestCount()).toBe(0);

    const result = await limiter.execute(async () => "result");
    expect(result).toBe("result");
    expect(limiter.getCurrentRequestCount()).toBeGreaterThan(0);
  });

  it("should execute multiple requests within rate limit", async () => {
    const limiter = new RateLimiter(50);
    const mockFn = vi.fn(async (value: number) => value * 2);

    const results = await Promise.all([
      limiter.execute(() => mockFn(1)),
      limiter.execute(() => mockFn(2)),
      limiter.execute(() => mockFn(3)),
    ]);

    expect(results).toEqual([2, 4, 6]);
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it("should throttle requests when exceeding rate limit", async () => {
    const limiter = new RateLimiter(2);
    const times: number[] = [];

    const promises = [1, 2, 3].map((v) =>
      limiter.execute(async () => {
        times.push(Date.now());
        return v;
      })
    );

    const results = await Promise.all(promises);
    expect(results).toEqual([1, 2, 3]);

    // Third request should be delayed by ~1 second
    expect(times[2] - times[0]).toBeGreaterThanOrEqual(900);
  }, 10000);

  it("should handle errors without breaking", async () => {
    const limiter = new RateLimiter(50);

    await expect(
      limiter.execute(async () => {
        throw new Error("Test error");
      })
    ).rejects.toThrow("Test error");

    // Should still work after error
    const result = await limiter.execute(async () => "ok");
    expect(result).toBe("ok");
  });

  it("should process requests in order", async () => {
    const limiter = new RateLimiter(50);
    const order: number[] = [];

    await Promise.all(
      [1, 2, 3].map((v) =>
        limiter.execute(async () => {
          order.push(v);
        })
      )
    );

    expect(order).toEqual([1, 2, 3]);
  });
});
