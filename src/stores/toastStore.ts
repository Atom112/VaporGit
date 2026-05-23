import { createStore } from 'solid-js/store';

export interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

let nextId = 0;
const [toasts, setToasts] = createStore<{ items: ToastItem[] }>({ items: [] });

export function addToast(message: string, type: 'success' | 'error' | 'info') {
  const id = nextId++;
  setToasts('items', (items) => [...items, { id, message, type }]);
  setTimeout(() => removeToast(id), 5000);
}

export function removeToast(id: number) {
  setToasts('items', (items) => items.filter((t) => t.id !== id));
}

export { toasts };
