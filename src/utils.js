export { standings } from "../shared/standings.js";
export const groupName = (g) =>
  g === null || g === undefined ? "" : `Group ${String.fromCharCode(65 + g)}`;
export const time = (value) =>
  value
    ? new Date(value).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "To be scheduled";
export function parseCSV(text) {
  const rows = [];
  let row = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(field.trim());
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quote.");
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export async function importTeams(file) {
  if (file.size > 5 * 1024 * 1024)
    throw new Error("Please use a file smaller than 5 MB.");
  let rows;
  if (/\.csv$/i.test(file.name))
    rows = parseCSV((await file.text()).replace(/^\uFEFF/, ""));
  else if (/\.xlsx$/i.test(file.name)) {
    const { default: ExcelJS } = await import("exceljs");
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(await file.arrayBuffer());
    rows = [];
    if (!book.worksheets[0])
      throw new Error("This workbook has no worksheets.");
    book.worksheets[0].eachRow((row) =>
      rows.push(
        row.values
          .slice(1)
          .map((v) => String(v?.text ?? v?.result ?? v ?? "").trim()),
      ),
    );
  } else
    throw new Error(
      "Choose a .csv or .xlsx file. Save older .xls files as .xlsx first.",
    );
  if (rows.length < 2)
    throw new Error("Include a header row and at least one team.");
  const headers = rows
    .shift()
    .map((v) => v.toLowerCase().replace(/[ _-]/g, ""));
  const name = headers.findIndex((h) =>
      ["team", "teamname", "name"].includes(h),
    ),
    seed = headers.indexOf("seed");
  const players = headers
    .map((h, i) => (/^player\d+$/.test(h) ? i : -1))
    .filter((i) => i >= 0)
    .sort((a, b) => Number(headers[a].slice(6)) - Number(headers[b].slice(6)));
  if (name < 0 || !players.length)
    throw new Error(
      "Headers must include team, player1 (and player2, etc. where needed). Seed is optional.",
    );
  return rows
    .filter((r) => r.some(Boolean))
    .map((r) => ({
      name: r[name] || "",
      players: players.map((i) => r[i] || "").filter(Boolean),
      seed: seed >= 0 && r[seed] ? Number(r[seed]) : undefined,
    }));
}
export function download(name, content, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
