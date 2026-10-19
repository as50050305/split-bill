import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { formatMoney } from '../core/money';
import { goBack, href } from '../router';
import type { Route } from '../router';
import { cx } from '../utils';

export function AppBar({
  title,
  back,
  actions,
  children,
}: {
  title: string;
  back?: Route | true;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="appbar">
      <div className="appbar-row">
        {back && (
          <button className="icon-btn" aria-label="返回" onClick={() => goBack(back === true ? undefined : back)}>
            ←
          </button>
        )}
        <h1>{title}</h1>
        {actions}
      </div>
      {children}
    </header>
  );
}

export function BottomNav({ active }: { active: 'trips' | 'favorites' }) {
  return (
    <nav className="bottom-nav">
      <a href={href({ name: 'trips' })} className={cx(active === 'trips' && 'active')}>
        🧳 旅程
      </a>
      <a href={href({ name: 'favorites' })} className={cx(active === 'favorites' && 'active')}>
        👥 常用名單
      </a>
    </nav>
  );
}

export function Fab({ label, onClick, noNav }: { label: string; onClick: () => void; noNav?: boolean }) {
  return (
    <button className={cx('fab', noNav && 'no-nav')} onClick={onClick}>
      <span className="plus">＋</span>
      {label}
    </button>
  );
}

export function Money({ value, signed, className }: { value: number; signed?: boolean; className?: string }) {
  const tone = signed ? (value > 0 ? 'pos' : value < 0 ? 'neg' : 'muted') : undefined;
  const text = signed && value > 0 ? `+${formatMoney(value)}` : formatMoney(value);
  return <span className={cx('num', tone, className)}>{text}</span>;
}

/** 整數金額輸入：只接受數字，顯示千分位 */
export function MoneyInput({
  value,
  onChange,
  size,
  autoFocus,
  placeholder = '0',
  invalid,
  ariaLabel,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  size?: 'big' | 'sm';
  autoFocus?: boolean;
  placeholder?: string;
  invalid?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div className={cx('money-input', size)}>
      <span className="prefix">NT$</span>
      <input
        className={cx('input', invalid && 'error')}
        inputMode="numeric"
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={ariaLabel}
        value={value === null ? '' : formatMoney(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
          onChange(digits === '' ? null : Math.min(Number(digits), 1_000_000_000));
        }}
        onFocus={(e) => e.target.select()}
      />
    </div>
  );
}

const AVATAR_COLORS = ['#3ddc97', '#6cb6ff', '#ffbf5f', '#ff8fb1', '#b59cff', '#5fe0e0', '#ff9a6b', '#c4e05f'];
export function Avatar({ name, index }: { name: string; index: number }) {
  return (
    <span className="avatar" style={{ background: AVATAR_COLORS[index % AVATAR_COLORS.length] }}>
      {[...name.trim()][0] ?? '?'}
    </span>
  );
}
export const avatarColor = (i: number) => AVATAR_COLORS[i % AVATAR_COLORS.length];

export function Check({ on, round }: { on: boolean; round?: boolean }) {
  return <span className={cx('check', on && 'on', round && 'round-check')}>{on ? '✓' : ''}</span>;
}

export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function ConfirmSheet({
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose}>
      <h2>{title}</h2>
      {body && <div className="body">{body}</div>}
      <div className="btn-row">
        <button className="btn ghost lg" onClick={onClose}>
          取消
        </button>
        <button
          className={cx('btn lg', danger ? 'danger' : 'primary')}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}

/** 輸入一行文字的對話框（新增/改名） */
export function PromptSheet({
  title,
  initial = '',
  placeholder,
  confirmLabel = '儲存',
  onSubmit,
  onClose,
}: {
  title: string;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
  onSubmit: (v: string) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState(initial);
  const ok = v.trim().length > 0;
  const submit = () => {
    if (!ok) return;
    onSubmit(v.trim());
    onClose();
  };
  return (
    <Sheet onClose={onClose}>
      <h2>{title}</h2>
      <div className="stack" style={{ marginTop: 12 }}>
        <input
          className="input"
          autoFocus
          value={v}
          maxLength={30}
          placeholder={placeholder}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>
      <div className="btn-row">
        <button className="btn ghost lg" onClick={onClose}>
          取消
        </button>
        <button className="btn primary lg" disabled={!ok} onClick={submit}>
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}

// ── Toast ─────────────────────────────────
const ToastCtx = createContext<(msg: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2200);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="toast">{msg}</div>}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
