// Lấy giá MUA VÀO của vàng từ PNJ (khu vực 00 = TP.HCM) và ghi vào gold.json.
// PNJ trả giá theo nghìn đồng / chỉ, ví dụ 13840 = 13.840.000 đ / chỉ.
// Chỉ ghi lại tệp khi giá đổi, hoặc khi lần kiểm tra trước đã hơn 6 giờ.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const URL_PNJ = 'https://edge-api.pnj.io/ecom-frontend/v1/get-gold-price?zone=00';
const OUT = new URL('../gold.json', import.meta.url);

// Tên loại vàng trong app  ->  mã sản phẩm của PNJ
const MAP = {
  'Vàng miếng SJC': 'SJC',
  'Nhẫn trơn 9999': 'N24K',
};
const MIN = 1_000_000; // 1 triệu / chỉ
const MAX = 100_000_000; // 100 triệu / chỉ
const REFRESH_MS = 6 * 3600 * 1000;

export function extractPrices(json) {
  if (!json || !Array.isArray(json.data)) throw new Error('Dữ liệu PNJ không đúng dạng mong đợi');
  const prices = {};
  for (const [kind, code] of Object.entries(MAP)) {
    const row = json.data.find((r) => r.masp === code);
    const buy = Number(row?.giamua) * 1000;
    if (!Number.isFinite(buy) || buy < MIN || buy > MAX) throw new Error(`Giá "${kind}" không hợp lệ: ${row?.giamua}`);
    prices[kind] = buy;
  }
  return { prices, sourceUpdated: String(json.updateDate ?? '') };
}

async function main() {
  const res = await fetch(URL_PNJ, { headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 gold-price-fetcher' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`PNJ trả HTTP ${res.status}`);
  const { prices, sourceUpdated } = extractPrices(await res.json());

  let old = null;
  try { old = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* chưa có tệp */ }
  const same = old && JSON.stringify(old.prices) === JSON.stringify(prices);
  const fresh = old && Date.now() - Date.parse(old.checkedAt) < REFRESH_MS;
  if (same && fresh) { console.log('Giá không đổi, bỏ qua.'); return; }

  const next = { checkedAt: new Date().toISOString(), source: 'PNJ', sourceUpdated, unit: 'đồng / chỉ, giá mua vào', prices };
  await writeFile(OUT, JSON.stringify(next, null, 2) + '\n');
  console.log('Đã ghi gold.json', next);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error('LỖI:', e.message); process.exit(1); });
}
