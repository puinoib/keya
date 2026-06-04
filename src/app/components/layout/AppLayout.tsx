import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { KeyForm } from '../keys/KeyForm';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStore } from '../../store/useStore';

export function AppLayout() {
  const { showAddForm, setShowAddForm } = useStore();

  return (
    <div className="flex h-screen bg-canvas-panel text-ink-primary overflow-hidden">
      <Sidebar />

      <div className="flex flex-1 flex-col min-w-0 p-3 pl-0">
        <div className="flex flex-1 flex-col min-h-0 rounded-xl bg-canvas-base border border-line-subtle overflow-hidden">
          <TopBar />

          <ScrollArea className="flex-1">
            <main className="flex min-h-full">
              <Outlet />
            </main>
          </ScrollArea>
        </div>
      </div>

      <KeyForm open={showAddForm} onClose={() => setShowAddForm(false)} />
    </div>
  );
}
