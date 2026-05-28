import { expect as chaiExpect } from "chai";

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

  // ── Variable scopes ──────────────────────────────────────────────────────

  function makeScope(store) {
    return {
      get: (key) => store[key] ?? undefined,
      set: (key, value) => { store[key] = String(value); },
      unset: (key) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
      has: (key) => key in store,
      toObject: () => ({ ...store }),
    };
  }

  const globalsScope = makeScope(mutations.globals);
  const environmentScope = makeScope(mutations.environment);
  const collectionVariablesScope = makeScope(mutations.collectionVariables);
  const iterationDataScope = {
    get: (key) => ctx.iterationData?.[key] ?? undefined,
    has: (key) => key in (ctx.iterationData ?? {}),
    toObject: () => ({ ...(ctx.iterationData ?? {}) }),
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
  };

  // ── pm object ────────────────────────────────────────────────────────────

  const pm = {
    // Variable scopes
    globals: globalsScope,
    environment: environmentScope,
    collectionVariables: collectionVariablesScope,
    iterationData: iterationDataScope,
    variables: {
      // Read-only resolution across scopes (local > data > env > collection > global)
      get: (key) =>
        iterationDataScope.get(key) ??
        environmentScope.get(key) ??
        collectionVariablesScope.get(key) ??
        globalsScope.get(key),
      set: (key, value) => { mutations.collectionVariables[key] = String(value); },
      has: (key) =>
        iterationDataScope.has(key) ||
        environmentScope.has(key) ||
        collectionVariablesScope.has(key) ||
        globalsScope.has(key),
    },

    // Request / response
    request: pmRequest,
    response: pmResponse,

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeHeaderList(headersObj) {
  return {
    get: (key) => headersObj[key] ?? null,
    has: (key) => key in headersObj,
    add: ({ key, value }) => { headersObj[key] = value; },
    upsert: ({ key, value }) => { headersObj[key] = value; },
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
