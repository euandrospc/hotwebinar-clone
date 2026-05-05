import ExcelJS from "exceljs";

export interface ParsedChatMessage {
  authorName: string;
  text: string;
  showAtSec: number;
  isOwner: boolean;
}

export async function parseChatXlsx(buffer: ArrayBuffer | Buffer): Promise<ParsedChatMessage[]> {
  const wb = new ExcelJS.Workbook();
  const buf = buffer instanceof ArrayBuffer ? Buffer.from(buffer) : buffer;
  await wb.xlsx.load(buf);
  const sheet = wb.worksheets[0];
  if (!sheet) return [];

  const rows: ParsedChatMessage[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum === 1) return;
    const h = String(row.getCell(1).value ?? "").trim();
    const m = String(row.getCell(2).value ?? "").trim();
    const s = String(row.getCell(3).value ?? "").trim();
    const author = String(row.getCell(4).value ?? "").trim();
    const text = String(row.getCell(5).value ?? "").trim();
    const support = String(row.getCell(6).value ?? "").trim().toLowerCase();
    if (!author || !text) return;
    const sec =
      (Number.parseInt(h || "0", 10) || 0) * 3600 +
      (Number.parseInt(m || "0", 10) || 0) * 60 +
      (Number.parseInt(s || "0", 10) || 0);
    rows.push({
      authorName: author.slice(0, 80),
      text: text.slice(0, 500),
      showAtSec: sec,
      isOwner: support === "true" || support === "sim" || support === "1" || support === "x"
    });
  });
  return rows;
}

export async function buildChatXlsx(messages: ParsedChatMessage[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Mensagens");
  sheet.columns = [
    { header: "Hora para ser enviado", key: "h", width: 22 },
    { header: "Minuto para ser enviado", key: "m", width: 24 },
    { header: "Segundo para ser enviado", key: "s", width: 24 },
    { header: "Nome do participante", key: "author", width: 24 },
    { header: "Texto enviado", key: "text", width: 60 },
    { header: "Suporte(Caso não seja, deixe em branco", key: "owner", width: 30 }
  ];
  for (const msg of messages) {
    const h = Math.floor(msg.showAtSec / 3600);
    const m = Math.floor((msg.showAtSec % 3600) / 60);
    const s = msg.showAtSec % 60;
    sheet.addRow({
      h: String(h).padStart(2, "0"),
      m: String(m).padStart(2, "0"),
      s: String(s).padStart(2, "0"),
      author: msg.authorName,
      text: msg.text,
      owner: msg.isOwner ? "true" : ""
    });
  }
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
