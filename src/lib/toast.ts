export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

type ToastListener = (toasts: ToastMessage[]) => void;

class ToastManager {
  private toasts: ToastMessage[] = [];
  private listeners: ToastListener[] = [];

  subscribe(listener: ToastListener) {
    this.listeners.push(listener);
    listener([...this.toasts]);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l([...this.toasts]));
  }

  show(message: string, type: ToastType = 'success') {
    const id = Math.random().toString(36).substring(2, 9);
    const toastItem: ToastMessage = { id, message, type };
    this.toasts = [...this.toasts, toastItem];
    this.notify();

    setTimeout(() => {
      this.dismiss(id);
    }, 3200);
  }

  success(message: string) {
    this.show(message, 'success');
  }

  error(message: string) {
    this.show(message, 'error');
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }
}

export const toast = new ToastManager();

export function formatClassUpdateToastMessage(
  isSelf: boolean,
  memberName: string,
  newClass: string | null | undefined
): string {
  if (!newClass || newClass === 'Sem Classe') {
    return isSelf
      ? 'Sua classe foi removida com sucesso.'
      : `Classe de ${memberName || 'jogador'} removida com sucesso.`;
  }

  return isSelf
    ? `Sua classe foi atualizada para ${newClass}.`
    : `Classe de ${memberName || 'jogador'} atualizada para ${newClass}.`;
}
