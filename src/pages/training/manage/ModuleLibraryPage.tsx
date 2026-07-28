import ModuleLibrarySection from '@/components/training/manager/ModuleLibrarySection';

export default function ModuleLibraryPage() {
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-slate-900 mb-6">Module Library</h1>
      <ModuleLibrarySection title="Modules" />
    </div>
  );
}
