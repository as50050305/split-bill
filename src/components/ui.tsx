import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { formatMoney } from '../core/money';
import { goBack, href } from '../router';
import type { Route } from '../router';
import { cx } from '../utils';
import { Icon } from './icons';
import type { IconName } from './icons';

export function AppBar({
  title,
  eyebrow,
  back,
  actions,
  children,
}: {
  title: string;
  eyebrow?: string;
  back?: Route | true;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="appbar">
      <div className="appbar-row">
        {back && <Sq icon="back" label="返回" onClick={() => goBack(back === true ? undefined : back)} />}
        <h1>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          {title}
        </h1>
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
        <Icon name="suitcase" size={20} /> 旅程
      </a>
      <a href={href({ name: 'favorites' })} className={cx(active === 'favorites' && 'active')}>
        <Icon name="users" size={20} /> 常用名單
      </a>
    </nav>
  );
}

/** 斜切雙色膠囊按鈕：左邊墨色文字、右邊莫蘭迪色塊放圖示 */
export function Pill({
  label,
  icon = 'plus',
  tone,
  light,
  block,
  disabled,
  className,
  onClick,
}: {
  label: string;
  icon?: IconName;
  tone?: 'rose' | 'blue' | 'clay' | 'mustard';
  light?: boolean;
  block?: boolean;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button className={cx('pill', tone, light && 'light', block && 'block', className)} disabled={disabled} onClick={onClick}>
      <span className="pill-label">{label}</span>
      <span className="pill-icon">
        <Icon name={icon} size={24} />
      </span>
    </button>
  );
}

/** 方形圖示按鈕 */
export function Sq({
  icon,
  label,
  tone,
  small,
  flat,
  disabled,
  onClick,
}: {
  icon: IconName;
  label: string;
  tone?: 'ink' | 'rose' | 'blue' | 'sage';
  small?: boolean;
  flat?: boolean;
  disabled?: boolean;
  onClick: (e: MouseEvent) => void;
}) {
  return (
    <button className={cx('sq', tone, small && 'sm', flat && 'flat')} aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      <Icon name={icon} size={small ? 18 : 20} />
    </button>
  );
}

export function Fab({ label, icon, tone, onClick, noNav }: { label: string; icon?: IconName; tone?: 'rose' | 'blue' | 'clay' | 'mustard'; onClick: () => void; noNav?: boolean }) {
  return <Pill className={cx('fab', noNav && 'no-nav')} label={label} icon={icon} tone={tone} onClick={onClick} />;
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

const TONES = ['sage', 'rose', 'blue', 'clay', 'lilac', 'mustard', 'olive'];
export function Avatar({ name, index, small }: { name: string; index: number; small?: boolean }) {
  return <span className={cx('avatar', `tone-${TONES[Math.max(0, index) % TONES.length]}`, small && 'sm')}>{[...name.trim()][0] ?? '?'}</span>;
}

export function Check({ on, round }: { on: boolean; round?: boolean }) {
  return <span className={cx('check', on && 'on', round && 'round-check')}>{on && <Icon name="check" size={16} />}</span>;
}

export function Empty({ icon, tone = 'olive', title, hint }: { icon: IconName; tone?: string; title: string; hint?: string }) {
  return (
    <div className="empty">
      <span className={cx('tile', `tone-${tone}`)}>
        <Icon name={icon} size={30} />
      </span>
      <p style={{ fontWeight: 700, color: 'var(--text)' }}>{title}</p>
      {hint && <p className="faint" style={{ fontSize: 14 }}>{hint}</p>}
    </div>
  );
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
