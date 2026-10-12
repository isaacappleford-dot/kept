import { createStore, useStore } from './store';

interface ToastState {
  message: string | null;
  id: number;
}

const toastStore = createStore<ToastState>({ message: null, id: 0 });
let timer = 0;

/** Short, friendly status message (announced politely to screen readers). */
export function toast(message: string, ms = 2600) {
  clearTimeout(timer);
  toastStore.set((s) => ({ message, id: s.id + 1 }));
  timer = window.setTimeout(() => toastStore.set({ message: null }), ms);
}

export const useToast = () => useStore(toastStore);
