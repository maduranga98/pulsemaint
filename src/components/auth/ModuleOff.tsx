import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';

/** Shown instead of a page whose module Lumora switched off for this company. */
export function ModuleOff({ label }: { label: string }) {
  return (
    <div className="min-h-full flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 text-center space-y-3">
        <Lock className="w-8 h-8 text-slate-400 mx-auto" />
        <h1 className="text-lg font-bold text-slate-900">{label} is turned off</h1>
        <p className="text-sm text-slate-600">
          This module isn&apos;t enabled for your company. Contact Lumora support if you need it switched on.
        </p>
        <Link
          to="/app/dashboard"
          className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
