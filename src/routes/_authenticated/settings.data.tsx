import { createFileRoute } from '@tanstack/react-router';
import { DataPage } from '@/app/components/settings/DataPage';

export const Route = createFileRoute('/_authenticated/settings/data')({
  component: () => <DataPage />,
});
