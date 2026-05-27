/**
 * TypeScript ambient declarations for the Postman sandbox `pm` object.
 *
 * Injected into Monaco's JavaScript language service via addExtraLib so that
 * every script editor gets full IntelliSense on `pm.*` without any runtime
 * overhead — the string is never executed, only read by the TS compiler.
 *
 * Coverage: SPEC-POSTMAN.md section 5.2 + sandbox globals (_, moment, xml2Json).
 */
export const PM_SANDBOX_TYPES = `
// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

interface PmHeaderList {
  get(key: string): string | undefined;
  has(key: string): boolean;
  toObject(): Record<string, string>;
  add(header: { key: string; value: string }): void;
  upsert(header: { key: string; value: string }): void;
  remove(key: string): void;
  each(fn: (header: { key: string; value: string }) => void): void;
  count(): number;
  members: Array<{ key: string; value: string }>;
}

interface PmVariableScope {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  unset(key: string): void;
  clear(): void;
  has(key: string): boolean;
  toObject(): Record<string, string>;
  replaceIn(template: string): string;
}

interface PmEnvironment extends PmVariableScope {
  /** Name of the currently active environment. */
  name: string;
}

interface PmVariables extends PmVariableScope {
  /** Returns all variables from all scopes merged (Local > Data > Env > Collection > Global). */
  toObject(): Record<string, string>;
}

interface PmIterationData {
  get(key: string): string | undefined;
  has(key: string): boolean;
  toObject(): Record<string, string>;
}

interface PmUrl {
  toString(): string;
  getHost(): string;
  getPath(): string;
  getPathWithQuery(): string;
  getQueryString(): string;
  getRemote(): string;
  toJSON(): Record<string, unknown>;
}

interface PmRequestBody {
  mode: "raw" | "urlencoded" | "formdata" | "file" | "graphql";
  raw?: string;
  urlencoded?: Array<{ key: string; value: string; disabled?: boolean }>;
  formdata?: Array<{ key: string; value: string; type?: string; disabled?: boolean }>;
  graphql?: { query: string; variables?: string };
}

interface PmRequest {
  url: PmUrl;
  method: string;
  headers: PmHeaderList;
  body?: PmRequestBody;
  /** Adds or replaces a request header before send. Only available in Pre-request Script. */
  addHeader(header: { key: string; value: string }): void;
  removeHeader(key: string): void;
}

interface PmCookieList {
  get(cookieName: string): string | undefined;
  has(cookieName: string): boolean;
  toObject(): Record<string, string>;
}

interface PmResponse {
  /** HTTP status text, e.g. "OK". */
  status: string;
  /** HTTP status code, e.g. 200. */
  code: number;
  /** Response time in milliseconds. */
  responseTime: number;
  /** Response body size in bytes. */
  responseSize: number;
  headers: PmHeaderList;
  cookies: PmCookieList;
  /** Returns the response body as a plain string. */
  text(): string;
  /** Parses and returns the response body as JSON. Throws if the body is not valid JSON. */
  json(): unknown;
}

interface PmSendRequest {
  url: string;
  method?: string;
  header?: Record<string, string> | Array<{ key: string; value: string }>;
  body?: {
    mode?: "raw" | "urlencoded" | "formdata";
    raw?: string;
    urlencoded?: Array<{ key: string; value: string }>;
    formdata?: Array<{ key: string; value: string }>;
  };
  auth?: {
    type: string;
    bearer?: [{ key: "token"; value: string }];
    basic?: [{ key: "username"; value: string }, { key: "password"; value: string }];
  };
}

interface PmInfo {
  /** "prerequest" or "test" depending on which script is running. */
  eventName: "prerequest" | "test";
  /** Current iteration index (0-based). */
  iteration: number;
  /** Total number of iterations in the current run. */
  iterationCount: number;
  /** Name of the current request. */
  requestName: string;
  /** Unique ID of the current request. */
  requestId: string;
}

interface PmExecution {
  /**
   * Skips sending the current request.
   * @only Available in Pre-request Script only.
   */
  skipRequest(): void;
  /**
   * Sets the next request to execute by name, or null to stop execution.
   * Pass null to stop the collection run after this request.
   */
  setNextRequest(requestName: string | null): void;
}

interface PmVisualizer {
  /**
   * Sets a Handlebars template and optional data for the Visualize tab.
   * @only Available in Tests script only.
   */
  set(template: string, data?: Record<string, unknown>, options?: { printWidth?: number }): void;
  clear(): void;
}

// ---------------------------------------------------------------------------
// Chai assertion chain (used by pm.expect)
// ---------------------------------------------------------------------------

interface ChaiAssertion {
  // Chainable language words
  to: ChaiAssertion;
  be: ChaiAssertion;
  been: ChaiAssertion;
  is: ChaiAssertion;
  that: ChaiAssertion;
  which: ChaiAssertion;
  and: ChaiAssertion;
  has: ChaiAssertion;
  have: ChaiAssertion;
  with: ChaiAssertion;
  at: ChaiAssertion;
  of: ChaiAssertion;
  same: ChaiAssertion;
  but: ChaiAssertion;
  does: ChaiAssertion;
  still: ChaiAssertion;
  also: ChaiAssertion;
  // Negation
  not: ChaiAssertion;
  // Deep equality modifier
  deep: ChaiAssertion;
  nested: ChaiAssertion;
  own: ChaiAssertion;
  // Flag assertions
  ok: ChaiAssertion;
  true: ChaiAssertion;
  false: ChaiAssertion;
  null: ChaiAssertion;
  undefined: ChaiAssertion;
  NaN: ChaiAssertion;
  exist: ChaiAssertion;
  empty: ChaiAssertion;
  arguments: ChaiAssertion;
  extensible: ChaiAssertion;
  sealed: ChaiAssertion;
  frozen: ChaiAssertion;
  finite: ChaiAssertion;
  // Comparison
  equal(val: unknown, msg?: string): ChaiAssertion;
  equals(val: unknown, msg?: string): ChaiAssertion;
  eql(val: unknown, msg?: string): ChaiAssertion;
  eqls(val: unknown, msg?: string): ChaiAssertion;
  above(val: number, msg?: string): ChaiAssertion;
  greaterThan(val: number, msg?: string): ChaiAssertion;
  below(val: number, msg?: string): ChaiAssertion;
  lessThan(val: number, msg?: string): ChaiAssertion;
  least(val: number, msg?: string): ChaiAssertion;
  gte(val: number, msg?: string): ChaiAssertion;
  most(val: number, msg?: string): ChaiAssertion;
  lte(val: number, msg?: string): ChaiAssertion;
  within(start: number, finish: number, msg?: string): ChaiAssertion;
  closeTo(expected: number, delta: number, msg?: string): ChaiAssertion;
  // Inclusion
  include(val: unknown, msg?: string): ChaiAssertion;
  includes(val: unknown, msg?: string): ChaiAssertion;
  contain(val: unknown, msg?: string): ChaiAssertion;
  contains(val: unknown, msg?: string): ChaiAssertion;
  // Type
  a(type: string, msg?: string): ChaiAssertion;
  an(type: string, msg?: string): ChaiAssertion;
  instanceof(constructor: Function, msg?: string): ChaiAssertion;
  instanceOf(constructor: Function, msg?: string): ChaiAssertion;
  // Properties
  property(name: string, val?: unknown, msg?: string): ChaiAssertion;
  haveOwnProperty(name: string, msg?: string): ChaiAssertion;
  keys(...keys: string[]): ChaiAssertion;
  key(key: string): ChaiAssertion;
  // String
  match(re: RegExp, msg?: string): ChaiAssertion;
  matches(re: RegExp, msg?: string): ChaiAssertion;
  string(str: string, msg?: string): ChaiAssertion;
  // Length
  lengthOf(val: number, msg?: string): ChaiAssertion;
  length: ChaiAssertion;
  // Response helpers (Postman-specific extensions on Chai)
  status(code: number): ChaiAssertion;
  header(key: string, val?: string): ChaiAssertion;
  json: ChaiAssertion;
  body: ChaiAssertion;
  withBody: ChaiAssertion;
  // Array / object
  members(set: unknown[], msg?: string): ChaiAssertion;
  oneOf(list: unknown[], msg?: string): ChaiAssertion;
  any: ChaiAssertion;
  all: ChaiAssertion;
  // Functions
  throw(errorLike?: unknown, errMsgMatcher?: unknown, msg?: string): ChaiAssertion;
  throws(errorLike?: unknown, errMsgMatcher?: unknown, msg?: string): ChaiAssertion;
  respondTo(method: string, msg?: string): ChaiAssertion;
  satisfy(matcher: (val: unknown) => boolean, msg?: string): ChaiAssertion;
  satisfies(matcher: (val: unknown) => boolean, msg?: string): ChaiAssertion;
  // Misc
  change(obj: object, prop: string, msg?: string): ChaiAssertion;
  increase(obj: object, prop: string, msg?: string): ChaiAssertion;
  decrease(obj: object, prop: string, msg?: string): ChaiAssertion;
}

// ---------------------------------------------------------------------------
// pm global
// ---------------------------------------------------------------------------

declare const pm: {
  /** Read-only access to variables across all scopes (Local > Data > Env > Collection > Global). */
  variables: PmVariables;
  /** Global variables shared across all collections and environments. */
  globals: PmVariableScope;
  /** Variables scoped to the currently active environment. */
  environment: PmEnvironment;
  /** Variables scoped to the current collection. */
  collectionVariables: PmVariableScope;
  /** Iteration data from a CSV or JSON data file (read-only). */
  iterationData: PmIterationData;
  /** The outgoing request. Modify in Pre-request Script to change what is sent. */
  request: PmRequest;
  /**
   * The received response.
   * @only Available in Tests script only.
   */
  response: PmResponse;
  /**
   * Cookie jar for the current domain.
   * @only Available in Tests script only.
   */
  cookies: PmCookieList;
  /**
   * Sends an HTTP request from within a script.
   * @example
   * pm.sendRequest("https://api.example.com/token", (err, res) => {
   *   pm.environment.set("token", res.json().access_token);
   * });
   */
  sendRequest(
    request: string | PmSendRequest,
    callback: (err: Error | null, response: PmResponse) => void,
  ): void;
  /** Metadata about the current script execution context. */
  info: PmInfo;
  /**
   * Defines a named test assertion.
   * @only Available in Tests script only.
   * @example pm.test("Status is 200", () => { pm.expect(pm.response.code).to.equal(200); });
   */
  test(testName: string, fn: () => void): void;
  /**
   * Returns a Chai assertion object for the given value.
   * @only Available in Tests script only.
   * @example pm.expect(pm.response.code).to.be.oneOf([200, 201]);
   */
  expect(value: unknown): ChaiAssertion;
  /** Script execution controls. */
  execution: PmExecution;
  /**
   * Controls the Visualize tab rendering.
   * @only Available in Tests script only.
   */
  visualizer: PmVisualizer;
};

// ---------------------------------------------------------------------------
// Sandbox globals (lodash, moment, xml2Json)
// ---------------------------------------------------------------------------

/** Lodash utility library (subset — use \`_.chain\`, \`_.map\`, \`_.filter\`, etc.) */
declare const _: {
  chain(value: unknown): unknown;
  map<T, R>(collection: T[], fn: (val: T, idx: number) => R): R[];
  filter<T>(collection: T[], predicate: (val: T) => boolean): T[];
  find<T>(collection: T[], predicate: (val: T) => boolean): T | undefined;
  each<T>(collection: T[], fn: (val: T, idx: number) => void): void;
  forEach<T>(collection: T[], fn: (val: T, idx: number) => void): void;
  reduce<T, R>(collection: T[], fn: (acc: R, val: T) => R, initial: R): R;
  pick(obj: object, ...keys: string[]): object;
  omit(obj: object, ...keys: string[]): object;
  merge<T extends object>(target: T, ...sources: object[]): T;
  cloneDeep<T>(value: T): T;
  isEqual(a: unknown, b: unknown): boolean;
  isEmpty(value: unknown): boolean;
  isNil(value: unknown): boolean;
  isString(value: unknown): value is string;
  isNumber(value: unknown): value is number;
  isArray(value: unknown): value is unknown[];
  isObject(value: unknown): boolean;
  isFunction(value: unknown): value is Function;
  get(obj: object, path: string, defaultValue?: unknown): unknown;
  set(obj: object, path: string, value: unknown): object;
  has(obj: object, path: string): boolean;
  keys(obj: object): string[];
  values(obj: object): unknown[];
  entries(obj: object): Array<[string, unknown]>;
  uniq<T>(array: T[]): T[];
  flatten<T>(array: (T | T[])[]): T[];
  flatMap<T, R>(collection: T[], fn: (val: T) => R | R[]): R[];
  sortBy<T>(collection: T[], ...iteratees: Array<string | ((val: T) => unknown)>): T[];
  groupBy<T>(collection: T[], key: string | ((val: T) => string)): Record<string, T[]>;
  orderBy<T>(collection: T[], iteratees: string[], orders: Array<"asc" | "desc">): T[];
  chunk<T>(array: T[], size: number): T[][];
  difference<T>(array: T[], ...values: T[][]): T[];
  intersection<T>(...arrays: T[][]): T[];
  union<T>(...arrays: T[][]): T[];
  includes<T>(collection: T[] | string, value: T, fromIndex?: number): boolean;
  indexOf<T>(array: T[], value: T): number;
  last<T>(array: T[]): T | undefined;
  first<T>(array: T[]): T | undefined;
  head<T>(array: T[]): T | undefined;
  tail<T>(array: T[]): T[];
  take<T>(array: T[], n?: number): T[];
  drop<T>(array: T[], n?: number): T[];
  compact<T>(array: (T | null | undefined | false | 0 | "")[]): T[];
  without<T>(array: T[], ...values: T[]): T[];
  trim(str?: string): string;
  trimStart(str?: string): string;
  trimEnd(str?: string): string;
  toLower(str?: string): string;
  toUpper(str?: string): string;
  capitalize(str?: string): string;
  startsWith(str: string, target: string): boolean;
  endsWith(str: string, target: string): boolean;
  padStart(str: string, length: number, chars?: string): string;
  padEnd(str: string, length: number, chars?: string): string;
  repeat(str: string, n: number): string;
  replace(str: string, pattern: string | RegExp, replacement: string): string;
  split(str: string, separator: string | RegExp, limit?: number): string[];
  parseInt(str: string, radix?: number): number;
  toNumber(value: unknown): number;
  toString(value: unknown): string;
  toArray(value: unknown): unknown[];
  size(value: unknown): number;
  max(array: number[]): number | undefined;
  min(array: number[]): number | undefined;
  sum(array: number[]): number;
  mean(array: number[]): number;
  round(n: number, precision?: number): number;
  floor(n: number, precision?: number): number;
  ceil(n: number, precision?: number): number;
  random(lower?: number, upper?: number, floating?: boolean): number;
  now(): number;
  debounce<T extends (...args: unknown[]) => unknown>(fn: T, wait?: number): T;
  throttle<T extends (...args: unknown[]) => unknown>(fn: T, wait?: number): T;
  once<T extends (...args: unknown[]) => unknown>(fn: T): T;
  memoize<T extends (...args: unknown[]) => unknown>(fn: T): T;
  noop(): void;
  identity<T>(value: T): T;
  constant<T>(value: T): () => T;
  times<T>(n: number, fn: (idx: number) => T): T[];
  range(start: number, end?: number, step?: number): number[];
  template(str: string): (data: Record<string, unknown>) => string;
};

/** moment.js — date/time parsing and manipulation. */
declare const moment: {
  (date?: string | number | Date | null): MomentInstance;
  utc(date?: string | number | Date | null): MomentInstance;
  unix(timestamp: number): MomentInstance;
  duration(amount: number, unit?: string): MomentDuration;
  isMoment(obj: unknown): boolean;
  isDate(obj: unknown): boolean;
};

interface MomentInstance {
  format(fmt?: string): string;
  valueOf(): number;
  toDate(): Date;
  toISOString(): string;
  add(amount: number, unit: string): MomentInstance;
  subtract(amount: number, unit: string): MomentInstance;
  startOf(unit: string): MomentInstance;
  endOf(unit: string): MomentInstance;
  isBefore(other: MomentInstance | string | Date): boolean;
  isAfter(other: MomentInstance | string | Date): boolean;
  isSame(other: MomentInstance | string | Date): boolean;
  diff(other: MomentInstance | string | Date, unit?: string): number;
  unix(): number;
  utc(): MomentInstance;
  local(): MomentInstance;
  clone(): MomentInstance;
  isValid(): boolean;
  year(val?: number): number | MomentInstance;
  month(val?: number): number | MomentInstance;
  date(val?: number): number | MomentInstance;
  hour(val?: number): number | MomentInstance;
  minute(val?: number): number | MomentInstance;
  second(val?: number): number | MomentInstance;
  millisecond(val?: number): number | MomentInstance;
}

interface MomentDuration {
  as(unit: string): number;
  valueOf(): number;
  humanize(suffix?: boolean): string;
}

/** Converts XML string to a JavaScript object. */
declare function xml2Json(xml: string): Record<string, unknown>;
` as const
