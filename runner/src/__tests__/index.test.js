import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";

// Mock executor before importing index so handleLine uses the mock.
const mockExecute = jest.fn();
jest.unstable_mockModule("../executor.js", () => ({ execute: mockExecute }));

const { handleLine, respond, processChunk, onEnd } = await import("../index.js");

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

describe("processChunk", () => {
  beforeEach(() => {
    jest.spyOn(process.stdout, "write").mockImplementation(() => true);
    mockExecute.mockReset();
  });

  afterEach(() => {
    process.stdout.write.mockRestore();
  });

  it("dispatches a single complete line and returns empty remaining buffer", async () => {
    const line = JSON.stringify({ id: "1", method: "execute", params: { script: "", event: "test", context: {} } });
    mockExecute.mockResolvedValue({ tests: [], mutations: {} });

    const remaining = processChunk("", line + "\n");

    expect(remaining).toBe("");
    // handleLine is async; wait for the microtask to settle
    await Promise.resolve();
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("skips empty and whitespace-only lines", () => {
    const remaining = processChunk("", "\n   \n\n");
    expect(remaining).toBe("");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("returns a partial line as remaining buffer without dispatching", () => {
    const remaining = processChunk("", "partial");
    expect(remaining).toBe("partial");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("dispatches multiple complete lines in one chunk", async () => {
    const line = JSON.stringify({ id: "x", method: "execute", params: { script: "", event: "test", context: {} } });
    mockExecute.mockResolvedValue({ tests: [], mutations: {} });

    const remaining = processChunk("", line + "\n" + line + "\n");

    expect(remaining).toBe("");
    await Promise.resolve();
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it("accumulates partial lines across two calls", async () => {
    mockExecute.mockResolvedValue({ tests: [], mutations: {} });
    const line = JSON.stringify({ id: "2", method: "execute", params: { script: "", event: "test", context: {} } });

    // First chunk: only the first half
    const half = line.slice(0, Math.floor(line.length / 2));
    const buf1 = processChunk("", half);
    expect(mockExecute).not.toHaveBeenCalled();

    // Second chunk: remainder + newline
    const remaining = processChunk(buf1, line.slice(Math.floor(line.length / 2)) + "\n");
    expect(remaining).toBe("");
    await Promise.resolve();
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });
});

describe("onEnd", () => {
  it("calls process.exit(0)", () => {
    const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {});
    onEnd();
    expect(exitSpy).toHaveBeenCalledWith(0);
    exitSpy.mockRestore();
  });
});

// Integration test: spawns the script as a subprocess to cover the isMain stdin loop.
describe("isMain stdin loop", () => {
  it("reads execute messages from stdin and writes responses to stdout", async () => {
    const { spawn } = await import("node:child_process");
    const { fileURLToPath } = await import("node:url");
    const { dirname, resolve } = await import("node:path");

    const scriptPath = resolve(dirname(fileURLToPath(import.meta.url)), "../index.js");
    const proc = spawn(process.execPath, [scriptPath]);

    const msg = JSON.stringify({
      id: "integration-1",
      method: "execute",
      params: { script: "", event: "test", context: {} },
    });

    let stdout = "";
    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });

    proc.stdin.write(msg + "\n");
    proc.stdin.end();

    await new Promise((resolve) => proc.on("close", resolve));

    const response = JSON.parse(stdout.trim());
    expect(response.id).toBe("integration-1");
    expect(response.error).toBeNull();
  });
});
