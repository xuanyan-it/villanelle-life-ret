import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const projects = ["shared", "frontend", "electron", "server"];
const rootDir = process.cwd();

function round2(value) {
  return Math.round(value * 100) / 100;
}

async function loadProjectCoverage(project) {
  const filePath = path.join(rootDir, "coverage", project, "coverage-summary.json");
  if (!existsSync(filePath)) {
    throw new Error(`Missing coverage summary: ${filePath}`);
  }

  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  const total = parsed?.total;
  if (!total) {
    throw new Error(`Invalid coverage summary payload: ${filePath}`);
  }

  return {
    project,
    statements: round2(Number(total.statements?.pct ?? 0)),
    branches: round2(Number(total.branches?.pct ?? 0)),
    functions: round2(Number(total.functions?.pct ?? 0)),
    lines: round2(Number(total.lines?.pct ?? 0)),
  };
}

function average(rows, key) {
  const sum = rows.reduce((acc, row) => acc + row[key], 0);
  return round2(sum / rows.length);
}

async function main() {
  const rows = await Promise.all(projects.map(loadProjectCoverage));
  rows.sort((a, b) => a.project.localeCompare(b.project));

  const generatedAt = new Date().toISOString();
  const summary = [
    "# Coverage Summary",
    "",
    `Generated at: ${generatedAt}`,
    "",
    "## Per Project",
    "",
    ...rows.map(
      (row) =>
        `- ${row.project}: statements ${row.statements}% | branches ${row.branches}% | functions ${row.functions}% | lines ${row.lines}%`,
    ),
    "",
    "## Cross-Project Average",
    "",
    `- statements: ${average(rows, "statements")}%`,
    `- branches: ${average(rows, "branches")}%`,
    `- functions: ${average(rows, "functions")}%`,
    `- lines: ${average(rows, "lines")}%`,
    "",
    "## Source Files",
    "",
    ...projects.map((project) => `- coverage/${project}/coverage-summary.json`),
    "",
  ].join("\n");

  const outputPath = path.join(rootDir, "coverage", "summary.md");
  await writeFile(outputPath, summary, "utf8");
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
