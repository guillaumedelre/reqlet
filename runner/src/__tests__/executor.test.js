import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
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

describe("pm.visualizer", () => {
  it("returns null visualizerHtml when not set", async () => {
    const result = await execute("", "test", emptyCtx);
    expect(result.visualizerHtml).toBeNull();
  });

  it("renders Handlebars template with data", async () => {
    const script = `pm.visualizer.set("<h1>{{title}}</h1>", { title: "Hello" })`;
    const result = await execute(script, "test", emptyCtx);
    expect(result.visualizerHtml).toBe("<h1>Hello</h1>");
  });

  it("returns null visualizerHtml on script error", async () => {
    const result = await execute("throw new Error('oops')", "test", emptyCtx);
    expect(result.visualizerHtml).toBeNull();
  });

  it("renders with empty data when no data arg given", async () => {
    const script = `pm.visualizer.set("<p>static</p>")`;
    const result = await execute(script, "test", emptyCtx);
    expect(result.visualizerHtml).toBe("<p>static</p>");
  });

  it("returns error HTML on invalid Handlebars template", async () => {
    const script = `pm.visualizer.set("{{#invalid}}")`;
    const result = await execute(script, "test", emptyCtx);
    expect(result.visualizerHtml).toMatch(/Visualizer error/);
  });
});

describe("pm.sendRequest", () => {
  let savedFetch;

  beforeEach(() => {
    savedFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = savedFetch;
  });

  it("calls fetch with a string URL as a GET request", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      statusText: "OK",
      status: 200,
      text: jest.fn().mockResolvedValue("{}"),
      headers: { get: jest.fn().mockReturnValue(null) },
    });

    await execute(`pm.sendRequest("https://example.com/api", () => {})`, "prerequest", emptyCtx);
    await new Promise((r) => setTimeout(r, 0));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://example.com/api",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("calls fetch with an object request including raw body and headers", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      statusText: "Created",
      status: 201,
      text: jest.fn().mockResolvedValue('{"id":1}'),
      headers: { get: jest.fn().mockReturnValue(null) },
    });

    const script = `pm.sendRequest({
      url: "https://api.example.com/items",
      method: "POST",
      header: { "Content-Type": "application/json" },
      body: { mode: "raw", raw: '{"x":1}' },
    }, () => {})`;
    await execute(script, "prerequest", emptyCtx);
    await new Promise((r) => setTimeout(r, 0));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.example.com/items",
      expect.objectContaining({ method: "POST", body: '{"x":1}' }),
    );
  });

  it("calls callback with error when fetch rejects", async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error("network error"));

    await execute(`pm.sendRequest("https://fail.example.com", () => {})`, "prerequest", emptyCtx);
    await new Promise((r) => setTimeout(r, 0));

    expect(globalThis.fetch).toHaveBeenCalled();
  });
});
