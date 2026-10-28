import type { OrganizerApplyResult, OrganizerPortCommand } from "@/entities/configuration";
import { readDrawerOrganizers } from "@/entities/configuration/model/drawerOrganizers";
import type { TestOrganizerAnswer } from "@/features/playCanvasAdapter";

import commandsFixture from "./fixtures/contract/commands.v1.json";

/**
 * Answers of the fake organizer port, built from the shared `commands.v1.json` (WP-1): what 3D answers for
 * each command case, read the way the real port reads a receipt. Test helper, not a test file.
 */

type CommandCase = (typeof commandsFixture.cases)[number];

const caseNamed = (name: string): CommandCase => {
  const found = commandsFixture.cases.find((testCase) => testCase.name === name);
  if (!found) throw new Error(`no command case ${name}`);
  return found;
};

/** The port's answer for a fixture case on one product. */
export const portResultOf = (name: string, runtimeId = "rt-1"): OrganizerApplyResult => {
  const { expected } = caseNamed(name);
  if ("error" in expected && expected.error) {
    return { status: "rejected", code: expected.error.code, message: `${expected.error.code} message` };
  }
  return {
    status: expected.status as "applied" | "partial" | "noop",
    products: [{ runtimeId, entry: readDrawerOrganizers(expected.state) }],
    corrections: expected.corrections as Extract<OrganizerApplyResult, { status: "applied" }>["corrections"],
  };
};

/** The stored state the case starts from, as the read-model holds it. */
export const startStateOf = (name: string) => readDrawerOrganizers(caseNamed(name).state);

/** The stored state after the case, as the read-model holds it. */
export const endStateOf = (name: string) => readDrawerOrganizers(caseNamed(name).expected.state);

/** The fixture command as the port receives it for one product. */
export const portCommandOf = (name: string, runtimeId = "rt-1"): Partial<OrganizerPortCommand> => {
  const { type, ...fields } = caseNamed(name).command as { type: string } & Record<string, unknown>;
  if (type === "clear") return { kind: "clear" };
  return { kind: type, runtimeId, ...fields } as Partial<OrganizerPortCommand>;
};

/** A row of the fake port's table: the fixture command answers with the fixture receipt. */
export const answerOf = (name: string, runtimeId = "rt-1"): TestOrganizerAnswer => ({
  match: portCommandOf(name, runtimeId),
  result: portResultOf(name, runtimeId),
});
