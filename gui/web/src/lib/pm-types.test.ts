import { describe, expect, it } from "vitest"
import { PM_SANDBOX_TYPES } from "./pm-types"

describe("PM_SANDBOX_TYPES", () => {
  it("is a non-empty string", () => {
    expect(typeof PM_SANDBOX_TYPES).toBe("string")
    expect(PM_SANDBOX_TYPES.length).toBeGreaterThan(0)
  })

  // pm top-level object
  it("declares pm as a const", () => {
    expect(PM_SANDBOX_TYPES).toContain("declare const pm")
  })

  // Variable scopes
  it("declares pm.variables", () => {
    expect(PM_SANDBOX_TYPES).toContain("variables:")
    expect(PM_SANDBOX_TYPES).toContain("PmVariables")
  })

  it("declares pm.globals", () => {
    expect(PM_SANDBOX_TYPES).toContain("globals:")
  })

  it("declares pm.environment", () => {
    expect(PM_SANDBOX_TYPES).toContain("environment:")
    expect(PM_SANDBOX_TYPES).toContain("PmEnvironment")
  })

  it("declares pm.collectionVariables", () => {
    expect(PM_SANDBOX_TYPES).toContain("collectionVariables:")
  })

  it("declares pm.iterationData", () => {
    expect(PM_SANDBOX_TYPES).toContain("iterationData:")
    expect(PM_SANDBOX_TYPES).toContain("PmIterationData")
  })

  // Request / response
  it("declares pm.request with url, method, headers", () => {
    expect(PM_SANDBOX_TYPES).toContain("request:")
    expect(PM_SANDBOX_TYPES).toContain("PmRequest")
    expect(PM_SANDBOX_TYPES).toContain("url:")
    expect(PM_SANDBOX_TYPES).toContain("method:")
    expect(PM_SANDBOX_TYPES).toContain("headers:")
  })

  it("declares pm.response with status, code, json(), text()", () => {
    expect(PM_SANDBOX_TYPES).toContain("response:")
    expect(PM_SANDBOX_TYPES).toContain("PmResponse")
    expect(PM_SANDBOX_TYPES).toContain("status:")
    expect(PM_SANDBOX_TYPES).toContain("code:")
    expect(PM_SANDBOX_TYPES).toContain("json(): unknown")
    expect(PM_SANDBOX_TYPES).toContain("text(): string")
  })

  it("declares pm.cookies", () => {
    expect(PM_SANDBOX_TYPES).toContain("cookies:")
    expect(PM_SANDBOX_TYPES).toContain("PmCookieList")
  })

  // Actions
  it("declares pm.sendRequest", () => {
    expect(PM_SANDBOX_TYPES).toContain("sendRequest(")
  })

  it("declares pm.info with eventName, iteration, requestName", () => {
    expect(PM_SANDBOX_TYPES).toContain("info:")
    expect(PM_SANDBOX_TYPES).toContain("PmInfo")
    expect(PM_SANDBOX_TYPES).toContain("eventName:")
    expect(PM_SANDBOX_TYPES).toContain("iteration:")
    expect(PM_SANDBOX_TYPES).toContain("requestName:")
  })

  it("declares pm.test()", () => {
    expect(PM_SANDBOX_TYPES).toContain("test(testName: string")
  })

  it("declares pm.expect() returning ChaiAssertion", () => {
    expect(PM_SANDBOX_TYPES).toContain("expect(value: unknown): ChaiAssertion")
  })

  it("declares pm.execution with skipRequest and setNextRequest", () => {
    expect(PM_SANDBOX_TYPES).toContain("execution:")
    expect(PM_SANDBOX_TYPES).toContain("PmExecution")
    expect(PM_SANDBOX_TYPES).toContain("skipRequest()")
    expect(PM_SANDBOX_TYPES).toContain("setNextRequest(")
  })

  it("declares pm.visualizer.set()", () => {
    expect(PM_SANDBOX_TYPES).toContain("visualizer:")
    expect(PM_SANDBOX_TYPES).toContain("PmVisualizer")
    expect(PM_SANDBOX_TYPES).toContain("set(template: string")
  })

  // Chai assertion chain
  it("declares ChaiAssertion with core methods", () => {
    expect(PM_SANDBOX_TYPES).toContain("interface ChaiAssertion")
    expect(PM_SANDBOX_TYPES).toContain("equal(val: unknown")
    expect(PM_SANDBOX_TYPES).toContain("include(val: unknown")
    expect(PM_SANDBOX_TYPES).toContain("above(val: number")
    expect(PM_SANDBOX_TYPES).toContain("below(val: number")
    expect(PM_SANDBOX_TYPES).toContain("match(re: RegExp")
    expect(PM_SANDBOX_TYPES).toContain("not:")
    expect(PM_SANDBOX_TYPES).toContain("deep:")
    expect(PM_SANDBOX_TYPES).toContain("ok:")
    expect(PM_SANDBOX_TYPES).toContain("status(code: number)")
  })

  // Sandbox globals
  it("declares _ (lodash) with map, filter, find", () => {
    expect(PM_SANDBOX_TYPES).toContain("declare const _:")
    expect(PM_SANDBOX_TYPES).toContain("map<T, R>")
    expect(PM_SANDBOX_TYPES).toContain("filter<T>")
    expect(PM_SANDBOX_TYPES).toContain("find<T>")
  })

  it("declares moment with format and add", () => {
    expect(PM_SANDBOX_TYPES).toContain("declare const moment:")
    expect(PM_SANDBOX_TYPES).toContain("format(fmt?: string)")
    expect(PM_SANDBOX_TYPES).toContain("add(amount: number")
  })

  it("declares xml2Json", () => {
    expect(PM_SANDBOX_TYPES).toContain("declare function xml2Json")
  })

  // PmVariableScope interface must have get/set/unset/clear/has
  it("PmVariableScope interface has get, set, unset, clear, has", () => {
    expect(PM_SANDBOX_TYPES).toContain("interface PmVariableScope")
    expect(PM_SANDBOX_TYPES).toContain("get(key: string): string | undefined")
    expect(PM_SANDBOX_TYPES).toContain("set(key: string, value: string): void")
    expect(PM_SANDBOX_TYPES).toContain("unset(key: string): void")
    expect(PM_SANDBOX_TYPES).toContain("clear(): void")
    expect(PM_SANDBOX_TYPES).toContain("has(key: string): boolean")
  })

  // PmUrl interface
  it("PmUrl interface has toString, getHost, getPath", () => {
    expect(PM_SANDBOX_TYPES).toContain("interface PmUrl")
    expect(PM_SANDBOX_TYPES).toContain("toString(): string")
    expect(PM_SANDBOX_TYPES).toContain("getHost(): string")
    expect(PM_SANDBOX_TYPES).toContain("getPath(): string")
  })
})
