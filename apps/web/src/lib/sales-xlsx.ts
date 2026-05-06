import ExcelJS from "exceljs";

export interface ParsedSale {
  showAtSec: number;
  buyerName: string;
  productName: string;
  price: string | null;
}

export async function parseSalesXlsx(buffer: ArrayBuffer | Buffer): Promise<ParsedSale[]> {
  const wb = new ExcelJS.Workbook();
  const buf = buffer instanceof ArrayBuffer ? Buffer.from(buffer) : buffer;
  await wb.xlsx.load(buf);
  const sheet = wb.worksheets[0];
  if (!sheet) return [];

  const rows: ParsedSale[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
    if (rowNum === 1) return;
    const h = String(row.getCell(1).value ?? "").trim();
    const m = String(row.getCell(2).value ?? "").trim();
    const s = String(row.getCell(3).value ?? "").trim();
    const buyer = String(row.getCell(4).value ?? "").trim();
    const product = String(row.getCell(5).value ?? "").trim();
    const price = String(row.getCell(6).value ?? "").trim();
    if (!buyer || !product) return;
    const sec =
      (Number.parseInt(h || "0", 10) || 0) * 3600 +
      (Number.parseInt(m || "0", 10) || 0) * 60 +
      (Number.parseInt(s || "0", 10) || 0);
    rows.push({
      showAtSec: sec,
      buyerName: buyer.slice(0, 80),
      productName: product.slice(0, 120),
      price: price ? price.slice(0, 20) : null
    });
  });
  return rows;
}

export async function buildSalesXlsx(notifications: ParsedSale[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Vendas");
  sheet.columns = [
    { header: "Hora", key: "h", width: 8 },
    { header: "Minuto", key: "m", width: 10 },
    { header: "Segundo", key: "s", width: 10 },
    { header: "Nome do comprador", key: "buyer", width: 24 },
    { header: "Produto", key: "product", width: 36 },
    { header: "Preço", key: "price", width: 18 }
  ];
  for (const n of notifications) {
    const h = Math.floor(n.showAtSec / 3600);
    const m = Math.floor((n.showAtSec % 3600) / 60);
    const s = n.showAtSec % 60;
    sheet.addRow({
      h: String(h).padStart(2, "0"),
      m: String(m).padStart(2, "0"),
      s: String(s).padStart(2, "0"),
      buyer: n.buyerName,
      product: n.productName,
      price: n.price ?? ""
    });
  }
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
