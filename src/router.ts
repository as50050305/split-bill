import { useEffect, useState } from 'react';

/**
 * 極簡 hash 路由。每次換頁都會產生瀏覽紀錄，所以 Android 實體返回鍵會自然回到上一頁。
 */
export type Route =
  | { name: 'trips' }
  | { name: 'favorites' }
  | { name: 'tripNew' }
  | { name: 'tripEdit'; tripId: string }
  | { name: 'trip'; tripId: string; tab: 'expenses' | 'pool' | 'settle' }
  | { name: 'expenseNew'; tripId: string }
  | { name: 'expenseEdit'; tripId: string; expenseId: string }
  | { name: 'contributionNew'; tripId: string };

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [a, b, c, d] = parts;
  if (a === 'favorites') return { name: 'favorites' };
  if (a === 'trip' && b === 'new') return { name: 'tripNew' };
  if (a === 'trip' && b) {
    if (c === 'edit') return { name: 'tripEdit', tripId: b };
    if (c === 'expense' && d === 'new') return { name: 'expenseNew', tripId: b };
    if (c === 'expense' && d) return { name: 'expenseEdit', tripId: b, expenseId: d };
    if (c === 'contribution') return { name: 'contributionNew', tripId: b };
    const tab = c === 'pool' || c === 'settle' ? c : 'expenses';
    return { name: 'trip', tripId: b, tab };
  }
  return { name: 'trips' };
}

export function href(r: Route): string {
  switch (r.name) {
    case 'trips':
      return '#/';
    case 'favorites':
      return '#/favorites';
    case 'tripNew':
      return '#/trip/new';
    case 'tripEdit':
      return `#/trip/${r.tripId}/edit`;
    case 'trip':
      return `#/trip/${r.tripId}${r.tab === 'expenses' ? '' : '/' + r.tab}`;
    case 'expenseNew':
      return `#/trip/${r.tripId}/expense/new`;
    case 'expenseEdit':
      return `#/trip/${r.tripId}/expense/${r.expenseId}`;
    case 'contributionNew':
      return `#/trip/${r.tripId}/contribution`;
  }
}

const idx = () => (history.state as { idx?: number } | null)?.idx ?? 0;
const notify = () => window.dispatchEvent(new Event('routechange'));

/** 某些內嵌預覽環境不允許改網址，這時改用記憶體裡的路由堆疊 */
let memoryStack: string[] | null = null;
const currentHash = () => (memoryStack ? memoryStack[memoryStack.length - 1] : location.hash);

export function navigate(r: Route, opts: { replace?: boolean } = {}) {
  const h = href(r);
  if (!memoryStack) {
    try {
      if (opts.replace) history.replaceState({ idx: idx() }, '', h);
      else history.pushState({ idx: idx() + 1 }, '', h);
    } catch {
      memoryStack = [location.hash || '#/'];
    }
  }
  if (memoryStack) {
    if (opts.replace) memoryStack[memoryStack.length - 1] = h;
    else memoryStack.push(h);
  }
  notify();
}

/** 回上一頁；沒有 App 內的上一頁（例如重新整理後）時改去 fallback */
export function goBack(fallback: Route = { name: 'trips' }) {
  if (memoryStack) {
    if (memoryStack.length > 1) {
      memoryStack.pop();
      notify();
    } else navigate(fallback, { replace: true });
    return;
  }
  if (idx() > 0) history.back();
  else navigate(fallback, { replace: true });
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(currentHash()));
  useEffect(() => {
    const on = () => {
      setRoute(parse(currentHash()));
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', on);
    window.addEventListener('hashchange', on);
    window.addEventListener('routechange', on);
    return () => {
      window.removeEventListener('popstate', on);
      window.removeEventListener('hashchange', on);
      window.removeEventListener('routechange', on);
    };
  }, []);
  return route;
}
