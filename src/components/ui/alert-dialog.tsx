import { AlertDialog } from "@base-ui/react/alert-dialog"
import { cn } from "@/lib/utils"

export const AlertDialogRoot = AlertDialog.Root

export function AlertDialogContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <AlertDialog.Portal>
      <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/30" />
      <AlertDialog.Popup
        className={cn(
          "fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%]",
          "bg-canvas-raised border border-line rounded-lg shadow-dialog p-6",
          "data-[state=open]:animate-dialog-enter data-[state=closed]:animate-dialog-exit",
          className
        )}
        {...props}
      />
    </AlertDialog.Portal>
  )
}

export function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
}

export function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6", className)} {...props} />
}

export const AlertDialogTitle = AlertDialog.Title
export const AlertDialogDescription = AlertDialog.Description

export function AlertDialogCancel({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <AlertDialog.Close
      className={cn(
        "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium",
        "bg-surface-2 border border-line text-ink-secondary hover:bg-surface-3 transition-colors",
        className
      )}
      {...props}
    />
  )
}

export function AlertDialogAction({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <AlertDialog.Close
      className={cn("inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors", className)}
      {...props}
    />
  )
}
