import { describe, expect, it } from "vitest"
import { assembleUrl, extractPathVarNames, mergeParams, mergePathVars, parseUrl } from "./url"
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

describe("extractPathVarNames", () => {
  it("returns empty array for URL with no path vars", () => {
    expect(extractPathVarNames("https://api.example.com/users")).toEqual([])
  })

  it("extracts :param style variables from the path", () => {
    expect(extractPathVarNames("https://api.example.com/users/:userId")).toEqual(["userId"])
  })

  it("extracts multiple :param variables", () => {
    expect(extractPathVarNames("https://api.example.com/users/:userId/posts/:postId")).toEqual([
      "userId",
      "postId",
    ])
  })

  it("extracts {{param}} style variables from the path", () => {
    expect(extractPathVarNames("https://api.example.com/users/{{id}}")).toEqual(["id"])
  })

  it("extracts both :param and {{param}} styles", () => {
    expect(extractPathVarNames("https://api.example.com/:a/{{b}}")).toEqual(["a", "b"])
  })

  it("deduplicates repeated variable names", () => {
    expect(extractPathVarNames("https://api.example.com/:id/sub/:id")).toEqual(["id"])
  })

  it("ignores :param patterns in the query string", () => {
    expect(extractPathVarNames("https://api.example.com/users?:notavar=1")).toEqual([])
  })

  it("returns empty array for empty url", () => {
    expect(extractPathVarNames("")).toEqual([])
  })
})

describe("mergePathVars", () => {
  it("creates a new item for a name not in the existing list", () => {
    const result = mergePathVars([], ["id"])
    expect(result).toHaveLength(1)
    expect(result[0].key).toBe("id")
    expect(result[0].value).toBe("")
    expect(result[0].enabled).toBe(true)
  })

  it("preserves existing value and id when name matches", () => {
    const existing: KeyValueItem[] = [{ id: "x", key: "id", value: "42", enabled: true }]
    const result = mergePathVars(existing, ["id"])
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe("x")
    expect(result[0].value).toBe("42")
  })

  it("removes items no longer present in the names list", () => {
    const existing: KeyValueItem[] = [{ id: "x", key: "old", value: "v", enabled: true }]
    const result = mergePathVars(existing, ["new"])
    expect(result).toHaveLength(1)
    expect(result[0].key).toBe("new")
  })

  it("returns empty array when names is empty", () => {
    expect(mergePathVars([], [])).toEqual([])
  })

  it("preserves order of names list", () => {
    const existing: KeyValueItem[] = [
      { id: "b", key: "b", value: "2", enabled: true },
      { id: "a", key: "a", value: "1", enabled: true },
    ]
    const result = mergePathVars(existing, ["a", "b"])
    expect(result[0].key).toBe("a")
    expect(result[1].key).toBe("b")
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
