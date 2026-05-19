import { useParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useMachine } from '../../hooks/useMachine';

export function EditMachinePage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);

  if (!user || !id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  const { machine, loading, error } = useMachine({ siteId: user.siteId, machineId: id });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading machine...</p>
      </div>
    );
  }

  if (error || !machine) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Machine Not Found</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // TODO: Reuse the form from AddMachinePage but pre-fill with machine data
  // This is a placeholder - the form logic would be similar to AddMachinePage

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">Edit Machine</h1>
          <p className="text-gray-600 text-sm mt-1">{machine.name}</p>
          <p className="text-gray-500 text-xs mt-2">Last updated by {machine.updatedBy} on {new Date(machine.updatedAt.seconds * 1000).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-gray-600">Edit form - coming soon. Reuse form from AddMachinePage.</p>
        </div>
      </div>
    </div>
  );
}
