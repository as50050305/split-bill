import { formatMoney } from '../core/money';
import type { TripSummary } from '../core/balance';
import type { Payment, Trip } from '../core/types';

/** 分享用圖片固定用淺色版（在 LINE 聊天室裡最好讀） */
const W = 1080;
const PAD = 64;
const C = {
  bg: '#f2f0eb',
  card: '#ffffff',
  line: '#eeebe5',
  ink: '#1d1c1a',
  inkOn: '#f7f5f1',
  muted: '#76726a',
  faint: '#aaa59c',
  pos: '#5a7a57',
  neg: '#a5625a',
};
const TONES = ['#a7b8a3', '#d4b3ad', '#a0b2c1', '#d0b096', '#b7acc2', '#d6c591', '#b4af9b'];
const UI = `system-ui, -apple-system, 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif`;
const NUM = `'Manrope Variable', ${UI}`;

export interface SettlementImageInput {
  trip: Trip;
  summary: TripSummary;
  payments: Payment[];
  dateRange?: string;
}

/** 把結算結果畫成 PNG，回傳 data URL */
export function drawSettlementImage({ trip, summary, payments, dateRange }: SettlementImageInput): string {
  const name = (id: string) => trip.members.find((m) => m.id === id)?.name ?? '?';
  const toneOf = (id: string) => TONES[Math.max(0, trip.members.findIndex((m) => m.id === id)) % TONES.length];
  const rows = summary.balances;
  const transfers = summary.transfers;
  const isPool = trip.mode === 'pool';

  const ROW = 84;
  const heroH = 330;
  const tableH = 96 + rows.length * ROW + 24;
  const items = transfers.length + payments.length;
  const transferH = 96 + Math.max(1, items) * ROW + (isPool ? 76 : 0) + 24;
  const H = PAD + heroH + 32 + tableH + 32 + transferH + 110;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.textBaseline = 'middle';

  const font = (size: number, weight = 400, family = UI) => (ctx.font = `${weight} ${size}px ${family}`);
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
  const rect = (x: number, y: number, w: number, h: number, r: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  };
  const avatar = (id: string, x: number, cy: number) => {
    rect(x, cy - 24, 48, 48, 14, toneOf(id));
    font(24, 800);
    text([...name(id)][0] ?? '?', x + 24, cy + 1, C.ink, 'center');
  };
  const money = (n: number, signed = false) => (signed && n > 0 ? '+' : '') + formatMoney(n);

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // ── 墨色主卡 ──
  const cx = PAD - 16;
  const cw = W - cx * 2;
  let y = PAD;
  rect(cx, y, cw, heroH, 36, C.ink);
  font(24, 800, NUM);
  ctx.letterSpacing = '6px';
  text('SETTLEMENT', cx + 48, y + 60, C.faint);
  ctx.letterSpacing = '0px';
  font(54, 800);
  text(ellipsis(trip.name, cw - 96), cx + 48, y + 124, C.inkOn);
  font(28, 500);
  text([isPool ? '公費制' : '各自付款', `${trip.members.length} 人`, dateRange].filter(Boolean).join('  ·  '), cx + 48, y + 180, C.faint);
  font(26, 700);
  text('總支出', cx + 48, y + 260, C.faint);
  font(64, 800, NUM);
  text(formatMoney(summary.totalExpense), cx + cw - 48, y + 258, C.inkOn, 'right');
  const tw = ctx.measureText(formatMoney(summary.totalExpense)).width;
  font(28, 800, NUM);
  text('NT$', cx + cw - 60 - tw, y + 266, C.faint, 'right');
  y += heroH + 32;

  // ── 每人收支 ──
  rect(cx, y, cw, tableH, 32, C.card);
  const cols = [cx + 40, 600, 790, cx + cw - 40];
  font(22, 800);
  ctx.letterSpacing = '3px';
  text('成員', cols[0], y + 56, C.muted);
  text(isPool ? '投入' : '已付', cols[1], y + 56, C.muted, 'right');
  text('應付', cols[2], y + 56, C.muted, 'right');
  text('淨額', cols[3], y + 56, C.muted, 'right');
  ctx.letterSpacing = '0px';
  let ry = y + 96;
  for (const r of rows) {
    ctx.fillStyle = C.line;
    ctx.fillRect(cx + 32, ry, cw - 64, 2);
    const cy = ry + ROW / 2;
    avatar(r.memberId, cols[0], cy);
    font(32, 700);
    text(ellipsis(name(r.memberId), 240), cols[0] + 66, cy, C.ink);
    font(32, 600, NUM);
    text(formatMoney(r.paid), cols[1], cy, C.ink, 'right');
    text(formatMoney(r.owed), cols[2], cy, C.ink, 'right');
    font(34, 800, NUM);
    text(money(r.net, true), cols[3], cy, r.net > 0 ? C.pos : r.net < 0 ? C.neg : C.faint, 'right');
    ry += ROW;
  }
  y += tableH + 32;

  // ── 轉帳清單 ──
  rect(cx, y, cw, transferH, 32, C.card);
  font(22, 800);
  ctx.letterSpacing = '3px';
  text('轉帳清單', cx + 40, y + 56, C.muted);
  ctx.letterSpacing = '0px';
  ry = y + 96;
  const drawTransfer = (from: string, to: string, amount: number, done: boolean) => {
    ctx.fillStyle = C.line;
    ctx.fillRect(cx + 32, ry, cw - 64, 2);
    const cy = ry + ROW / 2;
    ctx.globalAlpha = done ? 0.45 : 1;
    avatar(from, cx + 40, cy);
    font(32, 700);
    const fromName = ellipsis(name(from), 170);
    text(fromName, cx + 106, cy, C.ink);
    const ax = cx + 106 + ctx.measureText(fromName).width + 22;
    ctx.strokeStyle = C.faint;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax, cy);
    ctx.lineTo(ax + 34, cy);
    ctx.moveTo(ax + 24, cy - 10);
    ctx.lineTo(ax + 34, cy);
    ctx.lineTo(ax + 24, cy + 10);
    ctx.stroke();
    avatar(to, ax + 56, cy);
    font(32, 700);
    text(ellipsis(name(to), 170), ax + 122, cy, C.ink);
    font(38, 800, NUM);
    text(formatMoney(amount), cx + cw - 40 - (done ? 112 : 0), cy, C.ink, 'right');
    ctx.globalAlpha = 1;
    if (done) {
      rect(cx + cw - 136, cy - 20, 96, 40, 10, '#a7b8a3');
      font(22, 800);
      text('已還', cx + cw - 88, cy + 1, C.ink, 'center');
    }
    ry += ROW;
  };
  for (const t of transfers) drawTransfer(t.fromId, t.toId, t.amount, false);
  for (const p of payments) drawTransfer(p.fromId, p.toId, p.amount, true);
  if (items === 0) {
    font(32, 700);
    text('大家都結清了', W / 2, ry + ROW / 2, C.pos, 'center');
    ry += ROW;
  }
  if (isPool && trip.custodianId) {
    font(26, 500);
    text(`公費餘額 NT$ ${formatMoney(summary.poolBalance)}，由保管人 ${name(trip.custodianId)} 多退少補`, cx + 40, ry + 46, C.muted);
  }
  y += transferH;

  // ── 頁尾 ──
  const d = new Date();
  font(22, 700, NUM);
  ctx.letterSpacing = '4px';
  text(`SPLIT BILL · ${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`, W / 2, y + 58, C.faint, 'center');
  ctx.letterSpacing = '0px';

  return canvas.toDataURL('image/png');
}
