import { describe, it, expect, vi } from "vitest";
import { RateLimiter } from "../../src/utils/rate-limiter.js";

describe("RateLimiter", () => {
  it("should create a rate limiter with specified max requests per second", () => {
    const limiter = new RateLimiter(50);
    expect(limiter.getCurrentRequestCount()).toBe(0);
    expect(limiter.getQueueLength()).toBe(0);
  });

  it("should execute a single request immediately", async () => {
    const limiter = new RateLimiter(50);
    const mockFn = vi.fn(async () => "result");

    const result = await limiter.execute(mockFn);
    
    expect(result).toBe("result");
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("should execute multiple requests within rate limit", async () => {
    const limiter = new RateLimiter(50);
    const mockFn = vi.fn(async (value: number) => value * 2);

    const promises = [
      limiter.execute(() => mockFn(1)),
      limiter.execute(() => mockFn(2)),
      limiter.execute(() => mockFn(3)),
    ];

    const results = await Promise.all(promises);
    
    expect(results).toEqual([2, 4, 6]);
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it("should throttle requests when exceeding rate limit", async () => {
    const limiter = new RateLimiter(2); // Only 2 requests per second
    const executionTimes: number[] = [];
    const mockFn = vi.fn(async (value: number) => {
      executionTimes.push(Date.now());
      return value;
    });

    const startTime = Date.now();

    const promises = [
      limiter.execute(() => mockFn(1)),
      limiter.execute(() => mockFn(2)),
      limiter.execute(() => mockFn(3)),
    ];

    const results = await Promise.all(promises);
    
    expect(results).toEqual([1, 2, 3]);
    expect(mockFn).toHaveBeenCalledTimes(3);

    // First two should execute within a short time
    const firstTwoDelay = executionTimes[1] - executionTimes[0];
    expect(firstTwoDelay).toBeLessThan(100);

    // Third should be delayed by at least ~1 second
    const thirdDelay = executionTimes[2] - executionTimes[0];
    expect(thirdDelay).toBeGreaterThanOrEqual(900);
  }, 10000);

  it("should handle errors in executed functions", async () => {
    const limiter = new RateLimiter(50);
    const error = new Error("Test error");
    const mockFn = vi.fn(async () => {
      throw error;
    });

    await expect(limiter.execute(mockFn)).rejects.toThrow("Test error");
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("should track request times correctly", async () => {
    const limiter = new RateLimiter(50);
    const mockFn = vi.fn(async () => "result");

    // Execute first request
    await limiter.execute(mockFn);
    expect(limiter.getCurrentRequestCount()).toBeGreaterThan(0);

    // Execute second request
    await limiter.execute(mockFn);
    
    expect(mockFn).toHaveBeenCalledTimes(2);

    // After 1.1 seconds, old requests should be cleared
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(limiter.getCurrentRequestCount()).toBe(0);
  }, 5000);

  it("should handle burst of requests at rate limit", async () => {
    const limiter = new RateLimiter(5); // 5 requests per second
    const executionTimes: number[] = [];
    const mockFn = vi.fn(async (value: number) => {
      executionTimes.push(Date.now());
      return value;
    });

    // Queue 10 requests
    const promises = Array.from({ length: 10 }, (_, i) =>
      limiter.execute(() => mockFn(i))
    );

    const results = await Promise.all(promises);
    
    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(mockFn).toHaveBeenCalledTimes(10);

    // First 5 should execute quickly
    const firstBatchTime = executionTimes[4] - executionTimes[0];
    expect(firstBatchTime).toBeLessThan(200);

    // Last request should be delayed by at least ~1 second from first batch
    const totalTime = executionTimes[9] - executionTimes[0];
    expect(totalTime).toBeGreaterThanOrEqual(900);
  }, 10000);

  it("should handle mixed success and failure", async () => {
    const limiter = new RateLimiter(50);
    const successFn = vi.fn(async () => "success");
    const errorFn = vi.fn(async () => {
      throw new Error("error");
    });

    const promises = [
      limiter.execute(successFn),
      limiter.execute(errorFn),
      limiter.execute(successFn),
    ];

    const results = await Promise.allSettled(promises);

    expect(results[0]).toEqual({ status: "fulfilled", value: "success" });
    expect(results[1]).toEqual({
      status: "rejected",
      reason: new Error("error"),
    });
    expect(results[2]).toEqual({ status: "fulfilled", value: "success" });
  });

  it("should process queue sequentially", async () => {
    const limiter = new RateLimiter(50);
    const order: number[] = [];
    const mockFn = vi.fn(async (value: number) => {
      order.push(value);
      return value;
    });

    const promises = [
      limiter.execute(() => mockFn(1)),
      limiter.execute(() => mockFn(2)),
      limiter.execute(() => mockFn(3)),
    ];

    await Promise.all(promises);

    // Should execute in order
    expect(order).toEqual([1, 2, 3]);
  });

  it("should handle concurrent queue additions", async () => {
    const limiter = new RateLimiter(10);
    const mockFn = vi.fn(async (value: number) => value);

    // Add requests from different "threads"
    const batch1 = Array.from({ length: 5 }, (_, i) =>
      limiter.execute(() => mockFn(i))
    );
    const batch2 = Array.from({ length: 5 }, (_, i) =>
      limiter.execute(() => mockFn(i + 5))
    );

    const results = await Promise.all([...batch1, ...batch2]);
    
    expect(results.length).toBe(10);
    expect(mockFn).toHaveBeenCalledTimes(10);
  });
});
