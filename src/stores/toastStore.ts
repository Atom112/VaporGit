import { createStore } from 'solid-js/store';

export interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  detail?: string;
  exiting?: boolean;
}

let nextId = 0;
const [toasts, setToasts] = createStore<{ items: ToastItem[] }>({ items: [] });

export function addToast(message: string, arg2?: string, arg3?: string) {
  const id = nextId++;
  let type: 'success' | 'error' | 'info';
  let detail: string | undefined;
  if (arg2 === 'success' || arg2 === 'error' || arg2 === 'info') {
    // addToast(message, type) or addToast(message, type, detail)
    type = arg2;
    detail = arg3;
  } else {
    // addToast(message, detail, type)
    detail = arg2;
    type = (arg3 === 'success' || arg3 === 'error' || arg3 === 'info') ? arg3 : 'error';
  }
  const item: ToastItem = detail ? { id, message, type, detail } : { id, message, type };
  setToasts('items', (items) => [...items, item]);
  setTimeout(() => markExiting(id), 5000);
}

export function markExiting(id: number) {
  setToasts('items', (items) =>
    items.map((t) => (t.id === id ? { ...t, exiting: true } : t))
  );
  setTimeout(() => removeToast(id), 250);
}

export function removeToast(id: number) {
  setToasts('items', (items) => items.filter((t) => t.id !== id));
}

export { toasts };