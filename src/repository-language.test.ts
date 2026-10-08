import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/** A fragment of a text, from `start` up to but not including `end`. */
interface TextRange {
  readonly start: number;
  readonly end: number;
}

/** Returns the text with the allowed fragments replaced by spaces; line breaks stay, so line numbers do not move. */
type MaskAllowedRegions = (text: string) => string;

interface RussianException {
  /** A tracked file, or a directory prefix ending in "/". */
  readonly path: string;
  readonly reason: string;
  /** Without it the whole file or directory is excepted; with it only the fragments it leaves out of the mask. */
  readonly maskAllowedRegions?: MaskAllowedRegions;
}

const NON_LINE_BREAK_CHARACTER = /[^\r\n]/gu;
const BLANK_CHARACTER = " ";

function blankRange(text: string, { start, end }: TextRange): string {
  const fragment = text.slice(start, end);
  // An emoji is two UTF-16 units and gets two blanks, so the later offsets stay right.
  const blankFragment = fragment.replace(
    NON_LINE_BREAK_CHARACTER,
    (character) => BLANK_CHARACTER.repeat(character.length),
  );

  return `${text.slice(0, start)}${blankFragment}${text.slice(end)}`;
}

/** Positions of the TypeScript parser are offsets in UTF-16 units, the same as the indexes of a string. */
function blankOut(text: string, ranges: readonly TextRange[]): string {
  return ranges.reduce(blankRange, text);
}

function hasSyntaxErrors(fileName: string, text: string): boolean {
  const { diagnostics } = ts.transpileModule(text, {
    fileName,
    reportDiagnostics: true,
  });

  return diagnostics !== undefined && diagnostics.length > 0;
}

function parseTypeScript(fileName: string, text: string): ts.SourceFile {
  return ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
}

function rangeOf(node: ts.Node, sourceFile: ts.SourceFile): TextRange {
  return { start: node.getStart(sourceFile), end: node.getEnd() };
}

/** A quoted key (`"title": ...`) or a computed one (`["title"]: ...`) is a name, not a value. */
function isPropertyName(node: ts.Node): boolean {
  const { parent } = node;
  const isAssignedName =
    ts.isPropertyAssignment(parent) && parent.name === node;

  return isAssignedName || ts.isComputedPropertyName(parent);
}

/** The text of a string or of a template, without the code of its `${...}` parts. */
function isTextToken(node: ts.Node): boolean {
  return (
    ts.isStringLiteralLike(node) ||
    ts.isTemplateHead(node) ||
    ts.isTemplateMiddle(node) ||
    ts.isTemplateTail(node)
  );
}

function isTextValue(node: ts.Node): boolean {
  return isTextToken(node) && !isPropertyName(node);
}

function collectTextTokenRanges(
  node: ts.Node,
  sourceFile: ts.SourceFile,
): TextRange[] {
  const ownRanges = isTextValue(node) ? [rangeOf(node, sourceFile)] : [];
  const childRanges: TextRange[] = [];
  ts.forEachChild(node, (child) => {
    childRanges.push(...collectTextTokenRanges(child, sourceFile));
  });

  return [...ownRanges, ...childRanges];
}

/** The Russian dictionary may have Russian in string values and in template texts, never in comments, names or keys. */
const maskStringLiterals: MaskAllowedRegions = (text) => {
  const fileName = "dictionary.ts";
  if (hasSyntaxErrors(fileName, text)) return text;

  const sourceFile = parseTypeScript(fileName, text);

  return blankOut(text, collectTextTokenRanges(sourceFile, sourceFile));
};

function propertyNameOf(property: ts.ObjectLiteralElementLike): string {
  const { name } = property;
  if (name === undefined) return "";

  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : "";
}

/** The values of the properties called `name` in the given object literals. */
function propertyValues(
  nodes: readonly ts.Node[],
  name: string,
): ts.Expression[] {
  const objects = nodes.filter(ts.isObjectLiteralExpression);
  const properties = objects.flatMap(({ properties }) => [...properties]);
  const named = properties.filter(
    (property) => propertyNameOf(property) === name,
  );

  return named
    .filter(ts.isPropertyAssignment)
    .map(({ initializer }) => initializer);
}

function arrayItems(nodes: readonly ts.Node[]): ts.Expression[] {
  const arrays = nodes.filter(ts.isArrayLiteralExpression);

  return arrays.flatMap(({ elements }) => [...elements]);
}

function rangesOfStringLiterals(
  nodes: readonly ts.Node[],
  sourceFile: ts.SourceFile,
): TextRange[] {
  return nodes
    .filter(ts.isStringLiteralLike)
    .map((literal) => rangeOf(literal, sourceFile));
}

const LOCALE_DEFINITIONS_NAME = "LOCALE_DEFINITIONS";
const RUSSIAN_LOCALE = "ru";
const OWN_NAME_PROPERTY = "ownName";

function findLocaleDefinitions(sourceFile: ts.SourceFile): ts.Expression[] {
  const statements = sourceFile.statements.filter(ts.isVariableStatement);
  const declarations = statements.flatMap(({ declarationList }) => [
    ...declarationList.declarations,
  ]);
  const definitions = declarations.filter(
    ({ name }) =>
      ts.isIdentifier(name) && name.text === LOCALE_DEFINITIONS_NAME,
  );

  return definitions.flatMap(({ initializer }) =>
    initializer === undefined ? [] : [initializer],
  );
}

/** Only the name of Russian in Russian: the `ownName` of the `ru` entry of `LOCALE_DEFINITIONS`. */
const maskRussianOwnName: MaskAllowedRegions = (text) => {
  const fileName = "locales.ts";
  if (hasSyntaxErrors(fileName, text)) return text;

  const sourceFile = parseTypeScript(fileName, text);
  const russianLocale = propertyValues(
    findLocaleDefinitions(sourceFile),
    RUSSIAN_LOCALE,
  );
  const ownNames = propertyValues(russianLocale, OWN_NAME_PROPERTY);

  return blankOut(text, rangesOfStringLiterals(ownNames, sourceFile));
};

const HOOKS_PROPERTY = "hooks";
const STOP_EVENT = "Stop";
const STATUS_MESSAGE_PROPERTY = "statusMessage";

function isValidJson(text: string): boolean {
  try {
    JSON.parse(text);
  } catch {
    return false;
  }

  return true;
}

function jsonRoots(sourceFile: ts.JsonSourceFile): ts.Expression[] {
  const [statement] = sourceFile.statements;

  return statement === undefined ? [] : [statement.expression];
}

/** Only the status message of the Stop hook: `hooks.Stop[].hooks[].statusMessage`. */
const maskStopStatusMessage: MaskAllowedRegions = (text) => {
  const fileName = "settings.json";
  if (!isValidJson(text)) return text;

  const sourceFile = ts.parseJsonText(fileName, text);
  const hooksSection = propertyValues(jsonRoots(sourceFile), HOOKS_PROPERTY);
  const stopGroups = arrayItems(propertyValues(hooksSection, STOP_EVENT));
  const stopHooks = arrayItems(propertyValues(stopGroups, HOOKS_PROPERTY));
  const statusMessages = propertyValues(stopHooks, STATUS_MESSAGE_PROPERTY);

  return blankOut(text, rangesOfStringLiterals(statusMessages, sourceFile));
};

/**
 * The only places where Russian is allowed. A file or a directory without a mask is excepted whole;
 * with a mask only the named fragments are. Everything else in the repository is English.
 */
const RUSSIAN_EXCEPTIONS: readonly RussianException[] = [
  {
    path: "src/i18n/ru.ts",
    reason:
      "The Russian dictionary of the interface: only string values and template text, not comments, names or keys.",
    maskAllowedRegions: maskStringLiterals,
  },
  {
    path: "src/i18n/locales.ts",
    reason:
      "`ownName` is the name of the language in that language: only the Russian `ownName` value.",
    maskAllowedRegions: maskRussianOwnName,
  },
  {
    path: "docs/lighthouse/ru.report.html",
    reason: "A generated report of the Russian page.",
  },
  {
    path: "CLAUDE.md",
    reason: "Generated by `cyberzavod sync` from the harness.",
  },
  {
    path: ".claude/agents/",
    reason: "Agent roles generated by `cyberzavod sync` from the harness.",
  },
  {
    path: ".claude/skills/",
    reason: "Skills generated by `cyberzavod sync` from the harness.",
  },
  {
    path: ".claude/settings.json",
    reason:
      "The status message of the stop hook is written by `cyberzavod sync`: only the Stop `statusMessage` value.",
    maskAllowedRegions: maskStopStatusMessage,
  },
  {
    path: ".cyberzavod/bin/cyberzavod.mjs",
    reason: "The harness executable, its texts are Russian.",
  },
];

const CYRILLIC_LETTER = /\p{Script=Cyrillic}/u;
const NUL_BYTE = 0;
const LINE_BREAK = /\r?\n/u;
const DIRECTORY_SUFFIX = "/";
const GIT_OUTPUT_LIMIT_BYTES = 64 * 1024 * 1024;

/** An exception is a file path, or a directory prefix ending in "/" that covers every file under it. */
function isCoveredBy(exceptedPath: string, path: string): boolean {
  return exceptedPath.endsWith(DIRECTORY_SUFFIX)
    ? path.startsWith(exceptedPath)
    : path === exceptedPath;
}

function findException(path: string): RussianException | undefined {
  return RUSSIAN_EXCEPTIONS.find(({ path: exceptedPath }) =>
    isCoveredBy(exceptedPath, path),
  );
}

/** The text with everything the exception of the path allows replaced by spaces. */
function maskAllowedText(path: string, text: string): string {
  const exception = findException(path);
  if (exception === undefined) return text;

  if (exception.maskAllowedRegions === undefined) {
    return blankOut(text, [{ start: 0, end: text.length }]);
  }

  return exception.maskAllowedRegions(text);
}

/** Indexes of the lines of the scanned text that have Cyrillic letters. */
function findCyrillicLineIndexes(scannedText: string): number[] {
  const lines = scannedText.split(LINE_BREAK);

  return lines.flatMap((line, index) =>
    CYRILLIC_LETTER.test(line) ? [index] : [],
  );
}

/** Lines as `<path>:<line>: <trimmed line>`, taken from the original text. */
function describeLines(
  path: string,
  text: string,
  lineIndexes: readonly number[],
): string[] {
  const lines = text.split(LINE_BREAK);

  return lineIndexes.map(
    (index) => `${path}:${String(index + 1)}: ${(lines[index] ?? "").trim()}`,
  );
}

/** Lines with Cyrillic that the exception of the path does not allow; every line of a file without an exception. */
function findForbiddenCyrillicLines(path: string, text: string): string[] {
  const scannedText = maskAllowedText(path, text);

  return describeLines(path, text, findCyrillicLineIndexes(scannedText));
}

const REPOSITORY_ROOT = fileURLToPath(new URL("../", import.meta.url));

function listTrackedFiles(): string[] {
  const output = execFileSync("git", ["ls-files", "-z"], {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    maxBuffer: GIT_OUTPUT_LIMIT_BYTES,
  });

  return output.split("\0").filter((path) => path !== "");
}

/** Tracked text files; a file with a NUL byte is binary (an image, say) and is skipped. */
function readTrackedTextFiles(): { path: string; text: string }[] {
  const files: { path: string; text: string }[] = [];
  for (const path of listTrackedFiles()) {
    const absolutePath = `${REPOSITORY_ROOT}${path}`;
    if (!existsSync(absolutePath)) continue;

    const content = readFileSync(absolutePath);
    if (content.includes(NUL_BYTE)) continue;

    files.push({ path, text: content.toString("utf8") });
  }

  return files;
}

// Written with escapes, so that this file itself has no Cyrillic (it is a Russian greeting).
const RUSSIAN_WORD = "\u041F\u0440\u0438\u0432\u0435\u0442";

describe("the exception of src/i18n/ru.ts", () => {
  const path = "src/i18n/ru.ts";

  it("allows Cyrillic in a string literal", () => {
    const text = `export const ru = { title: "${RUSSIAN_WORD}", note: '${RUSSIAN_WORD}' };`;

    expect(findForbiddenCyrillicLines(path, text)).toEqual([]);
  });

  it("allows Cyrillic around the parts of a template literal", () => {
    const text = [
      "const spent = (amountText: string, count: number) =>",
      `  \`${RUSSIAN_WORD} \${amountText} ${RUSSIAN_WORD} \${String(count)} ${RUSSIAN_WORD}\`;`,
      `const plain = \`${RUSSIAN_WORD}\`;`,
    ].join("\n");

    expect(findForbiddenCyrillicLines(path, text)).toEqual([]);
  });

  it("allows Cyrillic in a multiline template literal", () => {
    const text = `const note = \`first\n${RUSSIAN_WORD}\nlast\`;`;

    expect(findForbiddenCyrillicLines(path, text)).toEqual([]);
  });

  it("names the line of a Cyrillic line comment", () => {
    const text = `const title = "ok";\n// ${RUSSIAN_WORD}\nconst note = "ok";`;

    expect(findForbiddenCyrillicLines(path, text)).toEqual([
      `${path}:2: // ${RUSSIAN_WORD}`,
    ]);
  });

  it("names the line of a Cyrillic block comment", () => {
    const text = `const title = "ok";\n\n/**\n * ${RUSSIAN_WORD}\n */\nconst note = "ok";`;

    expect(findForbiddenCyrillicLines(path, text)).toEqual([
      `${path}:4: * ${RUSSIAN_WORD}`,
    ]);
  });

  it("names a comment on the line of a string literal", () => {
    const text = `const title = "${RUSSIAN_WORD}"; // ${RUSSIAN_WORD}`;

    expect(findForbiddenCyrillicLines(path, text)).toEqual([
      `${path}:1: ${text}`,
    ]);
  });

  it("refuses Cyrillic in an identifier", () => {
    const text = `const ${RUSSIAN_WORD} = "ok";`;

    expect(findForbiddenCyrillicLines(path, text)).toEqual([
      `${path}:1: ${text}`,
    ]);
  });

  it("refuses Cyrillic in the code part of a template literal", () => {
    const text = `const note = \`ok \${${RUSSIAN_WORD}} ok\`;`;

    expect(findForbiddenCyrillicLines(path, text)).toEqual([
      `${path}:1: ${text}`,
    ]);
  });

  it("refuses Cyrillic in a quoted key", () => {
    const text = `export const ru = {\n  "${RUSSIAN_WORD}": "ok",\n};`;

    expect(findForbiddenCyrillicLines(path, text)).toEqual([
      `${path}:2: "${RUSSIAN_WORD}": "ok",`,
    ]);
  });

  it("refuses Cyrillic in a computed key", () => {
    const text = `export const ru = {\n  ["${RUSSIAN_WORD}"]: "ok",\n};`;

    expect(findForbiddenCyrillicLines(path, text)).toEqual([
      `${path}:2: ["${RUSSIAN_WORD}"]: "ok",`,
    ]);
  });

  it("allows a Cyrillic value next to a quoted key", () => {
    const text = `export const ru = {\n  "title": "${RUSSIAN_WORD}",\n};`;

    expect(findForbiddenCyrillicLines(path, text)).toEqual([]);
  });

  it("keeps a later string masked after emoji in an earlier one", () => {
    // Each emoji is two UTF-16 units: blanking it with one space would shift the later string out of its range.
    const emoji = "\u{1F600}".repeat(RUSSIAN_WORD.length + 2);
    const text = `const icon = "${emoji}";\nconst title = "${RUSSIAN_WORD}";`;

    expect(findForbiddenCyrillicLines(path, text)).toEqual([]);
  });

  it("allows nothing when the file cannot be parsed", () => {
    const text = `const title = "${RUSSIAN_WORD}";\nconst = = ;`;

    expect(findForbiddenCyrillicLines(path, text)).toEqual([
      `${path}:1: const title = "${RUSSIAN_WORD}";`,
    ]);
  });
});

describe("the exception of src/i18n/locales.ts", () => {
  const path = "src/i18n/locales.ts";

  function buildLocales(options: {
    readonly englishBlock?: string;
    readonly russianBlock?: string;
    readonly russianOwnName?: string;
    readonly russianOwnNameComment?: string;
    readonly header?: string;
  }): string {
    return [
      options.header ?? "// Locales.",
      "export const LOCALE_DEFINITIONS = {",
      "  en: {",
      '    ownName: "English",',
      options.englishBlock ?? '    pagePath: "",',
      "  },",
      "  ru: {",
      `    ownName: "${options.russianOwnName ?? "Russian"}",${options.russianOwnNameComment ?? ""}`,
      options.russianBlock ?? '    pagePath: "ru/",',
      "  },",
      "};",
    ].join("\n");
  }

  it("allows Cyrillic in the Russian ownName", () => {
    const text = buildLocales({ russianOwnName: RUSSIAN_WORD });

    expect(findForbiddenCyrillicLines(path, text)).toEqual([]);
  });

  it("refuses Cyrillic in another property of the Russian locale", () => {
    const text = buildLocales({
      russianBlock: `    pagePath: "${RUSSIAN_WORD}",`,
    });

    expect(findForbiddenCyrillicLines(path, text)).toEqual([
      `${path}:9: pagePath: "${RUSSIAN_WORD}",`,
    ]);
  });

  it("refuses Cyrillic in the English locale", () => {
    const text = buildLocales({
      englishBlock: `    pagePath: "${RUSSIAN_WORD}",`,
    });

    expect(findForbiddenCyrillicLines(path, text)).toEqual([
      `${path}:5: pagePath: "${RUSSIAN_WORD}",`,
    ]);
  });

  it("refuses Cyrillic in the ownName of the English locale", () => {
    const text = buildLocales({}).replace("English", RUSSIAN_WORD);

    expect(findForbiddenCyrillicLines(path, text)).toEqual([
      `${path}:4: ownName: "${RUSSIAN_WORD}",`,
    ]);
  });

  it("refuses Cyrillic in a comment", () => {
    const text = buildLocales({ header: `// ${RUSSIAN_WORD}` });

    expect(findForbiddenCyrillicLines(path, text)).toEqual([
      `${path}:1: // ${RUSSIAN_WORD}`,
    ]);
  });

  it("refuses Cyrillic in a comment next to the Russian ownName", () => {
    const text = buildLocales({
      russianOwnName: RUSSIAN_WORD,
      russianOwnNameComment: ` // ${RUSSIAN_WORD}`,
    });

    expect(findForbiddenCyrillicLines(path, text)).toEqual([
      `${path}:8: ownName: "${RUSSIAN_WORD}", // ${RUSSIAN_WORD}`,
    ]);
  });

  it("refuses Cyrillic in a string outside LOCALE_DEFINITIONS", () => {
    const text = buildLocales({ russianOwnName: RUSSIAN_WORD }).replace(
      "};",
      `};\nconst note = "${RUSSIAN_WORD}";`,
    );

    expect(findForbiddenCyrillicLines(path, text)).toEqual([
      `${path}:12: const note = "${RUSSIAN_WORD}";`,
    ]);
  });

  it("allows nothing when the Russian locale has no ownName", () => {
    const text = `export const LOCALE_DEFINITIONS = {\n  ru: {\n    label: "${RUSSIAN_WORD}",\n  },\n};`;

    expect(findForbiddenCyrillicLines(path, text)).toEqual([
      `${path}:3: label: "${RUSSIAN_WORD}",`,
    ]);
  });
});

describe("the exception of .claude/settings.json", () => {
  const path = ".claude/settings.json";

  function buildSettings(options: {
    readonly stopStatusMessage?: string;
    readonly stopCommand?: string;
    readonly otherEventStatusMessage?: string;
    readonly description?: string;
  }): string {
    return JSON.stringify(
      {
        description: options.description ?? "Settings",
        hooks: {
          PostToolUse: [
            {
              hooks: [
                {
                  type: "command",
                  command: "record",
                  statusMessage: options.otherEventStatusMessage ?? "Recording",
                },
              ],
            },
          ],
          Stop: [
            {
              hooks: [
                {
                  type: "command",
                  command: options.stopCommand ?? "stop",
                  statusMessage: options.stopStatusMessage ?? "Checking",
                },
              ],
            },
          ],
        },
      },
      undefined,
      2,
    );
  }

  it("allows Cyrillic in the statusMessage of the Stop hook", () => {
    const text = buildSettings({ stopStatusMessage: RUSSIAN_WORD });

    expect(findForbiddenCyrillicLines(path, text)).toEqual([]);
  });

  it("refuses Cyrillic in another key of the Stop hook", () => {
    const text = buildSettings({ stopCommand: RUSSIAN_WORD });

    expect(findForbiddenCyrillicLines(path, text)).toEqual([
      `${path}:20: "command": "${RUSSIAN_WORD}",`,
    ]);
  });

  it("refuses Cyrillic in the statusMessage of another hook event", () => {
    const text = buildSettings({ otherEventStatusMessage: RUSSIAN_WORD });

    expect(findForbiddenCyrillicLines(path, text)).toEqual([
      `${path}:10: "statusMessage": "${RUSSIAN_WORD}"`,
    ]);
  });

  it("refuses Cyrillic anywhere else", () => {
    const text = buildSettings({ description: RUSSIAN_WORD });

    expect(findForbiddenCyrillicLines(path, text)).toEqual([
      `${path}:2: "description": "${RUSSIAN_WORD}",`,
    ]);
  });

  it("allows nothing when the file is not valid JSON", () => {
    const text = `{ "hooks": { "Stop": [ { "hooks": [ { "statusMessage": "${RUSSIAN_WORD}" } ] } ] }`;

    expect(findForbiddenCyrillicLines(path, text)).toEqual([
      `${path}:1: ${text}`,
    ]);
  });
});

describe("a file with a whole-file exception", () => {
  it("allows Cyrillic anywhere", () => {
    const text = `${RUSSIAN_WORD}\n// ${RUSSIAN_WORD}`;

    expect(findForbiddenCyrillicLines("CLAUDE.md", text)).toEqual([]);
  });

  it("covers every file under an excepted directory", () => {
    const path = ".claude/agents/coder.md";

    expect(findForbiddenCyrillicLines(path, RUSSIAN_WORD)).toEqual([]);
  });

  it.each(["src/i18n/ru.test.ts", ".claude/agents-notes.md"])(
    "does not cover %s, a file with a similar path",
    (path) => {
      const text = `// ${RUSSIAN_WORD}`;

      expect(findForbiddenCyrillicLines(path, text)).toEqual([
        `${path}:1: // ${RUSSIAN_WORD}`,
      ]);
    },
  );
});

describe("a file without an exception", () => {
  const path = "src/example.ts";

  it("names the path and the line of every line with Cyrillic, trimmed", () => {
    const text = `first line\n  ${RUSSIAN_WORD} world  \nthird\n${RUSSIAN_WORD}`;

    expect(findForbiddenCyrillicLines(path, text)).toEqual([
      `${path}:2: ${RUSSIAN_WORD} world`,
      `${path}:4: ${RUSSIAN_WORD}`,
    ]);
  });

  it("counts lines the same way for Windows line breaks", () => {
    const text = `a\r\n${RUSSIAN_WORD}\r\nb`;

    expect(findForbiddenCyrillicLines(path, text)).toEqual([
      `${path}:2: ${RUSSIAN_WORD}`,
    ]);
  });

  it.each([
    ["Latin", "Hello, Ann"],
    ["Greek", "Γεια σου"],
    ["CJK", "垃圾"],
    ["emoji", "\u{1F469}‍\u{1F469}‍\u{1F467}"],
    ["typography and currency", "1 250,50 ₽ — → … −"],
  ])("accepts %s", (_title, line) => {
    expect(findForbiddenCyrillicLines(path, line)).toEqual([]);
  });

  it("reports a mixed line in full", () => {
    const line = `const label = "Add ${RUSSIAN_WORD}";`;

    expect(findForbiddenCyrillicLines(path, line)).toEqual([
      `${path}:1: ${line}`,
    ]);
  });
});

describe("RUSSIAN_EXCEPTIONS", () => {
  const trackedFiles = listTrackedFiles();

  it.each(RUSSIAN_EXCEPTIONS.map(({ path }) => path))(
    "%s names a tracked file or a directory with tracked files",
    (exceptedPath) => {
      const isTracked = trackedFiles.some((path) =>
        isCoveredBy(exceptedPath, path),
      );

      expect(isTracked).toBe(true);
    },
  );

  it("gives every exception a reason", () => {
    for (const { reason } of RUSSIAN_EXCEPTIONS) {
      expect(reason).not.toBe("");
    }
  });
});

describe("the repository", () => {
  it("has Cyrillic only where the exceptions allow it", () => {
    const findings = readTrackedTextFiles().flatMap(({ path, text }) =>
      findForbiddenCyrillicLines(path, text),
    );

    expect(findings).toEqual([]);
  });
});
