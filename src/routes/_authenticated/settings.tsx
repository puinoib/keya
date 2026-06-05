import { createFileRoute } from '@tanstack/react-router';
import { SettingsLayout } from '@/app/components/layout/SettingsLayout';

export const Route = createFileRoute('/_authenticated/settings')({
  component: () => <SettingsLayout />,
});