import { createFileRoute } from '@tanstack/react-router';
import { SettingsLayout } from '@/app/components/layout/SettingsLayout';
import { SettingsPage } from '@/app/components/settings/SettingsPage';

export const Route = createFileRoute('/_authenticated/settings')({
  component: () => (
    <SettingsLayout>
      <SettingsPage />
    </SettingsLayout>
  ),
});
