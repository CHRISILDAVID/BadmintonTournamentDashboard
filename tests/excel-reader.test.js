import test from "node:test";
import assert from "node:assert/strict";
import { loadExcelReader } from "../src/lib/excel-reader.js";

test("the browser Excel reader uses a stable local asset and retries after a failed load", async () => {
  const documentBefore = globalThis.document, excelBefore = globalThis.ExcelJS;
  const scripts = [];
  globalThis.document = {
    createElement: () => ({ remove() { this.removed = true; } }),
    head: { append(script) { scripts.push(script); } },
  };
  try {
    const failed = loadExcelReader();
    assert.equal(scripts[0].src, "/vendor/exceljs.min.js");
    scripts[0].onerror();
    await assert.rejects(failed, /select the file again/);
    assert.equal(scripts[0].removed, true);
    const a = loadExcelReader(), b = loadExcelReader();
    assert.equal(scripts.length, 2);
    globalThis.ExcelJS = { Workbook: class {} };
    scripts[1].onload();
    assert.equal(await a, globalThis.ExcelJS);
    assert.equal(await b, globalThis.ExcelJS);
    assert.equal(await loadExcelReader(), globalThis.ExcelJS);
    assert.equal(scripts.length, 2);
  } finally {
    if (documentBefore === undefined) delete globalThis.document; else globalThis.document = documentBefore;
    if (excelBefore === undefined) delete globalThis.ExcelJS; else globalThis.ExcelJS = excelBefore;
  }
});
