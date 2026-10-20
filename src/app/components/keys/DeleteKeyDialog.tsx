import type { ApiKey } from '../../../core/types';
import { useStore } from '../../store/useStore';
import {
  AlertDialogRoot as AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export function DeleteKeyDialog({
  deletingKey,
  onClose,
}: {
  deletingKey: ApiKey | null;
  onClose: () => void;
}) {
  const deleteKey = useStore((state) => state.deleteKey);
  const setSelectedKeyId = useStore((state) => state.setSelectedKeyId);

  return (
    <AlertDialog
      open={!!deletingKey}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete permanently</AlertDialogTitle>
          <AlertDialogDescription>
            Delete "{deletingKey?.name}" from the vault? This cannot be undone;
            existing backups and cloud file history may still contain it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (!deletingKey) return;
              setSelectedKeyId(null);
              deleteKey(deletingKey.id);
              toast.success(`Deleted "${deletingKey.name}"`);
              onClose();
            }}
            className="bg-danger text-white hover:bg-danger/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
