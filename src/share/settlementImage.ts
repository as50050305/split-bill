import { formatMoney } from '../core/money';
import type { TripSummary } from '../core/balance';
import type { Payment, Trip } from '../core/types';

const W = 1080;
const PAD = 64;
const C = {
  bg: '#0e1116',
  card: '#171b22',
  line: '#2c343f',
  text: '#e9edf2',
  muted: '#8b95a4',
  faint: '#5c6573',
  accent: '#3ddc97',
  neg: '#ff7b7b',
};
const FONT = `system-ui, -apple-system, 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif`;

export interface SettlementImageInput {
  trip: Trip;
  summary: TripSummary;
  payments: Payment[];
  dateRange?: string;
}

/** 把結算結果畫成 PNG，回傳 data URL */
export function drawSettlementImage({ trip, summary, payments, dateRange }: SettlementImageInput): string {
  const name = (id: string) => trip.members.find((m) => m.id === id)?.name ?? '?';
  const rows = summary.balances;
  const transfers = summary.transfers;
  const isPool = trip.mode === 'pool';

  // ── 先算高度 ──
  const ROW = 76;
  const headerH = 250;
  const tableH = 90 + rows.length * ROW + 40;
  const transferItems = transfers.length + payments.length;
  const transferH = 90 + Math.max(1, transferItems) * ROW + (isPool ? 70 : 0) + 40;
  const footerH = 100;
  const H = PAD + headerH + tableH + 32 + transferH + footerH;

  const canvas = document.createElement('canvas');
  const scale = 1; // 1080 寬已足夠清晰
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.textBaseline = 'middle';

  const font = (size: number, weight = 400) => (ctx.font = `${weight} ${size}px ${FONT}`);
  const text = (s: string, x: number, y: number, color: string, align: CanvasTextAlign = 'left') => {
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
  };
  const ellipsis = (s: string, max: number) => {
    if (ctx.measureText(s).width <= max) return s;
    let t = s;
    while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
    return t + '…';
  };
  const roundRect = (x: number, y: number, w: number, h: number, r: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  };

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // ── 標題 ──
  let y = PAD;
  font(30, 600);
  text('結算明細', PAD, y + 20, C.accent);
  font(56, 800);
  text(ellipsis(trip.name, W - PAD * 2), PAD, y + 82, C.text);
  font(30);
  const sub = [isPool ? '公費制' : '各自付款', `${trip.members.length} 人`, dateRange].filter(Boolean).join('　·　');
  text(sub, PAD, y + 140, C.muted);
  font(34, 600);
  text('總支出', PAD, y + 200, C.muted);
  font(48, 800);
  text(`NT$ ${formatMoney(summary.totalExpense)}`, W - PAD, y + 200, C.text, 'right');
  y += headerH;

  // ── 每人收支 ──
  const cardX = PAD - 16;
  const cardW = W - (PAD - 16) * 2;
  roundRect(cardX, y, cardW, tableH, 28, C.card);
  const cols = [PAD + 8, 560, 760, W - PAD - 8];
  font(28, 600);
  text('成員', cols[0], y + 50, C.muted);
  text(isPool ? '投入' : '已付', cols[1], y + 50, C.muted, 'right');
  text('應付', cols[2], y + 50, C.muted, 'right');
  text('淨額', cols[3], y + 50, C.muted, 'right');
  let ry = y + 90;
  for (const r of rows) {
    ctx.fillStyle = C.line;
    ctx.fillRect(cardX + 24, ry, cardW - 48, 2);
    const cy = ry + ROW / 2;
    font(34, 700);
    text(ellipsis(name(r.memberId) + (isPool && r.memberId === trip.custodianId ? ' 💰' : ''), 300), cols[0], cy, C.text);
    font(34, 500);
    text(formatMoney(r.paid), cols[1], cy, C.text, 'right');
    text(formatMoney(r.owed), cols[2], cy, C.text, 'right');
    font(34, 800);
    text(r.net > 0 ? `+${formatMoney(r.net)}` : formatMoney(r.net), cols[3], cy, r.net > 0 ? C.accent : r.net < 0 ? C.neg : C.muted, 'right');
    ry += ROW;
  }
  y += tableH + 32;

  // ── 轉帳清單 ──
  roundRect(cardX, y, cardW, transferH, 28, C.card);
  font(28, 600);
  text('轉帳清單', PAD + 8, y + 50, C.muted);
  ry = y + 90;
  const drawTransfer = (from: string, to: string, amount: number, done: boolean) => {
    ctx.fillStyle = C.line;
    ctx.fillRect(cardX + 24, ry, cardW - 48, 2);
    const cy = ry + ROW / 2;
    font(36, 700);
    const color = done ? C.faint : C.text;
    const label = `${name(from)}  →  ${name(to)}`;
    text(ellipsis(label, 560), PAD + 8, cy, color);
    font(38, 800);
    text(`NT$ ${formatMoney(amount)}`, W - PAD - 8 - (done ? 120 : 0), cy, done ? C.faint : C.accent, 'right');
    if (done) {
      font(28, 700);
      text('✓ 已還', W - PAD - 8, cy, C.accent, 'right');
    }
    ry += ROW;
  };
  for (const t of transfers) drawTransfer(t.fromId, t.toId, t.amount, false);
  for (const p of payments) drawTransfer(p.fromId, p.toId, p.amount, true);
  if (transferItems === 0) {
    font(36, 700);
    text('🎉 大家都結清了', W / 2, ry + ROW / 2, C.accent, 'center');
    ry += ROW;
  }
  if (isPool && trip.custodianId) {
    font(28);
    text(`公費餘額 NT$ ${formatMoney(summary.poolBalance)}，由保管人 ${name(trip.custodianId)} 多退少補`, PAD + 8, ry + 44, C.muted);
  }
  y += transferH;

  // ── 頁尾 ──
  font(26);
  const d = new Date();
  text(`分帳本 · ${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} 產生`, W / 2, y + 56, C.faint, 'center');

  return canvas.toDataURL('image/png');
}
