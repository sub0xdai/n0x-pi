import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
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

const dirtyFile = join(cwd, "gate.ts");
writeFileSync(dirtyFile, "// TO" + "DO: remove this\nconst x = 1;\n");
const gated = await call("tool_result", {
  toolName: "edit",
  input: { path: "gate.ts" },
  content: [{ type: "text", text: "edited gate.ts" }],
  isError: false,
});
const appended = gated?.content?.map((b) => b.text).join("\n") ?? "";
assert.ok(appended.includes("TB-10"), "the gate failure is appended to the tool result");
assert.ok(appended.includes("gate.ts"), "the appended failure names the file");
const gateNudge = await settle();
assert.ok(
  gateNudge?.entries?.[0]?.content.includes("TB-10"),
  "the settle nudge repeats the gate failure"
);

writeFileSync(dirtyFile, "const x = 1;\n");
const cleanRun = await call("tool_result", {
  toolName: "edit",
  input: { path: "gate.ts" },
  content: [{ type: "text", text: "edited gate.ts" }],
  isError: false,
});
assert.equal(cleanRun, undefined, "a clean file is not appended to");

const shellCall = (command) =>
  call("tool_call", { toolName: "bash", input: { command }, toolCallId: "shell-1" });

const workDir = mkdtempSync(join(homedir(), ".state-guard-work-"));
const shellCtx = { cwd: workDir, mode: "print" };
const shellCallIn = (cwd, command) =>
  handlers.get("tool_call")({ toolName: "bash", input: { command }, toolCallId: "shell-2" }, {
    cwd,
    mode: "print",
  });

for (const [command, expected] of [
  ["cat > src/a.ts <<'EOF'", true],
  ["sed -i 's/a/b/' src/a.ts", true],
  ["tee src/a.ts", true],
  ["dd of=src/a.ts if=/dev/zero", true],
  ['echo "a > b"', false],
  ["git status --porcelain", false],
  ["npm test > log.txt", false],
  ["python3 - <<'EOF'", false],
]) {
  const result = await shellCallIn(workDir, command);
  assert.equal(
    result?.block === true,
    expected,
    `boundary A on ${command}: expected blocked=${expected}`
  );
}

const absoluteTmp = await shellCallIn(workDir, "cat > /tmp/scratch.ts <<'EOF'");
assert.equal(absoluteTmp, undefined, "an absolute path under /tmp is allowed");
const relativeTmp = await shellCallIn(join(tmpdir(), "scratch-cwd"), "cat > rel.ts <<'EOF'");
assert.equal(relativeTmp, undefined, "a relative path inside a temp cwd is allowed");

const repo = mkdtempSync(join(homedir(), ".state-guard-repo-"));
execFileSync("git", ["init", "-q"], { cwd: repo });
const sideEffect = join(repo, "side.ts");
writeFileSync(sideEffect, "const side = 1;\n");
await call("session_start", {});
const repoCtx = { cwd: repo, mode: "print" };
const before = await handlers.get("tool_call")(
  { toolName: "bash", input: { command: "echo start" }, toolCallId: "shell-b" },
  repoCtx
);
assert.equal(before, undefined, "a plain bash call is not blocked");
writeFileSync(sideEffect, "// TO" + "DO planted by a shell script\nconst side = 1;\n");
const after = await handlers.get("tool_result")(
  {
    toolName: "bash",
    input: { command: "echo start" },
    toolCallId: "shell-b",
    content: [{ type: "text", text: "start" }],
    isError: false,
  },
  repoCtx
);
const shellNote = after?.content?.map((b) => b.text).join("\n") ?? "";
assert.ok(shellNote.includes("bash changed"), "boundary B notices a file a shell call changed");
assert.ok(shellNote.includes("TB-10"), "boundary B gates that file with __check.sh");



rmSync(repo, { recursive: true, force: true });
rmSync(workDir, { recursive: true, force: true });
console.log("state-guard: all assertions passed");
