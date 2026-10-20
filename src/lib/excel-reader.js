let pending;

// A stable local browser bundle keeps uploads working in tabs opened before a rebuild.
export async function loadExcelReader() {
  if (typeof document === "undefined") return (await import("exceljs")).default;
  if (globalThis.ExcelJS?.Workbook) return globalThis.ExcelJS;
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/vendor/exceljs.min.js";
      script.async = true;
      const timer = setTimeout(() => fail(), 15000);
      const fail = () => {
        clearTimeout(timer);
        script.remove();
        reject(new Error("The Excel reader could not load. Check your connection to the tournament desk and select the file again. You can also import a CSV file."));
      };
      script.onload = () => {
        if (!globalThis.ExcelJS?.Workbook) return fail();
        clearTimeout(timer);
        resolve(globalThis.ExcelJS);
      };
      script.onerror = fail;
      document.head.append(script);
    }).catch(error => { pending = undefined; throw error; });
  }
  return pending;
}
