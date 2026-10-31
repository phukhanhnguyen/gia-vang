// Lấy tỷ giá MUA VÀO từ Vietcombank và ghi vào fx.json (đồng / 1 đơn vị ngoại tệ).
// Vietcombank yêu cầu tối đa 1 lần gọi mỗi 5 phút; lịch chạy 30 phút/lần là đủ thưa.
// Ưu tiên giá "Buy" (tiền mặt); ngoại tệ không có giá tiền mặt thì dùng giá chuyển khoản ("Transfer").
// Chỉ ghi lại tệp khi tỷ giá đổi, hoặc khi lần kiểm tra trước đã hơn 6 giờ.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const URL_VCB = 'https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx';
const OUT = new URL('../fx.json', import.meta.url);
const WANT = ['USD', 'EUR', 'JPY', 'AUD', 'CAD', 'KRW', 'SGD', 'GBP'];
const REFRESH_MS = 6 * 3600 * 1000;

const num = (s) => {
  const n = Number(String(s ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** "10/31/2026 7:04:10 PM" (tháng/ngày/năm, giờ Việt Nam) -> "31/10/2026 19:04:10" */
export function toVnTime(s) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?$/i.exec(String(s ?? '').trim());
  if (!m) return String(s ?? '').trim();
  let h = Number(m[4]);
  if (m[7]?.toUpperCase() === 'PM' && h < 12) h += 12;
  if (m[7]?.toUpperCase() === 'AM' && h === 12) h = 0;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Number(m[2]))}/${p(Number(m[1]))}/${m[3]} ${p(h)}:${m[5]}:${m[6]}`;
}

export function extractRates(xml) {
  if (!/<ExrateList/i.test(xml)) throw new Error('Dữ liệu Vietcombank không đúng dạng mong đợi');
  const rates = {};
  for (const row of xml.matchAll(/<Exrate([^>]*)\/>/g)) {
    const attrs = Object.fromEntries([...row[1].matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
    const code = attrs.CurrencyCode;
    if (!WANT.includes(code)) continue;
    const v = num(attrs.Buy) ?? num(attrs.Transfer);
    if (v) rates[code] = v;
  }
  if (!(rates.USD >= 10_000 && rates.USD <= 60_000)) throw new Error(`Tỷ giá USD không hợp lệ: ${rates.USD}`);
  const dt = /<DateTime>([^<]*)<\/DateTime>/i.exec(xml)?.[1] ?? '';
  return { rates, sourceUpdated: toVnTime(dt) };
}

async function main() {
  const res = await fetch(URL_VCB, { headers: { accept: 'application/xml,text/xml,*/*', 'user-agent': 'Mozilla/5.0 fx-rate-fetcher' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Vietcombank trả HTTP ${res.status}`);
  const { rates, sourceUpdated } = extractRates(await res.text());

  let old = null;
  try { old = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* chưa có tệp */ }
  const same = old && JSON.stringify(old.rates) === JSON.stringify(rates);
  const fresh = old && Date.now() - Date.parse(old.checkedAt) < REFRESH_MS;
  if (same && fresh) { console.log('Tỷ giá không đổi, bỏ qua.'); return; }

  const next = { checkedAt: new Date().toISOString(), source: 'Vietcombank', sourceUpdated, unit: 'đồng / 1 đơn vị, giá mua vào', rates };
  await writeFile(OUT, JSON.stringify(next, null, 2) + '\n');
  console.log('Đã ghi fx.json', next);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error('LỖI:', e.message); process.exit(1); });
}
