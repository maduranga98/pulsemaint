import { useState } from 'react';
import { MoeDashboard } from '../components/MoeDashboard';
import { MoeMachineDetail } from '../components/MoeMachineDetail';
import type { MoeDateRange } from '../types/moe.types';

type View =
  | { mode: 'dashboard' }
  | { mode: 'detail'; machineId: string; range: MoeDateRange };

export function MoePage() {
  const [view, setView] = useState<View>({ mode: 'dashboard' });

  return (
    <div className="p-6">
      {view.mode === 'dashboard' && (
        <MoeDashboard
          onSelectMachine={(machineId, range) => setView({ mode: 'detail', machineId, range })}
        />
      )}
      {view.mode === 'detail' && (
        <MoeMachineDetail
          machineId={view.machineId}
          initialRange={view.range}
          onBack={() => setView({ mode: 'dashboard' })}
        />
      )}
    </div>
  );
}

export default MoePage;
