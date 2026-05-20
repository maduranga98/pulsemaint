import type { TriageStepLog } from '../../../types/triage';
import TriagePhotoGallery from '../runner/TriagePhotoGallery';

interface Props {
  stepLogs: TriageStepLog[];
}

export default function TriageSessionTimeline({ stepLogs }: Props) {
  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200" />
      {stepLogs.map((log, i) => {
        const time = new Date(log.completedAt.seconds * 1000).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        return (
          <div key={i} className="relative mb-6">
            <div className="absolute -left-4 w-4 h-4 bg-[#1A56DB] rounded-full border-2 border-white" />
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-semibold text-sm text-[#0A1628]">
                  #{log.stepNumber} {log.title}
                </span>
                <span className="text-xs text-gray-400 shrink-0">{time}</span>
              </div>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{log.phase}</span>
              {log.response !== null && (
                <p className="text-sm text-gray-700 mt-2">
                  Response: <span className="font-medium">{String(log.response)}</span>
                </p>
              )}
              {log.notes && <p className="text-sm text-gray-500 italic mt-1">{log.notes}</p>}
              {log.skipped && (
                <p className="text-xs text-amber-600 mt-1">Skipped: {log.skipReason}</p>
              )}
              {log.photoUrls.length > 0 && <TriagePhotoGallery photoUrls={log.photoUrls} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
