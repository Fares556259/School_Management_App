import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// In-memory transaction/lock simulation: no real student data or database connection.
const students: Array<{ id: string; schoolId: string; nationalId: string }> = [];
const locks = new Map<string, Promise<void>>();
const prisma = {
  $transaction: async (run: any, options: any) => {
    assert.equal(options.isolationLevel, "ReadCommitted");
    let release: (() => void) | undefined;
    let lockedSchool: string | undefined;
    try {
      return await run({
        $executeRaw: async (sql: TemplateStringsArray, schoolId: string) => {
          assert.match(sql.join("?"), /pg_advisory_xact_lock/);
          const previous = locks.get(schoolId);
          const next = new Promise<void>(resolve => { release = resolve; });
          locks.set(schoolId, next);
          await previous;
          lockedSchool = schoolId;
        },
        student: { findMany: async ({ where }: any) => {
          assert.equal(lockedSchool, where.schoolId);
          return students.filter(s => s.schoolId === where.schoolId && where.nationalId.in.includes(s.nationalId));
        } },
      });
    } finally { release?.(); }
  },
};
const source = fs.readFileSync("src/lib/studentIdentifier.ts", "utf8");
const output: any = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
} }).outputText, { exports: output, require: (name: string) => {
  assert.equal(name, "@/lib/prisma"); return { default: prisma };
}, Set, Map });
const save = (schoolId: string, id: string, nationalId: string) => output.withUniqueStudentIdentifiers(
  schoolId, [{ nationalId }], async () => { students.push({ schoolId, id, nationalId }); },
);

async function main() {
  const competing = await Promise.allSettled([save("school-a", "one", "00123"), save("school-a", "two", "00123")]);
  assert.equal(competing.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(students.length, 1, "Competing saves cannot insert a duplicate");
  await save("school-b", "three", "00123");
  assert.equal(students.length, 2, "Same identifier is allowed in a different school");
  await output.withUniqueStudentIdentifiers("school-a", [{ nationalId: "00123", studentId: "one" }], async () => {});
  await assert.rejects(save("school-a", "four", "00123"), /déjà utilisé/);
  await save("school-a", "five", "000123");
  assert.equal(students.length, 3, "Leading zeroes are significant");
  console.log("Identifier checks passed: school isolation, simultaneous saves, own ID, duplicates and leading zeroes. Mock database only.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
