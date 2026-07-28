import { Layers } from 'lucide-react';

/** Loading spinner shown while a module library query is in flight. */
export function LibraryLoading() {
  return (
    <div className="flex items-center justify-center py-16 text-gray-400">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}

/** Empty state for a module library with no matching modules. */
export function LibraryEmpty({ message = 'No modules found.' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center py-16 text-gray-400">
      <Layers className="w-10 h-10 mb-2" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
