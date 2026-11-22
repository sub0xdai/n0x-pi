import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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
assert.ok(
  nudge.entries[0].content.includes("No run artifact for"),
  "runtime dirt demands a run artifact, not a project check"
);

const warned = await settle();
assert.equal(warned?.continue, undefined, "the second settle does not loop");
assert.ok(
  warned?.entries?.[0]?.content.includes("Settled without a run artifact"),
  "the second settle names the missing artifact"
);
assert.equal(await settle(), undefined, "the warning fires once per mutation");

await call("session_start", {});
await mutate("edit", "a.ts");
await bash("npx tsc --noEmit");
assert.equal((await settle())?.continue, true, "a typecheck is not a run artifact");

await call("session_start", {});
await mutate("edit", "a.ts");
await bash('git commit -m "fix node crash"');
assert.equal((await settle())?.continue, true, "a commit message is not a run artifact");

await call("session_start", {});
await mutate("edit", "a.ts");
await bash("rg node src/");
assert.equal((await settle())?.continue, true, "grepping for a keyword is not a run artifact");

await call("session_start", {});
await mutate("edit", "a.ts");
await bash("cargo test");
assert.equal((await settle())?.continue, true, "a test run never satisfies a runtime diff");

await call("session_start", {});
await mutate("edit", "a.ts");
await bash("npm run test");
assert.equal((await settle())?.continue, true, "an npm test script is not a run artifact");

await call("session_start", {});
await mutate("edit", "a.ts");
await bash("node --test");
assert.equal((await settle())?.continue, true, "node --test is not a run artifact");

await call("session_start", {});
await mutate("edit", "a.ts");
await bash("npx tsc --noEmit && node bench.js");
assert.equal(
  await settle(),
  undefined,
  "a run later in the same command still proves the turn"
);

await call("session_start", {});
await mutate("edit", "a.ts");
await bash("./node_modules/.bin/tsc -p tsconfig.json | head -5; node bench.js | tail -3");
assert.equal(
  await settle(),
  undefined,
  "a typecheck piped beside a run does not hide the run"
);

await call("session_start", {});
await mutate("edit", "a.ts");
await bash("npx tsc --noEmit; npx eslint src/");
assert.equal(
  (await settle())?.continue,
  true,
  "two checkers and no run still demand an artifact"
);

await call("session_start", {});
await mutate("edit", "a.ts");
await bash("HOME=/tmp/x node app.js");
assert.equal(
  await settle(),
  undefined,
  "an env assignment before the run does not hide it"
);

await call("session_start", {});
await mutate("edit", "a.ts");
await bash("JUMP=1 npx tsc --noEmit");
assert.equal(
  (await settle())?.continue,
  true,
  "an env assignment before a typecheck is still not a run"
);

await call("session_start", {});
await mutate("edit", "main.rs");
await bash("./target/debug/app --smoke");
assert.equal(await settle(), undefined, "running the built binary is a run artifact");

await call("session_start", {});
await mutate("edit", "App.TSX");
assert.equal((await settle())?.continue, true, "an upper-case suffix is still a runtime surface");

await call("session_start", {});
await mutate("edit", "theme.css");
assert.equal((await settle())?.continue, true, "a stylesheet is a runtime surface");

await call("session_start", {});
await mutate("edit", "a.ts");
await call("tool_result", { toolName: "mcp__github__click_issue", input: {}, isError: false });
assert.equal((await settle())?.continue, true, "a non-browser MCP tool is not proof");

await call("session_start", {});
await mutate("edit", "a.ts");
await bash("cargo run --quiet");
assert.equal(await settle(), undefined, "a run artifact settles the turn");

await mutate("edit", "a.ts");
await call("tool_result", {
  toolName: "mcp__kitesurf__take_screenshot",
  input: {},
  isError: false,
});
assert.equal(await settle(), undefined, "a live-surface tool result counts as proof");

await call("session_start", {});
await mutate("edit", "a.ts");
await call("tool_result", {
  toolName: "codemode",
  input: { code: "await tools.mcp__kitesurf__take_screenshot({});" },
  isError: false,
});
assert.equal(await settle(), undefined, "a kitesurf call inside codemode counts as proof");

await call("session_start", {});
await mutate("edit", "a.ts");
await call("tool_result", { toolName: "codemode", input: { code: "return 1;" }, isError: false });
assert.equal((await settle())?.continue, true, "a codemode script with no page call is not proof");

await call("session_start", {});
await mutate("edit", "a.ts");
await call("tool_result", { toolName: "mcp__kitesurf__list_pages", input: {}, isError: false });
assert.equal(
  (await settle())?.continue,
  true,
  "listing pages is not a run artifact"
);

await call("session_start", {});
await mutate("write", "notes.md");
const docNudge = await settle();
assert.ok(
  docNudge.entries[0].content.includes("project check"),
  "a docs-only diff demands the project check, not a run"
);
await bash("npm test");
assert.equal(await settle(), undefined, "the project check clears a docs-only diff");
await mutate("edit", "b.ts");
const afterDocs = await settle();
assert.ok(
  !afterDocs.entries[0].content.includes("notes.md"),
  "the docs file leaves the dirty set once the check runs"
);

await assert.doesNotReject(async () => {
  await call("tool_result", { toolName: "edit", input: { path: "a.ts" }, isError: false }, {
    cwd: "",
    mode: "print",
  });
}, "an empty cwd must not throw out of the handler");

await call("session_start", {});
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

const vendoredDir = join(cwd, "node_modules", "pkg");
mkdirSync(vendoredDir, { recursive: true });
writeFileSync(join(vendoredDir, "index.ts"), "// TO" + "DO: third-party\n");
await call("session_start", {});
const vendoredRun = await call("tool_result", {
  toolName: "edit",
  input: { path: "node_modules/pkg/index.ts" },
  content: [{ type: "text", text: "edited vendored file" }],
  isError: false,
});
assert.equal(vendoredRun, undefined, "a vendored file is never gated");
assert.equal(await settle(), undefined, "a vendored edit does not dirty the run");

const markedDir = join(cwd, "third-party");
const rejected = (result) =>
  typeof result === "string" || JSON.stringify(result).includes("__check.sh rejected");
mkdirSync(markedDir, { recursive: true });
writeFileSync(join(markedDir, "VENDOR"), "Upstream: https://example.test\n");
writeFileSync(join(markedDir, "index.ts"), "// TO" + "DO: third-party\n");
await call("session_start", {});
const markedRun = await call("tool_result", {
  toolName: "edit",
  input: { path: "third-party/index.ts" },
  content: [{ type: "text", text: "edited marked file" }],
  isError: false,
});
assert.equal(markedRun, undefined, "a VENDOR marker exempts the tree");
assert.equal(await settle(), undefined, "a marker edit does not dirty the run");

writeFileSync(join(markedDir, "VENDOR"), "copied from somewhere\n");
await call("session_start", {});
const unprovenanced = await call("tool_result", {
  toolName: "edit",
  input: { path: "third-party/index.ts" },
  content: [{ type: "text", text: "edited marked file" }],
  isError: false,
});
assert.ok(rejected(unprovenanced), "a marker with no Upstream line does not exempt");

rmSync(join(markedDir, "VENDOR"));
mkdirSync(join(markedDir, "VENDOR"));
await call("session_start", {});
const dirMarker = await call("tool_result", {
  toolName: "edit",
  input: { path: "third-party/index.ts" },
  content: [{ type: "text", text: "edited marked file" }],
  isError: false,
});
assert.ok(rejected(dirMarker), "a directory named VENDOR does not exempt");
rmdirSync(join(markedDir, "VENDOR"));
writeFileSync(join(markedDir, "VENDOR"), "Upstream: https://example.test\n");
await call("session_start", {});

const lateDir = join(cwd, "late");
mkdirSync(lateDir, { recursive: true });
writeFileSync(join(lateDir, "mod.ts"), "// TO" + "DO: late\n");
await call("tool_result", {
  toolName: "edit",
  input: { path: "late/mod.ts" },
  content: [{ type: "text", text: "edited late file" }],
  isError: false,
});
writeFileSync(join(lateDir, "VENDOR"), "Upstream: https://example.test\n");
writeFileSync(join(cwd, "authored.ts"), "const ok = 1;\n");
await call("tool_result", {
  toolName: "edit",
  input: { path: "authored.ts" },
  content: [{ type: "text", text: "edited authored file" }],
  isError: false,
});
const staleNote = JSON.stringify(await settle());
assert.ok(
  !staleNote.includes("late/mod.ts"),
  "a path exempted after its violation is not named in the nudge",
);
assert.ok(
  !staleNote.includes("mechanical gate is failing"),
  "a stale violation does not claim the gate is failing now",
);

writeFileSync(join(cwd, "bashfixed.ts"), "// TO" + "DO: bashfixed\n");
await call("tool_result", {
  toolName: "edit",
  input: { path: "bashfixed.ts" },
  content: [{ type: "text", text: "edited bashfixed file" }],
  isError: false,
});
writeFileSync(join(cwd, "bashfixed.ts"), "const ok = 1;\n");
const healedNote = JSON.stringify(await settle());
assert.ok(
  !healedNote.includes("mechanical gate is failing"),
  "a violation fixed outside the guard is re-gated at settle",
);
await call("session_start", {});

const workDir = mkdtempSync(join(homedir(), ".state-guard-work-"));

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

const generated = join(repo, "asset.svg");
writeFileSync(generated, "<svg>\n");
await handlers.get("tool_call")(
  { toolName: "bash", input: { command: "echo generate" }, toolCallId: "shell-c" },
  repoCtx
);
writeFileSync(generated, `<svg>${"x".repeat(140)}</svg>\n`);
const generatedResult = await handlers.get("tool_result")(
  {
    toolName: "bash",
    input: { command: "echo generate" },
    toolCallId: "shell-c",
    content: [{ type: "text", text: "generate" }],
    isError: false,
  },
  repoCtx
);
assert.equal(generatedResult, undefined, "a generated artifact is not gated as source code");

await call("session_start", {}, repoCtx);
const generatedPaths = [];
for (let i = 0; i < 12; i += 1) {
  const asset = join(repo, `bulk${String(i).padStart(2, "0")}.svg`);
  writeFileSync(asset, "<svg>\n");
  generatedPaths.push(asset);
}
await handlers.get("tool_call")(
  { toolName: "bash", input: { command: "echo bulk" }, toolCallId: "shell-e" },
  repoCtx
);
for (const asset of generatedPaths) writeFileSync(asset, `<svg>${"x".repeat(120)}</svg>\n`);
writeFileSync(join(repo, "zzz.ts"), "// TO" + "DO: planted\nconst z = 1;\n");
const capped = await handlers.get("tool_result")(
  {
    toolName: "bash",
    input: { command: "echo bulk" },
    toolCallId: "shell-e",
    content: [{ type: "text", text: "bulk" }],
    isError: false,
  },
  repoCtx
);
const cappedNote = capped?.content?.map((b) => b.text).join("\n") ?? "";
assert.ok(
  cappedNote.includes("zzz.ts"),
  "generated files must not consume the gated-file cap"
);

await call("session_start", {}, repoCtx);
await handlers.get("tool_call")(
  { toolName: "bash", input: { command: "node gen.js" }, toolCallId: "shell-d" },
  repoCtx
);
writeFileSync(join(repo, "gen.ts"), "// TO" + "DO: generated\nconst gen = 1;\n");
const combined = await handlers.get("tool_result")(
  {
    toolName: "bash",
    input: { command: "node gen.js" },
    toolCallId: "shell-d",
    content: [{ type: "text", text: "generated" }],
    isError: false,
  },
  repoCtx
);
const combinedNote = combined?.content?.map((b) => b.text).join("\n") ?? "";
assert.ok(combinedNote.includes("TB-10"), "a run plus a shell violation still reports the gate");
const afterRun = await handlers.get("agent_before_settle")({ outcome: "completed" }, repoCtx);
assert.ok(
  afterRun?.entries?.[0]?.content.includes("TB-10"),
  "a run must not erase a gate violation"
);

rmSync(repo, { recursive: true, force: true });
rmSync(workDir, { recursive: true, force: true });
console.log("state-guard: all assertions passed");
