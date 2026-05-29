/**
 * Integration tests running every test script from the JSONPlaceholder fixture
 * through the real executor against mocked responses — no network, no Go binary.
 *
 * Each test mirrors the exact fixture script with realistic mock data so we can
 * confirm our pm implementation handles every pattern the fixture uses.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeAll } from "@jest/globals";
import { execute } from "../executor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, "../../../fixtures");

// ── Load fixtures ─────────────────────────────────────────────────────────────

let collection, environment;

beforeAll(() => {
  collection = JSON.parse(readFileSync(`${FIXTURES}/jsonplaceholder.postman_collection.json`, "utf8"));
  environment = JSON.parse(readFileSync(`${FIXTURES}/jsonplaceholder.postman_environment.json`, "utf8"));
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function envVars() {
  // Build a key→value map from the environment fixture (currentValue || value).
  const env = {};
  for (const v of environment.values ?? []) {
    if (v.enabled !== false) env[v.key] = v.currentValue ?? v.value ?? "";
  }
  return env;
}

function makeCtx(responseCode, responseBody, extraEnv = {}) {
  const statusTexts = { 200: "OK", 201: "Created", 204: "No Content", 400: "Bad Request", 404: "Not Found", 500: "Internal Server Error" };
  return {
    globals: {},
    environment: { ...envVars(), ...extraEnv },
    collectionVariables: {},
    iterationData: {},
    request: { url: "https://jsonplaceholder.typicode.com", method: "GET", headers: {}, body: null },
    info: { eventName: "test", iteration: 0, iterationCount: 1, requestName: "test", requestId: "r1" },
    response: {
      status: statusTexts[responseCode] ?? String(responseCode),
      code: responseCode,
      responseTime: 42,
      responseSize: JSON.stringify(responseBody).length,
      headers: { "content-type": "application/json; charset=utf-8" },
      cookies: {},
      body: JSON.stringify(responseBody),
    },
  };
}

/** Find a request by name anywhere in the item tree. */
function findRequest(name, items = collection.item) {
  for (const item of items) {
    if (item.item) {
      const found = findRequest(name, item.item);
      if (found) return found;
    } else if (item.name === name) return item;
  }
  return null;
}

/** Extract the test script for a request. */
function testScript(requestName) {
  const req = findRequest(requestName);
  if (!req) throw new Error(`Request '${requestName}' not found in fixture`);
  const ev = req.event?.find(e => e.listen === "test");
  if (!ev) throw new Error(`No test event on '${requestName}'`);
  return ev.script.exec.join("\n");
}

async function runScript(requestName, code, body, extraEnv = {}) {
  const script = testScript(requestName);
  const ctx = makeCtx(code, body, extraEnv);
  return execute(script, "test", ctx);
}

function assertAllPass(results) {
  const failures = results.tests.filter(t => !t.passed);
  if (failures.length > 0) {
    throw new Error(`Failing tests:\n${failures.map(t => `  - ${t.name}: ${t.error}`).join("\n")}`);
  }
  return results;
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const POST = { id: 1, userId: 1, title: "sunt aut facere repellat", body: "quia et suscipit" };
const POSTS = Array.from({ length: 5 }, (_, i) => ({ ...POST, id: i + 1, title: `title ${i + 1}`, body: `body ${i + 1}` }));
const COMMENT = { id: 1, postId: 1, name: "id labore ex et quam laborum", email: "Eliseo@gardner.biz", body: "laudantium enim quasi" };
const COMMENTS = Array.from({ length: 3 }, (_, i) => ({ ...COMMENT, id: i + 1 }));
const USER = {
  id: 1, name: "Leanne Graham", username: "Bret", email: "Sincere@april.biz",
  address: { street: "Kulas Light", city: "Gwenborough", zipcode: "92998-3874", geo: { lat: "-37.3159", lng: "81.1496" } },
  phone: "1-770-736-0988 x56442", website: "hildegard.org",
  company: { name: "Romaguera-Crona", catchPhrase: "Multi-layered client-server neural-net", bs: "harness" },
};
const USERS = Array.from({ length: 3 }, (_, i) => ({ ...USER, id: i + 1 }));
const ALBUM = { id: 1, userId: 1, title: "quidem molestiae enim" };
const ALBUMS = Array.from({ length: 3 }, (_, i) => ({ ...ALBUM, id: i + 1 }));
const PHOTO = { id: 1, albumId: 1, title: "accusamus beatae ad facilis", url: "https://via.placeholder.com/600/92c952", thumbnailUrl: "https://via.placeholder.com/150/92c952" };
const PHOTOS = Array.from({ length: 3 }, (_, i) => ({ ...PHOTO, id: i + 1 }));

// ── Posts ─────────────────────────────────────────────────────────────────────

describe("fixture — GET List all posts", () => {
  it("all tests pass", async () => assertAllPass(await runScript("GET List all posts", 200, POSTS)));

  it("status test fails on 500", async () => {
    const result = await runScript("GET List all posts", 500, { error: "oops" });
    expect(result.tests.find(t => t.name === "Status 200").passed).toBe(false);
  });
});

describe("fixture — GET Get post by ID", () => {
  it("all tests pass", async () => assertAllPass(await runScript("GET Get post by ID", 200, POST)));

  it("schema test fails when field is missing", async () => {
    const result = await runScript("GET Get post by ID", 200, { id: 1, userId: 1 });
    expect(result.tests.find(t => t.name === "Post schema is valid").passed).toBe(false);
  });

  it("ID match test fails when IDs differ", async () => {
    const result = await runScript("GET Get post by ID", 200, { ...POST, id: 99 });
    expect(result.tests.find(t => t.name === "Post ID matches requested ID").passed).toBe(false);
  });
});

describe("fixture — GET Get post - Not Found", () => {
  it("all tests pass with a 404 empty object", async () =>
    assertAllPass(await runScript("GET Get post - Not Found", 404, {})));

  it("status test fails on 200", async () => {
    const result = await runScript("GET Get post - Not Found", 200, {});
    expect(result.tests.find(t => t.name === "Status 404").passed).toBe(false);
  });
});

describe("fixture — POST Create post", () => {
  const body = { id: 101, title: "Test post title", body: "Test post body content", userId: 1 };

  it("all tests pass", async () => assertAllPass(await runScript("POST Create post", 201, body)));

  it("created_post_id is set in environment mutations", async () => {
    const script = testScript("POST Create post");
    const ctx = makeCtx(201, body);
    const result = await execute(script, "test", ctx);
    expect(result.mutations.environment.created_post_id).toBe("101");
  });
});

describe("fixture — PUT Update post", () => {
  const body = { id: 1, title: "Updated title", body: "Updated body content", userId: 1 };
  it("all tests pass", async () => assertAllPass(await runScript("PUT Update post", 200, body)));
});

describe("fixture — PATCH Partial update post", () => {
  const body = { id: 1, title: "Patched title only", body: "original body", userId: 1 };
  it("all tests pass", async () => assertAllPass(await runScript("PATCH Partial update post", 200, body)));
});

describe("fixture — DELETE Delete post", () => {
  it("all tests pass", async () =>
    assertAllPass(await runScript("DELETE Delete post", 200, {}, { created_post_id: "1" })));

  it("created_post_id is unset in environment mutations", async () => {
    const script = testScript("DELETE Delete post");
    const ctx = makeCtx(200, {}, { created_post_id: "1" });
    const result = await execute(script, "test", ctx);
    // After unset(), the key is deleted — get() returns undefined
    expect(result.mutations.environment.created_post_id).toBeUndefined();
  });
});

// ── Comments ──────────────────────────────────────────────────────────────────

describe("fixture — GET Comments for post (nested route)", () => {
  it("all tests pass", async () => assertAllPass(await runScript("GET Comments for post (nested route)", 200, COMMENTS)));

  it("fails when a comment belongs to wrong postId", async () => {
    const wrong = COMMENTS.map(c => ({ ...c, postId: 99 }));
    const result = await runScript("GET Comments for post (nested route)", 200, wrong);
    expect(result.tests.find(t => t.name === "All comments belong to the requested post").passed).toBe(false);
  });
});

describe("fixture — GET Filter comments by postId", () => {
  it("all tests pass", async () =>
    assertAllPass(await runScript("GET Filter comments by postId", 200, COMMENTS)));

  it("email regex test fails on invalid email", async () => {
    const bad = COMMENTS.map(c => ({ ...c, email: "not-an-email" }));
    const result = await runScript("GET Filter comments by postId", 200, bad);
    expect(result.tests.find(t => t.name === "Email fields have a valid format").passed).toBe(false);
  });
});

// ── Users ─────────────────────────────────────────────────────────────────────

describe("fixture — GET List all users", () => {
  it("all tests pass", async () => assertAllPass(await runScript("GET List all users", 200, USERS)));
});

describe("fixture — GET Get user by ID", () => {
  it("all tests pass", async () => assertAllPass(await runScript("GET Get user by ID", 200, USER)));

  it("address structure test fails when geo is missing", async () => {
    const bad = { ...USER, address: { street: "x", city: "y", zipcode: "z" } };
    const result = await runScript("GET Get user by ID", 200, bad);
    expect(result.tests.find(t => t.name === "Address has expected structure").passed).toBe(false);
  });
});

describe("fixture — GET User posts (nested route)", () => {
  it("all tests pass", async () =>
    assertAllPass(await runScript("GET User posts (nested route)", 200, POSTS)));

  it("fails when posts belong to wrong user", async () => {
    const wrong = POSTS.map(p => ({ ...p, userId: 99 }));
    const result = await runScript("GET User posts (nested route)", 200, wrong);
    expect(result.tests.find(t => t.name === "All posts belong to the requested user").passed).toBe(false);
  });
});

// ── Albums & Photos ───────────────────────────────────────────────────────────

describe("fixture — GET Album photos (nested route)", () => {
  it("all tests pass", async () => assertAllPass(await runScript("GET Album photos (nested route)", 200, PHOTOS)));

  it("fails when photos belong to wrong album", async () => {
    const wrong = PHOTOS.map(p => ({ ...p, albumId: 99 }));
    const result = await runScript("GET Album photos (nested route)", 200, wrong);
    expect(result.tests.find(t => t.name === "All photos belong to the requested album").passed).toBe(false);
  });
});

describe("fixture — GET User albums (nested route)", () => {
  it("all tests pass", async () => assertAllPass(await runScript("GET User albums (nested route)", 200, ALBUMS)));

  it("fails when albums belong to wrong user", async () => {
    const wrong = ALBUMS.map(a => ({ ...a, userId: 99 }));
    const result = await runScript("GET User albums (nested route)", 200, wrong);
    expect(result.tests.find(t => t.name === "All albums belong to the requested user").passed).toBe(false);
  });
});
