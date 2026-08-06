import { X, Award } from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';
import type { ProgramAssignment } from '@/types/trainingProgram';

function formatDate(ts: Timestamp | null | undefined): string {
  if (!ts) return '—';
  return (ts as unknown as { toDate: () => Date }).toDate().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface CertificateViewProps {
  programAssignment: ProgramAssignment;
  onClose: () => void;
}

export default function CertificateView({ programAssignment: pa, onClose }: CertificateViewProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:bg-white">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto print:shadow-none print:max-h-none">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 print:hidden">
          <h3 className="text-base font-semibold text-gray-900">Certificate of Completion</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 space-y-6 text-center border-8 border-double border-amber-200 m-4 rounded-lg">
          <Award className="w-12 h-12 text-amber-500 mx-auto" />
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-400">Certificate of Completion</p>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">{pa.traineeName}</h2>
            <p className="text-sm text-gray-500 mt-1">has successfully completed the training program</p>
            <p className="text-lg font-semibold text-blue-700 mt-1">{pa.programName}</p>
          </div>

          <div className="text-left">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Modules Completed</h4>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
              {(pa.certificate?.moduleResults ?? []).map((m) => (
                <div key={m.moduleId} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-gray-800">{m.moduleName}</span>
                  <span className="text-gray-500">{m.score}%</span>
                </div>
              ))}
            </div>
          </div>

          {pa.signOff?.note && (
            <div className="text-left">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Note</h4>
              <p className="text-sm text-gray-700">{pa.signOff.note}</p>
            </div>
          )}

          <div className="pt-6 flex items-end justify-between text-left">
            <div>
              <p className="text-xs text-gray-400">Issued</p>
              <p className="text-sm text-gray-700">{formatDate(pa.certificate?.issuedAt)}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-gray-900">{pa.signOff?.signedOffByName}</p>
              <p className="text-xs text-gray-500 capitalize">{pa.signOff?.signedOffByRole?.replace('_', ' ')}</p>
              <p className="text-xs text-gray-400 mt-1 border-t border-gray-300 pt-1">Signed</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 print:hidden">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
