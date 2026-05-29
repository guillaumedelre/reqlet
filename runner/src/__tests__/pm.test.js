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

describe("buildPm — pm.response.to (Postman response assertions)", () => {
  const ctx200 = {
    ...baseCtx,
    response: {
      status: "OK",
      code: 200,
      responseTime: 50,
      responseSize: 20,
      headers: { "content-type": "application/json; charset=utf-8" },
      cookies: {},
      body: '{"id":1,"title":"foo"}',
    },
  };

  it("to.have.status passes on matching code", () => {
    const { pm } = buildPm(ctx200);
    expect(() => pm.response.to.have.status(200)).not.toThrow();
  });

  it("to.have.status throws on wrong code", () => {
    const { pm } = buildPm(ctx200);
    expect(() => pm.response.to.have.status(404)).toThrow(/404/);
  });

  it("to.have.status matches string reason", () => {
    const { pm } = buildPm(ctx200);
    expect(() => pm.response.to.have.status("OK")).not.toThrow();
  });

  it("to.not.have.status passes when code differs", () => {
    const { pm } = buildPm(ctx200);
    expect(() => pm.response.to.not.have.status(404)).not.toThrow();
  });

  it("to.not.have.status throws when code matches", () => {
    const { pm } = buildPm(ctx200);
    expect(() => pm.response.to.not.have.status(200)).toThrow();
  });

  it("to.have.header passes when header present (case-insensitive)", () => {
    const { pm } = buildPm(ctx200);
    expect(() => pm.response.to.have.header("content-type")).not.toThrow();
    expect(() => pm.response.to.have.header("Content-Type")).not.toThrow();
  });

  it("to.have.header throws when header missing", () => {
    const { pm } = buildPm(ctx200);
    expect(() => pm.response.to.have.header("x-missing")).toThrow(/x-missing/);
  });

  it("to.have.header with value passes when matches", () => {
    const { pm } = buildPm(ctx200);
    expect(() => pm.response.to.have.header("content-type", "application/json; charset=utf-8")).not.toThrow();
  });

  it("to.have.body passes when body contains string", () => {
    const { pm } = buildPm(ctx200);
    expect(() => pm.response.to.have.body('"id"')).not.toThrow();
  });

  it("to.have.body throws when body does not contain string", () => {
    const { pm } = buildPm(ctx200);
    expect(() => pm.response.to.have.body("missing")).toThrow(/missing/);
  });

  it("to.have.body passes with RegExp match", () => {
    const { pm } = buildPm(ctx200);
    expect(() => pm.response.to.have.body(/foo/)).not.toThrow();
  });

  it("to.have.jsonBody passes when path exists", () => {
    const { pm } = buildPm(ctx200);
    expect(() => pm.response.to.have.jsonBody("id")).not.toThrow();
  });

  it("to.have.jsonBody with value passes when matches", () => {
    const { pm } = buildPm(ctx200);
    expect(() => pm.response.to.have.jsonBody("id", 1)).not.toThrow();
  });

  it("to.have.jsonBody throws when path missing", () => {
    const { pm } = buildPm(ctx200);
    expect(() => pm.response.to.have.jsonBody("nope")).toThrow(/nope/);
  });

  it("to.have.jsonSchema passes when body matches schema", () => {
    const { pm } = buildPm(ctx200);
    const schema = { type: "object", properties: { id: { type: "number" } }, required: ["id"] };
    expect(() => pm.response.to.have.jsonSchema(schema)).not.toThrow();
  });

  it("to.have.jsonSchema throws when body does not match schema", () => {
    const { pm } = buildPm(ctx200);
    const schema = { type: "object", required: ["missingField"] };
    expect(() => pm.response.to.have.jsonSchema(schema)).toThrow();
  });

  it("to.be.ok passes on 2xx", () => {
    const { pm } = buildPm(ctx200);
    expect(() => pm.response.to.be.ok).not.toThrow();
  });

  it("to.be.ok throws on non-2xx", () => {
    const ctx404 = { ...baseCtx, response: { ...ctx200.response, code: 404, status: "Not Found" } };
    const { pm } = buildPm(ctx404);
    expect(() => pm.response.to.be.ok).toThrow(/2xx/);
  });

  it("to.be.error passes on 4xx", () => {
    const ctx404 = { ...baseCtx, response: { ...ctx200.response, code: 404 } };
    const { pm } = buildPm(ctx404);
    expect(() => pm.response.to.be.error).not.toThrow();
  });

  it("to.be.serverError passes on 5xx", () => {
    const ctx500 = { ...baseCtx, response: { ...ctx200.response, code: 500 } };
    const { pm } = buildPm(ctx500);
    expect(() => pm.response.to.be.serverError).not.toThrow();
  });

  it("to.be.clientError passes on 4xx", () => {
    const ctx400 = { ...baseCtx, response: { ...ctx200.response, code: 400 } };
    const { pm } = buildPm(ctx400);
    expect(() => pm.response.to.be.clientError).not.toThrow();
  });

  it("to.be.redirection passes on 3xx", () => {
    const ctx301 = { ...baseCtx, response: { ...ctx200.response, code: 301 } };
    const { pm } = buildPm(ctx301);
    expect(() => pm.response.to.be.redirection).not.toThrow();
  });

  it("to.be.json passes when content-type is JSON", () => {
    const { pm } = buildPm(ctx200);
    expect(() => pm.response.to.be.json).not.toThrow();
  });

  it("to.be.html throws on JSON content-type", () => {
    const { pm } = buildPm(ctx200);
    expect(() => pm.response.to.be.html).toThrow(/html/);
  });

  it("usable inside pm.test() — pass", () => {
    const { pm, collectResults } = buildPm(ctx200);
    pm.test("status is 200", () => pm.response.to.have.status(200));
    expect(collectResults().tests[0].passed).toBe(true);
  });

  it("usable inside pm.test() — fail recorded as error", () => {
    const { pm, collectResults } = buildPm(ctx200);
    pm.test("status is 404", () => pm.response.to.have.status(404));
    const t = collectResults().tests[0];
    expect(t.passed).toBe(false);
    expect(t.error).toMatch(/404/);
  });
});

describe("buildPm — replaceIn / interpolation", () => {
  it("replaces {{key}} in globals", () => {
    const { pm } = buildPm({ ...baseCtx, globals: { host: "https://api.example.com" } });
    expect(pm.globals.replaceIn("{{host}}/users")).toBe("https://api.example.com/users");
  });

  it("replaces {{key}} in environment", () => {
    const { pm } = buildPm({ ...baseCtx, environment: { token: "abc123" } });
    expect(pm.environment.replaceIn("Bearer {{token}}")).toBe("Bearer abc123");
  });

  it("replaces {{key}} using pm.variables.replaceIn with correct precedence", () => {
    const ctx = { ...baseCtx, environment: { key: "env-val" }, globals: { key: "global-val" } };
    const { pm } = buildPm(ctx);
    expect(pm.variables.replaceIn("{{key}}")).toBe("env-val");
  });

  it("leaves unknown {{key}} untouched", () => {
    const { pm } = buildPm({ ...baseCtx });
    expect(pm.variables.replaceIn("{{unknown}}")).toBe("{{unknown}}");
  });

  it("environment takes precedence over globals in replaceIn", () => {
    const ctx = {
      ...baseCtx,
      globals: { x: "global" },
      environment: { x: "env" },
    };
    const { pm } = buildPm(ctx);
    expect(pm.variables.replaceIn("{{x}}")).toBe("env");
  });
});

describe("buildPm — pm.variables.toObject", () => {
  it("returns merged view of all scopes", () => {
    const ctx = {
      ...baseCtx,
      globals: { g: "1" },
      collectionVariables: { c: "2" },
      environment: { e: "3" },
    };
    const { pm } = buildPm(ctx);
    const obj = pm.variables.toObject();
    expect(obj.g).toBe("1");
    expect(obj.c).toBe("2");
    expect(obj.e).toBe("3");
  });
});

describe("buildPm — pm.iterationData extended", () => {
  it("toJSON() returns same as toObject()", () => {
    const { pm } = buildPm({ ...baseCtx, iterationData: { row: "42" } });
    expect(pm.iterationData.toJSON()).toEqual({ row: "42" });
  });

  it("unset() removes a key", () => {
    const { pm } = buildPm({ ...baseCtx, iterationData: { x: "1", y: "2" } });
    pm.iterationData.unset("x");
    expect(pm.iterationData.has("x")).toBe(false);
    expect(pm.iterationData.has("y")).toBe(true);
  });
});

describe("buildPm — pm.request.headers.remove", () => {
  it("remove() deletes a header", () => {
    const { pm } = buildPm({
      ...baseCtx,
      request: { ...baseCtx.request, headers: { Authorization: "Bearer tok" } },
    });
    pm.request.headers.remove("Authorization");
    expect(pm.request.headers.has("Authorization")).toBe(false);
  });
});

describe("buildPm — pm.cookies top-level", () => {
  it("exposes response cookies at pm.cookies", () => {
    const ctx = { ...baseCtx, response: { ...baseCtx.response, cookies: { session: "xyz" } } };
    const { pm } = buildPm(ctx);
    expect(pm.cookies.has("session")).toBe(true);
    expect(pm.cookies.get("session")).toBe("xyz");
  });

  it("returns null for missing cookie", () => {
    const { pm } = buildPm({ ...baseCtx });
    expect(pm.cookies.get("missing")).toBeNull();
  });
});

describe("buildPm — pm.visualizer", () => {
  it("collectResults returns null visualizer when not set", () => {
    const { collectResults } = buildPm({ ...baseCtx });
    const { visualizer } = collectResults();
    expect(visualizer).toBeNull();
  });

  it("set() stores template and data", () => {
    const { pm, collectResults } = buildPm({ ...baseCtx });
    pm.visualizer.set("<h1>{{title}}</h1>", { title: "Test" });
    const { visualizer } = collectResults();
    expect(visualizer).not.toBeNull();
    expect(visualizer.template).toBe("<h1>{{title}}</h1>");
    expect(visualizer.data).toEqual({ title: "Test" });
  });

  it("set() with no data defaults to empty object", () => {
    const { pm, collectResults } = buildPm({ ...baseCtx });
    pm.visualizer.set("<p>hi</p>");
    const { visualizer } = collectResults();
    expect(visualizer.data).toEqual({});
  });

  it("set() with null data defaults to empty object", () => {
    const { pm, collectResults } = buildPm({ ...baseCtx });
    pm.visualizer.set("<p>hi</p>", null);
    const { visualizer } = collectResults();
    expect(visualizer.data).toEqual({});
  });

  it("last set() call wins", () => {
    const { pm, collectResults } = buildPm({ ...baseCtx });
    pm.visualizer.set("<p>first</p>", { n: 1 });
    pm.visualizer.set("<p>second</p>", { n: 2 });
    const { visualizer } = collectResults();
    expect(visualizer.template).toBe("<p>second</p>");
    expect(visualizer.data).toEqual({ n: 2 });
  });
});

describe("buildPm — pm.iterationData.replaceIn", () => {
  it("replaces {{key}} from iterationData values", () => {
    const { pm } = buildPm({ ...baseCtx, iterationData: { username: "alice" } });
    expect(pm.iterationData.replaceIn("Hello {{username}}")).toBe("Hello alice");
  });

  it("iterationData takes precedence over environment in replaceIn", () => {
    const ctx = { ...baseCtx, iterationData: { x: "data" }, environment: { x: "env" } };
    const { pm } = buildPm(ctx);
    expect(pm.iterationData.replaceIn("{{x}}")).toBe("data");
  });

  it("leaves unknown {{key}} untouched", () => {
    const { pm } = buildPm({ ...baseCtx, iterationData: {} });
    expect(pm.iterationData.replaceIn("{{unknown}}")).toBe("{{unknown}}");
  });
});

describe("buildPm — pm.response.to.have.jsonBody no-args", () => {
  const ctx200 = {
    ...baseCtx,
    response: {
      status: "OK",
      code: 200,
      responseTime: 10,
      responseSize: 11,
      headers: { "content-type": "application/json" },
      cookies: {},
      body: '{"ok":true}',
    },
  };

  it("passes with no args when body is valid JSON", () => {
    const { pm } = buildPm(ctx200);
    expect(() => pm.response.to.have.jsonBody()).not.toThrow();
  });

  it("to.not.have.jsonBody() throws when body is valid JSON", () => {
    const { pm } = buildPm(ctx200);
    expect(() => pm.response.to.not.have.jsonBody()).toThrow();
  });

  it("passes when body is invalid JSON with negation", () => {
    const ctxBad = { ...ctx200, response: { ...ctx200.response, body: "not-json" } };
    const { pm } = buildPm(ctxBad);
    expect(() => pm.response.to.not.have.jsonBody()).not.toThrow();
  });
});

describe("buildPm — pm.response.to.be.text", () => {
  it("passes when content-type includes text", () => {
    const ctx = {
      ...baseCtx,
      response: {
        status: "OK",
        code: 200,
        responseTime: 10,
        responseSize: 5,
        headers: { "content-type": "text/plain; charset=utf-8" },
        cookies: {},
        body: "hello",
      },
    };
    const { pm } = buildPm(ctx);
    expect(() => pm.response.to.be.text).not.toThrow();
  });

  it("throws when content-type does not include text", () => {
    const ctx = {
      ...baseCtx,
      response: {
        status: "OK",
        code: 200,
        responseTime: 10,
        responseSize: 11,
        headers: { "content-type": "application/json" },
        cookies: {},
        body: '{"ok":true}',
      },
    };
    const { pm } = buildPm(ctx);
    expect(() => pm.response.to.be.text).toThrow(/text/);
  });
});

describe("buildPm — pm.response.to.not.be.* negation chains", () => {
  const ctx200 = {
    ...baseCtx,
    response: {
      status: "OK",
      code: 200,
      responseTime: 10,
      responseSize: 11,
      headers: { "content-type": "application/json" },
      cookies: {},
      body: '{"ok":true}',
    },
  };
  const ctx404 = { ...ctx200, response: { ...ctx200.response, code: 404, status: "Not Found" } };

  it("to.not.be.ok passes when 4xx", () => {
    const { pm } = buildPm(ctx404);
    expect(() => pm.response.to.not.be.ok).not.toThrow();
  });

  it("to.not.be.ok throws when 2xx", () => {
    const { pm } = buildPm(ctx200);
    expect(() => pm.response.to.not.be.ok).toThrow();
  });

  it("to.not.be.error passes when 2xx", () => {
    const { pm } = buildPm(ctx200);
    expect(() => pm.response.to.not.be.error).not.toThrow();
  });

  it("to.not.be.error throws when 4xx", () => {
    const { pm } = buildPm(ctx404);
    expect(() => pm.response.to.not.be.error).toThrow();
  });

  it("to.not.be.json throws when content-type is json", () => {
    const { pm } = buildPm(ctx200);
    expect(() => pm.response.to.not.be.json).toThrow();
  });

  it("to.not.be.json passes when content-type is not json", () => {
    const ctxText = {
      ...ctx200,
      response: { ...ctx200.response, headers: { "content-type": "text/plain" } },
    };
    const { pm } = buildPm(ctxText);
    expect(() => pm.response.to.not.be.json).not.toThrow();
  });
});

describe("buildPm — makeHeaderList.toObject", () => {
  it("pm.response.headers.toObject() returns a copy of headers", () => {
    const ctx = {
      ...baseCtx,
      response: {
        ...baseCtx.response,
        headers: { "content-type": "application/json", "x-request-id": "abc" },
      },
    };
    const { pm } = buildPm(ctx);
    const obj = pm.response.headers.toObject();
    expect(obj["content-type"]).toBe("application/json");
    expect(obj["x-request-id"]).toBe("abc");
  });
});

describe("buildPm — makeCookieList.toObject", () => {
  it("pm.cookies.toObject() returns a copy of cookies", () => {
    const ctx = {
      ...baseCtx,
      response: { ...baseCtx.response, cookies: { session: "xyz", lang: "fr" } },
    };
    const { pm } = buildPm(ctx);
    const obj = pm.cookies.toObject();
    expect(obj.session).toBe("xyz");
    expect(obj.lang).toBe("fr");
  });

  it("pm.response.cookies.toObject() returns empty object when no cookies", () => {
    const { pm } = buildPm({ ...baseCtx });
    expect(pm.cookies.toObject()).toEqual({});
  });
});
