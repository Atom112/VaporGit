import { createStore } from 'solid-js/store';

export interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  exiting?: boolean;
}

let nextId = 0;
const [toasts, setToasts] = createStore<{ items: ToastItem[] }>({ items: [] });

export function addToast(message: string, type: 'success' | 'error' | 'info') {
  const id = nextId++;
  setToasts('items', (items) => [...items, { id, message, type }]);
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