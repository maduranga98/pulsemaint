import { useState } from 'react';
import { useAuthStore } from '../../../store/authStore';
import { MoeDashboard } from '../components/MoeDashboard';
import { MoeMachineDetail } from '../components/MoeMachineDetail';
import { MoeConfigPanel } from '../components/MoeConfigPanel';
import type { MoeDateRange } from '../types/moe.types';

type View =
  | { mode: 'dashboard' }
  | { mode: 'detail'; machineId: string; range: MoeDateRange }
  | { mode: 'config' };

export function MoePage() {
  const [view, setView] = useState<View>({ mode: 'dashboard' });
  const role = useAuthStore((s) => s.userProfile?.role);
  const canConfigure = role === 'plant_manager' || role === 'admin';

  return (
    <div className="p-6">
      {view.mode === 'dashboard' && (
        <MoeDashboard
          onSelectMachine={(machineId, range) => setView({ mode: 'detail', machineId, range })}
          onOpenConfig={canConfigure ? () => setView({ mode: 'config' }) : undefined}
          canConfigure={canConfigure}
        />
      )}
      {view.mode === 'detail' && (
        <MoeMachineDetail
          machineId={view.machineId}
          initialRange={view.range}
          onBack={() => setView({ mode: 'dashboard' })}
        />
      )}
      {view.mode === 'config' && <MoeConfigPanel onBack={() => setView({ mode: 'dashboard' })} />}
    </div>
  );
}

export default MoePage;
