import { describe, it, expect } from "@jest/globals";
import { buildPm } from "../pm.js";

const baseCtx = {
  globals: {},
  environment: {},
  collectionVariables: {},
  iterationData: {},
  request: { url: "https://example.com", method: "GET", headers: {}, body: null },
  response: {
    status: "200 OK",
    code: 200,
    responseTime: 42,
    responseSize: 10,
    headers: {},
    cookies: {},
    body: '{"ok":true}',
  },
  info: { eventName: "test", iteration: 0, iterationCount: 1, requestName: "Ping", requestId: "r1" },
};

describe("buildPm — globals scope", () => {
  it("set and get a global variable", () => {
    const { pm } = buildPm({ ...baseCtx });
    pm.globals.set("token", "abc");
    expect(pm.globals.get("token")).toBe("abc");
  });

  it("has() returns false for missing key", () => {
    const { pm } = buildPm({ ...baseCtx });
    expect(pm.globals.has("missing")).toBe(false);
  });

  it("has() returns true after set", () => {
    const { pm } = buildPm({ ...baseCtx });
    pm.globals.set("x", "1");
    expect(pm.globals.has("x")).toBe(true);
  });

  it("unset() removes a key", () => {
    const { pm } = buildPm({ ...baseCtx });
    pm.globals.set("k", "v");
    pm.globals.unset("k");
    expect(pm.globals.has("k")).toBe(false);
  });

  it("clear() removes all keys", () => {
    const { pm } = buildPm({ globals: { a: "1", b: "2" }, ...baseCtx });
    pm.globals.clear();
    expect(pm.globals.toObject()).toEqual({});
  });

  it("toObject() returns a copy", () => {
    const { pm } = buildPm({ ...baseCtx, globals: { x: "1" } });
    const obj = pm.globals.toObject();
    expect(obj).toEqual({ x: "1" });
  });
});

describe("buildPm — environment scope", () => {
  it("set and get an environment variable", () => {
    const { pm } = buildPm({ ...baseCtx });
    pm.environment.set("base_url", "http://localhost");
    expect(pm.environment.get("base_url")).toBe("http://localhost");
  });

  it("values are coerced to string", () => {
    const { pm } = buildPm({ ...baseCtx });
    pm.environment.set("count", 42);
    expect(pm.environment.get("count")).toBe("42");
  });
});

describe("buildPm — collectionVariables scope", () => {
  it("set and get a collection variable", () => {
    const { pm } = buildPm({ ...baseCtx });
    pm.collectionVariables.set("version", "v2");
    expect(pm.collectionVariables.get("version")).toBe("v2");
  });
});

describe("buildPm — variables resolution order", () => {
  it("iterationData takes precedence over environment", () => {
    const ctx = {
      ...baseCtx,
      iterationData: { key: "from-data" },
      environment: { key: "from-env" },
    };
    const { pm } = buildPm(ctx);
    expect(pm.variables.get("key")).toBe("from-data");
  });

  it("environment takes precedence over collectionVariables", () => {
    const ctx = {
      ...baseCtx,
      environment: { key: "from-env" },
      collectionVariables: { key: "from-col" },
    };
    const { pm } = buildPm(ctx);
    expect(pm.variables.get("key")).toBe("from-env");
  });

  it("falls back to globals when not found elsewhere", () => {
    const ctx = { ...baseCtx, globals: { key: "from-global" } };
    const { pm } = buildPm(ctx);
    expect(pm.variables.get("key")).toBe("from-global");
  });

  it("variables.has() finds key in any scope", () => {
    const ctx = { ...baseCtx, globals: { g: "1" } };
    const { pm } = buildPm(ctx);
    expect(pm.variables.has("g")).toBe(true);
    expect(pm.variables.has("missing")).toBe(false);
  });

  it("variables.set() writes to collectionVariables", () => {
    const { pm, collectResults } = buildPm({ ...baseCtx });
    pm.variables.set("x", "val");
    const { mutations } = collectResults();
    expect(mutations.collectionVariables["x"]).toBe("val");
  });
});

describe("buildPm — iterationData scope", () => {
  it("get() returns value from iterationData", () => {
    const { pm } = buildPm({ ...baseCtx, iterationData: { row: "1" } });
    expect(pm.iterationData.get("row")).toBe("1");
  });

  it("has() returns false for missing key", () => {
    const { pm } = buildPm({ ...baseCtx });
    expect(pm.iterationData.has("nope")).toBe(false);
  });

  it("toObject() returns copy", () => {
    const { pm } = buildPm({ ...baseCtx, iterationData: { a: "1" } });
    expect(pm.iterationData.toObject()).toEqual({ a: "1" });
  });
});

describe("buildPm — pm.test", () => {
  it("records a passing test", () => {
    const { pm, collectResults } = buildPm({ ...baseCtx });
    pm.test("status is 200", () => {
      pm.expect(200).to.equal(200);
    });
    const { tests } = collectResults();
    expect(tests).toHaveLength(1);
    expect(tests[0].name).toBe("status is 200");
    expect(tests[0].passed).toBe(true);
    expect(tests[0].error).toBeNull();
  });

  it("records a failing test with error message", () => {
    const { pm, collectResults } = buildPm({ ...baseCtx });
    pm.test("status is 201", () => {
      pm.expect(200).to.equal(201);
    });
    const { tests } = collectResults();
    expect(tests[0].passed).toBe(false);
    expect(tests[0].error).toMatch(/expected 200 to equal 201/);
  });

  it("multiple tests are all recorded", () => {
    const { pm, collectResults } = buildPm({ ...baseCtx });
    pm.test("t1", () => {});
    pm.test("t2", () => {});
    const { tests } = collectResults();
    expect(tests).toHaveLength(2);
  });
});

describe("buildPm — pm.request", () => {
  it("exposes the request url and method", () => {
    const { pm } = buildPm({ ...baseCtx });
    expect(pm.request.url).toBe("https://example.com");
    expect(pm.request.method).toBe("GET");
  });

  it("headers.get() returns null for missing header", () => {
    const { pm } = buildPm({ ...baseCtx });
    expect(pm.request.headers.get("x-missing")).toBeNull();
  });

  it("headers.has() returns false for missing header", () => {
    const { pm } = buildPm({ ...baseCtx });
    expect(pm.request.headers.has("x-missing")).toBe(false);
  });

  it("headers.add() inserts a header", () => {
    const { pm } = buildPm({ ...baseCtx });
    pm.request.headers.add({ key: "X-Foo", value: "bar" });
    expect(pm.request.headers.get("X-Foo")).toBe("bar");
  });

  it("headers.upsert() updates a header", () => {
    const { pm } = buildPm({
      ...baseCtx,
      request: { ...baseCtx.request, headers: { "Content-Type": "text/plain" } },
    });
    pm.request.headers.upsert({ key: "Content-Type", value: "application/json" });
    expect(pm.request.headers.get("Content-Type")).toBe("application/json");
  });
});

describe("buildPm — pm.response", () => {
  it("exposes status code", () => {
    const { pm } = buildPm({ ...baseCtx });
    expect(pm.response.code).toBe(200);
    expect(pm.response.status).toBe("200 OK");
  });

  it("text() returns the raw body", () => {
    const { pm } = buildPm({ ...baseCtx });
    expect(pm.response.text()).toBe('{"ok":true}');
  });

  it("json() parses the body", () => {
    const { pm } = buildPm({ ...baseCtx });
    expect(pm.response.json()).toEqual({ ok: true });
  });

  it("json() throws on invalid JSON", () => {
    const ctx = { ...baseCtx, response: { ...baseCtx.response, body: "not-json" } };
    const { pm } = buildPm(ctx);
    expect(() => pm.response.json()).toThrow("Response body is not valid JSON");
  });

  it("headers.get() returns null for missing header", () => {
    const { pm } = buildPm({ ...baseCtx });
    expect(pm.response.headers.get("x-missing")).toBeNull();
  });

  it("cookies.get() returns value when present", () => {
    const ctx = { ...baseCtx, response: { ...baseCtx.response, cookies: { session: "abc" } } };
    const { pm } = buildPm(ctx);
    expect(pm.response.cookies.get("session")).toBe("abc");
  });

  it("cookies.has() returns false for missing cookie", () => {
    const { pm } = buildPm({ ...baseCtx });
    expect(pm.response.cookies.has("missing")).toBe(false);
  });
});

describe("buildPm — pm.info", () => {
  it("exposes eventName, iteration, and requestName", () => {
    const { pm } = buildPm({ ...baseCtx });
    expect(pm.info.eventName).toBe("test");
    expect(pm.info.iteration).toBe(0);
    expect(pm.info.requestName).toBe("Ping");
  });
});

describe("buildPm — pm.execution", () => {
  it("skipRequest() sets the skipRequest mutation", () => {
    const { pm, collectResults } = buildPm({ ...baseCtx });
    pm.execution.skipRequest();
    const { mutations } = collectResults();
    expect(mutations.skipRequest).toBe(true);
  });

  it("setNextRequest() sets the nextRequest mutation", () => {
    const { pm, collectResults } = buildPm({ ...baseCtx });
    pm.execution.setNextRequest("Step 2");
    const { mutations } = collectResults();
    expect(mutations.nextRequest).toBe("Step 2");
  });

  it("setNextRequest(null) sets nextRequest to empty string (stop)", () => {
    const { pm, collectResults } = buildPm({ ...baseCtx });
    pm.execution.setNextRequest(null);
    const { mutations } = collectResults();
    expect(mutations.nextRequest).toBe("");
  });
});

describe("buildPm — collectResults mutations", () => {
  it("mutations include globals and environment changes", () => {
    const { pm, collectResults } = buildPm({ ...baseCtx });
    pm.globals.set("g", "1");
    pm.environment.set("e", "2");
    const { mutations } = collectResults();
    expect(mutations.globals["g"]).toBe("1");
    expect(mutations.environment["e"]).toBe("2");
  });
});
