import { expect as chaiExpect } from "chai";
import Ajv from "ajv";

/**
 * Build the pm object for a single script execution.
 *
 * @param {object} ctx  - Script context passed by the Go host.
 * @returns {{ pm: object, collectResults: function }}
 */
export function buildPm(ctx) {
  const mutations = {
    globals: { ...ctx.globals },
    environment: { ...ctx.environment },
    collectionVariables: { ...ctx.collectionVariables },
    nextRequest: undefined, // undefined = no change
    skipRequest: false,
  };

  const tests = [];
  let _visualizerTemplate = null;
  let _visualizerData = {};

  // ── Variable resolution ───────────────────────────────────────────────────

  // Resolves {{key}} placeholders across all scopes (precedence: data > env > collection > global).
  function interpolate(str) {
    return String(str).replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      const k = key.trim();
      const val =
        ctx.iterationData?.[k] ??
        mutations.environment[k] ??
        mutations.collectionVariables[k] ??
        mutations.globals[k];
      return val !== undefined ? val : `{{${k}}}`;
    });
  }

  // ── Variable scopes ──────────────────────────────────────────────────────

  function makeScope(store) {
    return {
      get: (key) => store[key] ?? undefined,
      set: (key, value) => { store[key] = String(value); },
      unset: (key) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
      has: (key) => key in store,
      toObject: () => ({ ...store }),
      replaceIn: (str) => interpolate(str),
    };
  }

  const globalsScope = makeScope(mutations.globals);
  const environmentScope = makeScope(mutations.environment);
  const collectionVariablesScope = makeScope(mutations.collectionVariables);

  const _iterData = { ...(ctx.iterationData ?? {}) };
  const iterationDataScope = {
    get: (key) => _iterData[key] ?? undefined,
    has: (key) => key in _iterData,
    unset: (key) => { delete _iterData[key]; },
    toObject: () => ({ ..._iterData }),
    toJSON: () => ({ ..._iterData }),
    replaceIn: (str) => interpolate(str),
  };

  // ── Request ──────────────────────────────────────────────────────────────

  const req = ctx.request ?? {};
  const pmRequest = {
    url: req.url ?? "",
    method: req.method ?? "GET",
    headers: makeHeaderList(req.headers ?? {}),
    body: req.body ?? null,
  };

  // ── Response ─────────────────────────────────────────────────────────────

  const res = ctx.response ?? {};
  const pmResponse = {
    status: res.status ?? "",
    code: res.code ?? 0,
    responseTime: res.responseTime ?? 0,
    responseSize: res.responseSize ?? 0,
    headers: makeHeaderList(res.headers ?? {}),
    cookies: makeCookieList(res.cookies ?? {}),
    text: () => res.body ?? "",
    json: () => {
      try {
        return JSON.parse(res.body ?? "null");
      } catch {
        throw new Error("Response body is not valid JSON");
      }
    },
    get to() { return makeResponseAssertions(pmResponse, res, false); },
  };

  // ── pm object ────────────────────────────────────────────────────────────

  const pm = {
    // Variable scopes
    globals: globalsScope,
    environment: environmentScope,
    collectionVariables: collectionVariablesScope,
    iterationData: iterationDataScope,
    variables: {
      get: (key) =>
        iterationDataScope.get(key) ??
        environmentScope.get(key) ??
        collectionVariablesScope.get(key) ??
        globalsScope.get(key),
      // Writes to collectionVariables so the value is visible to subsequent scripts.
      set: (key, value) => { mutations.collectionVariables[key] = String(value); },
      has: (key) =>
        iterationDataScope.has(key) ||
        environmentScope.has(key) ||
        collectionVariablesScope.has(key) ||
        globalsScope.has(key),
      toObject: () => ({
        ...mutations.globals,
        ...mutations.collectionVariables,
        ...mutations.environment,
        ..._iterData,
      }),
      replaceIn: (str) => interpolate(str),
    },

    // Request / response
    request: pmRequest,
    response: pmResponse,

    // Top-level cookies (response cookies for the current request URL)
    cookies: makeCookieList(res.cookies ?? {}),

    // Info
    info: {
      eventName: ctx.info?.eventName ?? "",
      iteration: ctx.info?.iteration ?? 0,
      iterationCount: ctx.info?.iterationCount ?? 1,
      requestName: ctx.info?.requestName ?? "",
      requestId: ctx.info?.requestId ?? "",
    },

    // Execution control
    execution: {
      skipRequest: () => { mutations.skipRequest = true; },
      // null/undefined → "" means "stop execution"; a string means "jump to".
      setNextRequest: (name) => { mutations.nextRequest = name ?? ""; },
      // location: hierarchy path to the current request (populated by Go if available)
      location: Object.assign(
        ctx.info?.location ?? [],
        { current: ctx.info?.locationCurrent ?? ctx.info?.requestName ?? "" },
      ),
    },

    // Test assertion
    expect: chaiExpect,
    test: (name, fn) => {
      try {
        fn();
        tests.push({ name, passed: true, error: null });
      } catch (err) {
        tests.push({ name, passed: false, error: err.message ?? String(err) });
      }
    },

    // sendRequest — synchronous-style via async bridge set by executor
    sendRequest: null, // injected by executor

    // Visualizer — stores template and data for Handlebars rendering
    visualizer: {
      set: (template, data) => {
        _visualizerTemplate = template;
        _visualizerData = data ?? {};
      },
    },
  };

  return {
    pm,
    collectResults: () => ({
      tests,
      mutations,
      visualizer: _visualizerTemplate !== null
        ? { template: _visualizerTemplate, data: _visualizerData }
        : null,
    }),
  };
}

// ── Response assertion API (pm.response.to.*) ─────────────────────────────────

function makeResponseAssertions(response, res, negated) {
  function assert(condition, posMsg, negMsg) {
    if (negated ? condition : !condition) throw new Error(negated ? negMsg : posMsg);
  }

  return {
    get not() { return makeResponseAssertions(response, res, !negated); },
    have: {
      status(codeOrReason) {
        if (typeof codeOrReason === "number") {
          assert(
            response.code === codeOrReason,
            `expected response to have status code ${codeOrReason} but got ${response.code}`,
            `expected response to not have status code ${codeOrReason}`,
          );
        } else {
          assert(
            response.status === codeOrReason,
            `expected response to have status '${codeOrReason}' but got '${response.status}'`,
            `expected response to not have status '${codeOrReason}'`,
          );
        }
      },
      header(key, value) {
        const hdrs = res.headers ?? {};
        const actual = hdrs[key] ?? hdrs[key.toLowerCase()];
        assert(
          actual !== undefined,
          `expected response to have header '${key}'`,
          `expected response to not have header '${key}'`,
        );
        if (value !== undefined) {
          assert(
            actual === value,
            `expected header '${key}' to equal '${value}' but got '${actual}'`,
            `expected header '${key}' to not equal '${value}'`,
          );
        }
      },
      body(content) {
        const body = res.body ?? "";
        if (content instanceof RegExp) {
          assert(content.test(body), `expected body to match ${content}`, `expected body to not match ${content}`);
        } else {
          assert(
            body.includes(String(content)),
            `expected body to include '${content}'`,
            `expected body to not include '${content}'`,
          );
        }
      },
      jsonBody(path, value) {
        let obj;
        try { obj = JSON.parse(res.body ?? "null"); } catch { obj = null; }
        if (path === undefined) {
          assert(obj !== null, "expected response body to be valid JSON", "expected response body to not be valid JSON");
          return;
        }
        let cur = obj;
        for (const part of String(path).split(".")) {
          cur = cur != null && typeof cur === "object" ? cur[part] : undefined;
        }
        if (value !== undefined) {
          assert(
            cur === value,
            `expected json path '${path}' to equal '${value}' but got '${cur}'`,
            `expected json path '${path}' to not equal '${value}'`,
          );
        } else {
          assert(cur !== undefined, `expected json body to have path '${path}'`, `expected json body to not have path '${path}'`);
        }
      },
      jsonSchema(schema, options = {}) {
        let obj;
        try { obj = JSON.parse(res.body ?? "null"); } catch { obj = null; }
        const validate = new Ajv({ strict: false, ...options }).compile(schema);
        const valid = validate(obj);
        assert(
          valid,
          `expected response body to match JSON schema: ${JSON.stringify(validate.errors)}`,
          "expected response body to not match JSON schema",
        );
      },
    },
    be: {
      get ok() {
        assert(response.code >= 200 && response.code < 300, `expected response to be 2xx but got ${response.code}`, `expected response to not be 2xx`);
        return makeResponseAssertions(response, res, negated);
      },
      get error() {
        assert(response.code >= 400, `expected response to be 4xx/5xx but got ${response.code}`, `expected response to not be 4xx/5xx`);
        return makeResponseAssertions(response, res, negated);
      },
      get serverError() {
        assert(response.code >= 500, `expected response to be 5xx but got ${response.code}`, `expected response to not be 5xx`);
        return makeResponseAssertions(response, res, negated);
      },
      get clientError() {
        assert(response.code >= 400 && response.code < 500, `expected response to be 4xx but got ${response.code}`, `expected response to not be 4xx`);
        return makeResponseAssertions(response, res, negated);
      },
      get redirection() {
        assert(response.code >= 300 && response.code < 400, `expected response to be 3xx but got ${response.code}`, `expected response to not be 3xx`);
        return makeResponseAssertions(response, res, negated);
      },
      get json() {
        const ct = (res.headers?.["content-type"] ?? res.headers?.["Content-Type"] ?? "").toLowerCase();
        assert(ct.includes("json"), `expected content-type to include 'json' but got '${ct}'`, `expected content-type to not include 'json'`);
        return makeResponseAssertions(response, res, negated);
      },
      get html() {
        const ct = (res.headers?.["content-type"] ?? res.headers?.["Content-Type"] ?? "").toLowerCase();
        assert(ct.includes("html"), `expected content-type to include 'html' but got '${ct}'`, `expected content-type to not include 'html'`);
        return makeResponseAssertions(response, res, negated);
      },
      get text() {
        const ct = (res.headers?.["content-type"] ?? res.headers?.["Content-Type"] ?? "").toLowerCase();
        assert(ct.includes("text"), `expected content-type to include 'text' but got '${ct}'`, `expected content-type to not include 'text'`);
        return makeResponseAssertions(response, res, negated);
      },
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeHeaderList(headersObj) {
  return {
    get: (key) => headersObj[key] ?? headersObj[key?.toLowerCase()] ?? null,
    has: (key) => key in headersObj || key?.toLowerCase() in headersObj,
    add: ({ key, value }) => { headersObj[key] = value; },
    upsert: ({ key, value }) => { headersObj[key] = value; },
    remove: (key) => { delete headersObj[key]; delete headersObj[key?.toLowerCase()]; },
    toObject: () => ({ ...headersObj }),
  };
}

function makeCookieList(cookiesObj) {
  return {
    get: (name) => cookiesObj[name] ?? null,
    has: (name) => name in cookiesObj,
    toObject: () => ({ ...cookiesObj }),
  };
}
