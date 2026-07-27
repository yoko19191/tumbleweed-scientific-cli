import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const SKILLS_ROOT = join(process.cwd(), ".agents", "skills");
const INTERNAL_SKILLS_ROOT = join(process.cwd(), ".agents", "internal-skills");
const PUBLIC_SKILLS = [
  "design-proteins-with-tumbleweed",
  "dock-molecules-with-tumbleweed",
  "embed-sequences-with-tumbleweed",
  "predict-structures-with-tumbleweed",
  "run-tumbleweed-jobs",
  "use-tumbleweed-models",
];

function readFrontmatter(skillName: string): string {
  const source = readFileSync(join(SKILLS_ROOT, skillName, "SKILL.md"), "utf8");
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  if (!match?.[1]) throw new Error(`Missing frontmatter: ${skillName}`);
  return match[1];
}

describe("Skills distribution", () => {
  test("publishes exactly six Skills and keeps the CLI design Skill internal", () => {
    const skillNames = readdirSync(SKILLS_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    expect(skillNames).toEqual(PUBLIC_SKILLS);

    const internalSkill = readFileSync(
      join(INTERNAL_SKILLS_ROOT, "build-better-agent-first-cli", "SKILL.md"),
      "utf8",
    );
    expect(internalSkill).toContain("\n  scope: repository-development");
  });

  test("attributes every public Skill to the package author", () => {
    for (const skillName of PUBLIC_SKILLS) {
      expect(readFrontmatter(skillName)).toContain(
        "\nmetadata:\n  author: yoko19191",
      );
    }
  });
});
