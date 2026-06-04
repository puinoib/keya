import { Toast } from '@base-ui/react/toast';
import { X, CheckCircle, XCircle } from '@phosphor-icons/react';

export { Toast };

const typeStyles: Record<string, string> = {
  success: 'border-success/30',
  error: 'border-danger/30',
};

const typeIcons: Record<string, React.ReactNode> = {
  success: (
    <CheckCircle className="size-4 text-success-bright shrink-0 mt-0.5" />
  ),
  error: <XCircle className="size-4 text-danger shrink-0 mt-0.5" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <Toast.Provider timeout={3000} limit={5}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse items-end w-80 outline-none">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();

  return toasts.map((toast, index) => {
    const isTop = index === toasts.length - 1;
    const style = typeStyles[toast.type ?? ''] ?? '';
    const icon = typeIcons[toast.type ?? ''];

    return (
      <Toast.Root
        key={toast.id}
        toast={toast}
        className={`group flex items-start gap-2.5 rounded-lg border bg-canvas-raised px-3.5 py-2.5 shadow-elevated
                    ${style || 'border-line'}
                    ${!isTop ? 'opacity-60 scale-[0.96] -mt-5' : 'mt-0 scale-100'}
                    transition-all duration-200
                    data-[transition-status=starting]:animate-[toast-in_200ms_ease-out]
                    data-[transition-status=ending]:animate-[toast-out_150ms_ease-in]`}
        style={{ zIndex: index }}
      >
        {icon}
        <Toast.Content className="flex-1 min-w-0">
          <Toast.Title className="text-sm font-medium text-ink-primary leading-snug" />
          <Toast.Description className="text-xs text-ink-tertiary mt-0.5 leading-relaxed" />
        </Toast.Content>
        <Toast.Close
          aria-label="Close"
          className="shrink-0 mt-0.5 size-5 flex items-center justify-center rounded text-ink-quaternary
                     hover:text-ink-secondary hover:bg-surface-3 transition-colors"
        >
          <X className="size-3" />
        </Toast.Close>
      </Toast.Root>
    );
  });
}

export function useToast() {
  return Toast.useToastManager();
}
