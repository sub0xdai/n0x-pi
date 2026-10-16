import assert from "node:assert/strict";
import { mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import stateGuard from "./state-guard.ts";

const handlers = new Map();
stateGuard({ on: (name, handler) => handlers.set(name, handler) });

const cwd = mkdtempSync(join(tmpdir(), "state-guard-"));
const ctx = { cwd, mode: "print" };
const call = (name, event) => handlers.get(name)(event, ctx);

const read = (path) => call("tool_result", { toolName: "read", input: { path }, isError: false });
const mutate = (toolName, path) =>
  call("tool_result", { toolName, input: { path }, isError: false });
const edit = (path) => call("tool_call", { toolName: "edit", input: { path } });
const write = (path) => call("tool_call", { toolName: "write", input: { path } });
const bash = (command, isError = false) =>
  call("tool_result", { toolName: "bash", input: { command }, isError });
const settle = () => call("agent_before_settle", { outcome: "completed" });
const blocked = (call_) => call_?.block === true;

await call("session_start", {});

writeFileSync(join(cwd, "a.ts"), "a\n");
writeFileSync(join(cwd, "b.ts"), "b\n");

assert.ok(blocked(await edit("a.ts")), "edit of an unread existing file must block");
assert.ok(blocked(await edit(join(cwd, "a.ts"))), "an absolute path must block too");
assert.ok(blocked(await write("b.ts")), "overwrite of an unread existing file must block");
assert.equal(await write("new.ts"), undefined, "creating a new file must pass");
assert.equal(await settle(), undefined, "a clean run must settle with no nudge");

await read("a.ts");
assert.equal(await edit("a.ts"), undefined, "edit after read must pass");
assert.equal(await edit("@a.ts"), undefined, "an @-prefixed path must match the read path");

writeFileSync(join(cwd, "c.ts"), "c\n");
symlinkSync(join(cwd, "c.ts"), join(cwd, "c-link.ts"));
await read("c-link.ts");
assert.equal(await edit("c.ts"), undefined, "a read through a symlink must cover its target");
await read("c.ts");
assert.equal(await edit("c-link.ts"), undefined, "a read of the target must cover its symlink");

await mutate("edit", "a.ts");

const nudge = await settle();
assert.equal(nudge?.continue, true, "a dirty mutation must request a continuation");
assert.equal(nudge.entries.length, 1, "the nudge carries exactly one message");
assert.equal(await settle(), undefined, "the nudge must fire once per mutation, not loop");

await bash("cargo test");
assert.equal(await settle(), undefined, "a verified run must settle quietly");

await bash("cargo test", true);
await mutate("edit", "a.ts");
assert.equal((await settle())?.continue, true, "a failed check leaves the run dirty");
assert.ok((await edit("b.ts"))?.reason.includes("b.ts"), "the block reason must name the file");

console.log("state-guard: all assertions passed");
