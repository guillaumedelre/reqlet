import { describe, it, expect, vi, beforeEach } from "vitest"
import { api } from "./api"
import type { Collection, Environment } from "@/types"

const mockFetch = vi.fn()
globalThis.fetch = mockFetch as typeof fetch

function okResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: true,
    status,
    json: () => Promise.resolve(body),
  } as Response)
}

function errorResponse(body: unknown, status = 404) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  } as Response)
}

function noContentResponse() {
  return Promise.resolve({
    ok: true,
    status: 204,
    json: () => Promise.resolve(null),
  } as Response)
}

beforeEach(() => {
  vi.clearAllMocks()
})

const sampleCollection: Collection = {
  id: "col-1",
  name: "Test",
  description: "",
  items: [],
  variables: [],
  preRequestScript: "",
  testScript: "",
  auth: { type: "none" },
}

const sampleEnvironment: Environment = {
  id: "env-1",
  name: "Dev",
  variables: [],
}

describe("api.collections", () => {
  it("list sends GET /api/collections", async () => {
    mockFetch.mockReturnValue(okResponse([sampleCollection]))
    const result = await api.collections.list()
    expect(mockFetch).toHaveBeenCalledWith("/api/collections", {
      method: "GET",
      headers: undefined,
      body: undefined,
    })
    expect(result).toEqual([sampleCollection])
  })

  it("create sends POST /api/collections with body", async () => {
    mockFetch.mockReturnValue(okResponse(sampleCollection, 201))
    const result = await api.collections.create(sampleCollection)
    expect(mockFetch).toHaveBeenCalledWith("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sampleCollection),
    })
    expect(result).toEqual(sampleCollection)
  })

  it("get sends GET /api/collections/:id", async () => {
    mockFetch.mockReturnValue(okResponse(sampleCollection))
    const result = await api.collections.get("col-1")
    expect(mockFetch).toHaveBeenCalledWith("/api/collections/col-1", {
      method: "GET",
      headers: undefined,
      body: undefined,
    })
    expect(result).toEqual(sampleCollection)
  })

  it("update sends PUT /api/collections/:id with body", async () => {
    mockFetch.mockReturnValue(okResponse(sampleCollection))
    const result = await api.collections.update("col-1", sampleCollection)
    expect(mockFetch).toHaveBeenCalledWith("/api/collections/col-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sampleCollection),
    })
    expect(result).toEqual(sampleCollection)
  })

  it("delete sends DELETE /api/collections/:id", async () => {
    mockFetch.mockReturnValue(noContentResponse())
    const result = await api.collections.delete("col-1")
    expect(mockFetch).toHaveBeenCalledWith("/api/collections/col-1", {
      method: "DELETE",
      headers: undefined,
      body: undefined,
    })
    expect(result).toBeUndefined()
  })

  it("throws on error response with server error message", async () => {
    mockFetch.mockReturnValue(errorResponse({ error: "not found", code: "not_found" }))
    await expect(api.collections.get("nonexistent")).rejects.toThrow("not found")
  })

  it("throws with fallback message when JSON parse fails", async () => {
    mockFetch.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("bad json")),
      } as Response),
    )
    await expect(api.collections.get("x")).rejects.toThrow("Request failed")
  })

  it("throws fallback message when error field is absent from response body", async () => {
    // error field missing → (err as ...).error is undefined → ?? "Request failed" branch
    mockFetch.mockReturnValue(errorResponse({ code: "bad_request" }))
    await expect(api.collections.get("x")).rejects.toThrow("Request failed")
  })
})

describe("api.environments", () => {
  it("list sends GET /api/environments", async () => {
    mockFetch.mockReturnValue(okResponse([sampleEnvironment]))
    const result = await api.environments.list()
    expect(mockFetch).toHaveBeenCalledWith("/api/environments", {
      method: "GET",
      headers: undefined,
      body: undefined,
    })
    expect(result).toEqual([sampleEnvironment])
  })

  it("create sends POST /api/environments with body", async () => {
    mockFetch.mockReturnValue(okResponse(sampleEnvironment, 201))
    const result = await api.environments.create(sampleEnvironment)
    expect(mockFetch).toHaveBeenCalledWith("/api/environments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sampleEnvironment),
    })
    expect(result).toEqual(sampleEnvironment)
  })

  it("get sends GET /api/environments/:id", async () => {
    mockFetch.mockReturnValue(okResponse(sampleEnvironment))
    await api.environments.get("env-1")
    expect(mockFetch).toHaveBeenCalledWith("/api/environments/env-1", expect.any(Object))
  })

  it("update sends PUT /api/environments/:id", async () => {
    mockFetch.mockReturnValue(okResponse(sampleEnvironment))
    await api.environments.update("env-1", sampleEnvironment)
    expect(mockFetch).toHaveBeenCalledWith("/api/environments/env-1", expect.any(Object))
  })

  it("delete sends DELETE /api/environments/:id", async () => {
    mockFetch.mockReturnValue(noContentResponse())
    await api.environments.delete("env-1")
    expect(mockFetch).toHaveBeenCalledWith("/api/environments/env-1", expect.any(Object))
  })
})
