import { describe, expect, it } from "vitest";

import classDocument from "../../../../public/collections/class/product-profile.json";
import lameDocument from "../../../../public/collections/lame/product-profile.json";
import makoDocument from "../../../../public/collections/mako/product-profile.json";
import { parseProductProfile } from "@/entities/collection/lib/parseProductProfile";
import { selectMessage } from "@/entities/collection/lib/productProfileSelectors";
import type { ProductProfile } from "@/entities/collection/model/productProfile";

import commandsFixture from "./fixtures/contract/commands.v1.json";
import contractFixture from "./fixtures/contract/contract.v1.json";
import {
  CORRECTION_MESSAGE_KEYS,
  ERROR_MESSAGE_KEYS,
  ORGANIZER_MESSAGE_KEYS,
  messageKeyForCorrection,
  messageKeyForError,
} from "../model/messages";
import { ORGANIZER_PROFILES } from "../model/presets";

/**
 * 3D reports corrections and errors by stable code; the UI maps a code to a key of the collection's
 * `messages`. The keys live here, outside the modules the reasonCodesHaveMessages guard reads: no reason-code
 * constants in the feature and no `"ns.code"` literals in features/configurationCommands (OPUS-B §3).
 */

const profileOf = (document: unknown): ProductProfile => {
  const parsed = parseProductProfile(document);
  if (!parsed.ok) throw new Error(`profile failed validation: ${JSON.stringify(parsed.diagnostics)}`);
  return parsed.profile;
};

const PROFILES: [string, ProductProfile][] = [
  ["class", profileOf(classDocument)],
  ["mako", profileOf(makoDocument)],
  ["lame", profileOf(lameDocument)],
];

/** Codes the contract fixtures exercise: normalisation diagnostics, corrections of commands, command errors. */
const diagnosticCodes = [
  ...new Set(contractFixture.cases.flatMap(({ expected }) => expected.diagnostics.map(({ code }) => code))),
];
const correctionCodes = [
  ...new Set(commandsFixture.cases.flatMap(({ expected }) => expected.corrections.map(({ code }) => code))),
];
const errorCodes = [
  ...new Set(
    commandsFixture.cases.flatMap(({ expected }) =>
      "error" in expected && expected.error ? [expected.error.code] : [],
    ),
  ),
];

/** Every key the code can resolve: both maps (without the log-only nulls), the message list and the profile's unavailable styles. */
const usedKeys = new Set<string>([
  ...Object.values(CORRECTION_MESSAGE_KEYS).filter((key): key is string => key !== null),
  ...Object.values(ERROR_MESSAGE_KEYS),
  ...Object.values(ORGANIZER_MESSAGE_KEYS),
  ...Object.values(ORGANIZER_PROFILES["ROW-MTL-43"].unavailableStyles),
  messageKeyForError("ANY_OTHER_CODE"),
]);

describe("corrections", () => {
  it("finds the codes of the fixtures", () => {
    expect(diagnosticCodes.length).toBeGreaterThanOrEqual(11);
    expect(correctionCodes).toEqual(
      expect.arrayContaining(["HOLE", "IN_LOCKED_ZONE", "POSITIONS_FIXED", "RENDER_TIMEOUT"]),
    );
  });

  it("decides on every diagnostic code of contract.v1: a key, or null for the log only", () => {
    for (const code of [...diagnosticCodes, ...correctionCodes, "UNSUPPORTED_WIDTH", "UNSUPPORTED_VERSION"]) {
      expect(Object.hasOwn(CORRECTION_MESSAGE_KEYS, code), code).toBe(true);
    }
  });

  it("tells the user about the columns that were removed or cannot be edited", () => {
    expect(messageKeyForCorrection("OUT_OF_RANGE")).toBe("organizer.trimmed");
    expect(messageKeyForCorrection("IN_LOCKED_ZONE")).toBe("organizer.trimmed");
    expect(messageKeyForCorrection("MALFORMED")).toBe("organizer.trimmed");
    expect(messageKeyForCorrection("DUPLICATE_SLOT")).toBe("organizer.trimmed");
    expect(messageKeyForCorrection("DRAWER_ABSENT")).toBe("organizer.drawerRemoved");
    expect(messageKeyForCorrection("NOT_OFFERED")).toBe("organizer.drawerRemoved");
    expect(messageKeyForCorrection("UNSUPPORTED_WIDTH")).toBe("organizer.unavailable");
    expect(messageKeyForCorrection("UNSUPPORTED_VERSION")).toBe("organizer.updateRequired");
  });

  it("keeps the log-only codes silent", () => {
    for (const code of ["POSITIONS_FIXED", "UNKNOWN_STYLE", "HOLE", "RENDER_TIMEOUT"]) {
      expect(messageKeyForCorrection(code), code).toBeNull();
    }
  });

  it("treats a code it does not know as log-only, never as a bare key", () => {
    expect(messageKeyForCorrection("SOMETHING_NEW")).toBeNull();
    expect(messageKeyForCorrection("constructor")).toBeNull();
    expect(messageKeyForCorrection("toString")).toBeNull();
  });
});

describe("errors", () => {
  it("maps the command errors of commands.v1 to a key", () => {
    expect(errorCodes.length).toBeGreaterThanOrEqual(7);
    for (const code of errorCodes) expect(messageKeyForError(code), code).toMatch(/^organizer\.[a-zA-Z]+$/);
  });

  it("says why the column could not be placed, or that the drawer or version is the cause", () => {
    expect(messageKeyForError("ORGANIZERS_SLOT_UNAVAILABLE")).toBe("organizer.placeFailed");
    expect(messageKeyForError("ORGANIZERS_NOT_READY")).toBe("organizer.placeFailed");
    expect(messageKeyForError("ORGANIZERS_DRAWER_UNAVAILABLE")).toBe("organizer.unavailable");
    expect(messageKeyForError("ORGANIZERS_UNSUPPORTED_VERSION")).toBe("organizer.updateRequired");
  });

  it("answers placeFailed for every other code", () => {
    expect(messageKeyForError("ORGANIZERS_INVALID_INPUT")).toBe("organizer.placeFailed");
    expect(messageKeyForError("ORGANIZERS_UNKNOWN_PRODUCT")).toBe("organizer.placeFailed");
    expect(messageKeyForError("SOMETHING_NEW")).toBe("organizer.placeFailed");
    expect(messageKeyForError("constructor")).toBe("organizer.placeFailed");
  });
});

describe("message keys", () => {
  it("holds the keys of the toasts, hints and limits the panel shows", () => {
    expect(ORGANIZER_MESSAGE_KEYS).toEqual({
      hintOpenDrawer: "organizer.hintOpenDrawer",
      lockedZone: "organizer.lockedZone",
      drawerFull: "organizer.drawerFull",
      unavailable: "organizer.unavailable",
      maxPositions: "organizer.maxPositions",
      columnRemoved: "organizer.columnRemoved",
      cleared: "organizer.cleared",
      typeChanged: "organizer.typeChanged",
      undoHint: "organizer.undoHint",
      oakPending: "organizer.oakPending",
    });
  });

  it("is the key Oak points to in the profile table", () => {
    expect(ORGANIZER_PROFILES["ROW-MTL-43"].unavailableStyles.Oak).toBe(ORGANIZER_MESSAGE_KEYS.oakPending);
  });

  describe.each(PROFILES)("%s", (_collection, profile) => {
    it("has a text for every key the code can resolve", () => {
      for (const key of usedKeys) {
        expect(profile.messages[key], key).toEqual(expect.any(String));
        expect(profile.messages[key].trim(), key).not.toBe("");
      }
    });

    it("has no organizer text that nothing points to", () => {
      const declared = Object.keys(profile.messages).filter((key) => key.startsWith("organizer."));

      expect(declared.sort()).toEqual([...usedKeys].sort());
    });

    it("fills the column count of the toasts that remove columns", () => {
      expect(selectMessage(profile, "organizer.trimmed", { n: 2 })).toBe("2 column(s) no longer fit and were removed.");
      expect(selectMessage(profile, "organizer.drawerRemoved", { n: 3 })).toBe(
        "3 column(s) were removed with the drawer.",
      );
    });
  });
});
