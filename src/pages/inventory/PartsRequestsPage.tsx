import { RequestsQueue } from '@/components/inventory/requests/RequestsQueue';

export function PartsRequestsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-[Sora]">Parts Requests</h1>
        <p className="text-gray-500 text-sm mt-0.5">Review and manage parts requests from technicians.</p>
      </div>
      <RequestsQueue />
    </div>
  );
}
export default PartsRequestsPage;
