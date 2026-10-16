import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { renderMermaidSVG, renderMermaidASCII, THEMES } from
  "../npm/node_modules/beautiful-mermaid/dist/index.js";

const source = process.argv[2];
const outDir = process.argv[3];
const asciiOnly = process.argv[4] === "--ascii";
const theme = process.argv[5] ?? "zinc-dark";

const text = readFileSync(source, "utf8");
const blocks = [...text.matchAll(/```mermaid\n([\s\S]*?)\n```/g)].map((m) => m[1]);

if (blocks.length === 0) {
  console.error("no mermaid blocks found");
  process.exit(1);
}

if (!asciiOnly) mkdirSync(outDir, { recursive: true });

let failed = 0;
for (const [index, block] of blocks.entries()) {
  const name = `harness-${index + 1}`;
  const firstLine = block.split("\n")[0].trim();
  try {
    const ascii = renderMermaidASCII(block);
    if (!asciiOnly) {
      const svg = renderMermaidSVG(block, THEMES[theme]);
      const svgPath = `${outDir}/${name}.svg`;
      writeFileSync(svgPath, svg);
      const lines = ascii.split("\n").length;
      console.log(`block ${index + 1} (${firstLine}): OK  ascii ${lines} lines  svg ${svgPath}`);
    } else {
      console.log(`block ${index + 1} (${firstLine}): OK  ascii ${ascii.split("\n").length} lines`);
    }
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    console.log(`block ${index + 1} (${firstLine}): FAILED  ${message.split("\n")[0]}`);
  }
}
const outcome = failed === 0 ? "all" : `${failed} of`;
console.log(`${outcome} ${blocks.length} blocks ${failed === 0 ? "rendered" : "failed"}`);
process.exit(failed === 0 ? 0 : 1);
