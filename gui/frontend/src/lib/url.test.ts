import { describe, expect, it } from "vitest"
import { assembleUrl, mergeParams, parseUrl } from "./url"
import type { KeyValueItem } from "@/store/tabs"

function item(id: string, key: string, value: string, enabled = true): KeyValueItem {
  return { id, key, value, enabled }
}

describe("assembleUrl", () => {
  it("returns base unchanged when no params", () => {
    expect(assembleUrl("https://api.example.com", [])).toBe("https://api.example.com")
  })

  it("returns base unchanged when base is empty", () => {
    expect(assembleUrl("", [item("1", "page", "1")])).toBe("")
  })

  it("appends enabled params as query string", () => {
    const params = [item("1", "page", "1"), item("2", "limit", "10")]
    expect(assembleUrl("https://api.example.com/users", params)).toBe(
      "https://api.example.com/users?page=1&limit=10",
    )
  })

  it("skips disabled params", () => {
    const params = [item("1", "page", "1"), item("2", "debug", "true", false)]
    expect(assembleUrl("https://api.example.com", params)).toBe("https://api.example.com?page=1")
  })

  it("skips params with empty key", () => {
    const params = [item("1", "", "orphan"), item("2", "q", "hello")]
    expect(assembleUrl("https://api.example.com/search", params)).toBe(
      "https://api.example.com/search?q=hello",
    )
  })

  it("encodes special characters in keys and values", () => {
    const params = [item("1", "q", "hello world")]
    expect(assembleUrl("https://api.example.com", params)).toBe(
      "https://api.example.com?q=hello%20world",
    )
  })
})

describe("parseUrl", () => {
  it("returns empty params when no query string", () => {
    expect(parseUrl("https://api.example.com/users")).toEqual({
      base: "https://api.example.com/users",
      params: [],
    })
  })

  it("parses query string into key-value pairs", () => {
    const { base, params } = parseUrl("https://api.example.com?page=1&limit=10")
    expect(base).toBe("https://api.example.com")
    expect(params).toEqual([
      { key: "page", value: "1" },
      { key: "limit", value: "10" },
    ])
  })

  it("handles param with no value", () => {
    const { params } = parseUrl("https://api.example.com?flag")
    expect(params).toEqual([{ key: "flag", value: "" }])
  })

  it("decodes encoded characters", () => {
    const { params } = parseUrl("https://api.example.com?q=hello%20world")
    expect(params).toEqual([{ key: "q", value: "hello world" }])
  })

  it("handles empty string", () => {
    expect(parseUrl("")).toEqual({ base: "", params: [] })
  })
})

describe("mergeParams", () => {
  it("creates new items for params not in existing list", () => {
    const result = mergeParams([], [{ key: "page", value: "1" }])
    expect(result).toHaveLength(1)
    expect(result[0].key).toBe("page")
    expect(result[0].value).toBe("1")
    expect(result[0].enabled).toBe(true)
  })

  it("updates value of matching enabled existing item", () => {
    const existing = [item("id1", "page", "1")]
    const result = mergeParams(existing, [{ key: "page", value: "2" }])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("id1")
    expect(result[0].value).toBe("2")
  })

  it("preserves disabled items at the end", () => {
    const existing = [item("d1", "debug", "true", false)]
    const result = mergeParams(existing, [{ key: "page", value: "1" }])
    expect(result).toHaveLength(2)
    expect(result[0].key).toBe("page")
    expect(result[1].id).toBe("d1")
    expect(result[1].enabled).toBe(false)
  })

  it("does not reuse the same existing item for duplicate keys", () => {
    const existing = [item("id1", "tag", "a")]
    const result = mergeParams(existing, [
      { key: "tag", value: "a" },
      { key: "tag", value: "b" },
    ])
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe("id1")
    expect(result[1].id).not.toBe("id1")
  })

  it("returns empty array for empty inputs", () => {
    expect(mergeParams([], [])).toEqual([])
  })
})
