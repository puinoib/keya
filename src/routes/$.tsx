import { createFileRoute } from '@tanstack/react-router';
import { NotFoundPage } from '@/app/components/NotFoundPage';

export const Route = createFileRoute('/$')({
  component: NotFoundPage,
});
