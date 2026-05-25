import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";

// Mock executor before importing index so handleLine uses the mock.
const mockExecute = jest.fn();
jest.unstable_mockModule("../executor.js", () => ({ execute: mockExecute }));

const { handleLine, respond } = await import("../index.js");

describe("respond", () => {
  let output;

  beforeEach(() => {
    output = "";
    jest.spyOn(process.stdout, "write").mockImplementation((data) => {
      output += data;
      return true;
    });
  });

  afterEach(() => {
    process.stdout.write.mockRestore();
  });

  it("writes a JSON line to stdout", () => {
    respond("1", { ok: true }, null);
    expect(output).toBe(JSON.stringify({ id: "1", result: { ok: true }, error: null }) + "\n");
  });

  it("includes error field when provided", () => {
    respond("2", null, "something went wrong");
    const parsed = JSON.parse(output.trim());
    expect(parsed.error).toBe("something went wrong");
    expect(parsed.result).toBeNull();
  });
});

describe("handleLine", () => {
  let stdoutOutput;
  let stderrOutput;

  beforeEach(() => {
    stdoutOutput = "";
    stderrOutput = "";
    jest.spyOn(process.stdout, "write").mockImplementation((data) => {
      stdoutOutput += data;
      return true;
    });
    jest.spyOn(process.stderr, "write").mockImplementation((data) => {
      stderrOutput += data;
      return true;
    });
    mockExecute.mockReset();
  });

  afterEach(() => {
    process.stdout.write.mockRestore();
    process.stderr.write.mockRestore();
  });

  it("responds with error for unknown method", async () => {
    await handleLine(JSON.stringify({ id: "1", method: "unknown" }));
    const parsed = JSON.parse(stdoutOutput.trim());
    expect(parsed.id).toBe("1");
    expect(parsed.error).toMatch(/unknown method/);
  });

  it("writes to stderr for invalid JSON", async () => {
    await handleLine("not-json");
    expect(stderrOutput).toMatch(/invalid JSON/);
    expect(stdoutOutput).toBe("");
  });

  it("calls execute and responds with result for execute method", async () => {
    const fakeResult = { tests: [{ name: "ok", passed: true, error: null }], mutations: {} };
    mockExecute.mockResolvedValue(fakeResult);

    const msg = JSON.stringify({
      id: "42",
      method: "execute",
      params: { script: "pm.test('ok', () => {})", event: "test", context: {} },
    });
    await handleLine(msg);

    expect(mockExecute).toHaveBeenCalledWith(
      "pm.test('ok', () => {})",
      "test",
      {},
    );
    const parsed = JSON.parse(stdoutOutput.trim());
    expect(parsed.id).toBe("42");
    expect(parsed.error).toBeNull();
    expect(parsed.result.tests[0].name).toBe("ok");
  });

  it("responds with error if execute throws", async () => {
    mockExecute.mockRejectedValue(new Error("execution failed"));

    const msg = JSON.stringify({
      id: "99",
      method: "execute",
      params: { script: "", event: "prerequest", context: {} },
    });
    await handleLine(msg);

    const parsed = JSON.parse(stdoutOutput.trim());
    expect(parsed.id).toBe("99");
    expect(parsed.error).toBe("execution failed");
  });

  it("uses empty object as context when context is absent", async () => {
    mockExecute.mockResolvedValue({ tests: [], mutations: {} });

    await handleLine(
      JSON.stringify({ id: "5", method: "execute", params: { script: "", event: "test" } }),
    );

    expect(mockExecute).toHaveBeenCalledWith("", "test", {});
  });
});
