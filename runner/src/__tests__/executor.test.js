import { describe, it, expect } from "@jest/globals";
import { execute } from "../executor.js";

const emptyCtx = {
  globals: {},
  environment: {},
  collectionVariables: {},
  iterationData: {},
  request: { url: "https://example.com", method: "GET", headers: {}, body: null },
  response: { status: "200 OK", code: 200, responseTime: 10, responseSize: 0, headers: {}, cookies: {}, body: "" },
};

describe("execute", () => {
  it("returns empty tests and default mutations for empty script", async () => {
    const result = await execute("", "prerequest", emptyCtx);
    expect(result.tests).toEqual([]);
    expect(result.mutations).toMatchObject({
      skipRequest: false,
      nextRequest: undefined,
    });
  });

  it("records a passing pm.test", async () => {
    const script = `pm.test("status is 200", () => { pm.expect(pm.response.code).to.equal(200) })`;
    const result = await execute(script, "test", emptyCtx);
    expect(result.tests).toHaveLength(1);
    expect(result.tests[0].name).toBe("status is 200");
    expect(result.tests[0].passed).toBe(true);
  });

  it("records a failing pm.test", async () => {
    const script = `pm.test("status is 201", () => { pm.expect(pm.response.code).to.equal(201) })`;
    const result = await execute(script, "test", emptyCtx);
    expect(result.tests[0].passed).toBe(false);
    expect(result.tests[0].error).toBeTruthy();
  });

  it("reports uncaught script error as a failed test", async () => {
    const script = `throw new Error("boom")`;
    const result = await execute(script, "prerequest", emptyCtx);
    expect(result.tests).toHaveLength(1);
    expect(result.tests[0].name).toBe("(script error)");
    expect(result.tests[0].passed).toBe(false);
    expect(result.tests[0].error).toBe("boom");
  });

  it("can set environment variable and returns it in mutations", async () => {
    const script = `pm.environment.set("token", "abc123")`;
    const result = await execute(script, "prerequest", emptyCtx);
    expect(result.mutations.environment["token"]).toBe("abc123");
  });

  it("can set global variable and returns it in mutations", async () => {
    const script = `pm.globals.set("shared", "yes")`;
    const result = await execute(script, "prerequest", emptyCtx);
    expect(result.mutations.globals["shared"]).toBe("yes");
  });

  it("execution.skipRequest() propagates to mutations", async () => {
    const script = `pm.execution.skipRequest()`;
    const result = await execute(script, "prerequest", emptyCtx);
    expect(result.mutations.skipRequest).toBe(true);
  });

  it("execution.setNextRequest() propagates to mutations", async () => {
    const script = `pm.execution.setNextRequest("Step 3")`;
    const result = await execute(script, "prerequest", emptyCtx);
    expect(result.mutations.nextRequest).toBe("Step 3");
  });

  it("script can access pm.environment values from ctx", async () => {
    const ctx = { ...emptyCtx, environment: { base_url: "http://api.test" } };
    const script = `pm.test("env var set", () => {
      pm.expect(pm.environment.get("base_url")).to.equal("http://api.test")
    })`;
    const result = await execute(script, "test", ctx);
    expect(result.tests[0].passed).toBe(true);
  });

  it("multiple pm.test calls are all recorded", async () => {
    const script = [
      `pm.test("t1", () => { pm.expect(1).to.equal(1) })`,
      `pm.test("t2", () => { pm.expect(2).to.equal(2) })`,
    ].join("\n");
    const result = await execute(script, "test", emptyCtx);
    expect(result.tests).toHaveLength(2);
    expect(result.tests.every((t) => t.passed)).toBe(true);
  });

  it("SyntaxError in script is caught and reported", async () => {
    const script = `{{{ invalid syntax`;
    const result = await execute(script, "test", emptyCtx);
    expect(result.tests).toHaveLength(1);
    expect(result.tests[0].name).toBe("(script error)");
    expect(result.tests[0].passed).toBe(false);
  });
});
