import vm from "node:vm";
import _ from "lodash";
import moment from "moment";
import Ajv from "ajv";
import { buildPm } from "./pm.js";

/**
 * Execute a script string inside a vm sandbox.
 *
 * @param {string} script  - JavaScript source to run.
 * @param {string} event   - "prerequest" or "test".
 * @param {object} ctx     - ScriptContext from the Go host.
 * @returns {Promise<{ tests: Array, mutations: object }>}
 */
export async function execute(script, event, ctx) {
  const { pm, collectResults } = buildPm({ ...ctx, event });

  // Inject pm.sendRequest as an async bridge using fetch.
  pm.sendRequest = (reqArg, callback) => {
    const reqObj = typeof reqArg === "string" ? { url: reqArg, method: "GET" } : reqArg;
    const headers = reqObj.header ?? reqObj.headers ?? {};
    const body =
      reqObj.body?.mode === "raw" ? reqObj.body.raw : undefined;

    fetch(reqObj.url, {
      method: reqObj.method ?? "GET",
      headers,
      body,
    })
      .then(async (res) => {
        const text = await res.text();
        const response = {
          status: res.statusText,
          code: res.status,
          responseTime: 0,
          text: () => text,
          json: () => JSON.parse(text),
          headers: { get: (k) => res.headers.get(k) },
        };
        callback(null, response);
      })
      .catch((err) => callback(err, null));
  };

  const sandbox = vm.createContext({
    pm,
    console,
    setTimeout,
    clearTimeout,
    fetch,
    Buffer,
    atob: globalThis.atob,
    btoa: globalThis.btoa,
    // Postman-compatible libraries
    _,
    moment,
    Ajv,
    // tv4 is a Postman legacy; expose Ajv under both names for compatibility
    tv4: null,
  });

  const wrappedScript = `(async () => { ${script} })()`;

  try {
    const scriptObj = new vm.Script(wrappedScript, { filename: event });
    await scriptObj.runInContext(sandbox);
  } catch (err) {
    // Uncaught errors in the script are reported as a failed test.
    const { tests, mutations } = collectResults();
    tests.push({ name: "(script error)", passed: false, error: err.message ?? String(err) });
    return { tests, mutations };
  }

  return collectResults();
}
