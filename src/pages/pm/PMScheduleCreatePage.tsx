import { useMediaQuery } from '../../hooks/useMediaQuery';
import PMScheduleCreateForm from '../../components/pm/PMScheduleCreateForm';

export default function PMScheduleCreatePage() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Create PM Schedule</h1>
      <PMScheduleCreateForm isDesktop={isDesktop} />
    </div>
  );
}
