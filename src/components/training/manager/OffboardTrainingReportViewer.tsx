import { X, Download, Globe2 } from 'lucide-react';
import type { TrainingAssignment } from '@/lib/training/trainingTypes';
import { OFFBOARD_MODE_LABELS } from '@/lib/training/offboardTraining';

interface OffboardTrainingReportViewerProps {
  assignment: TrainingAssignment;
  onClose: () => void;
}

function formatDate(value: unknown): string {
  if (!value) return '';
  const d = (value as { toDate?: () => Date }).toDate
    ? (value as { toDate: () => Date }).toDate()
    : new Date(value as string);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function OffboardTrainingReportViewer({
  assignment,
  onClose,
}: OffboardTrainingReportViewerProps) {
  const details = assignment.offboardDetails;
  const completion = assignment.offboardCompletion;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-xl max-w-2xl w-full shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Globe2 className="w-5 h-5 text-purple-500" />
            <h2 className="text-base font-semibold text-gray-900">{assignment.moduleName}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Training Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">Trainee</span><p className="text-gray-800">{assignment.traineeName}</p></div>
              <div><span className="text-gray-400">Provider</span><p className="text-gray-800">{details?.thirdPartyCompany || ''}</p></div>
              <div><span className="text-gray-400">Country</span><p className="text-gray-800">{details?.country || ''}</p></div>
              <div><span className="text-gray-400">Mode</span><p className="text-gray-800">{details?.mode ? OFFBOARD_MODE_LABELS[details.mode] : ''}</p></div>
              <div><span className="text-gray-400">Duration</span><p className="text-gray-800">{details?.durationDays ?? 0} day(s)</p></div>
              <div><span className="text-gray-400">Dates</span><p className="text-gray-800">{formatDate(details?.startDate)} — {formatDate(details?.endDate)}</p></div>
            </div>
          </div>

          {completion?.reportSubmittedAt ? (
            <>
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Knowledge Gained</h3>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{completion.knowledgeGained}</p>
              </div>

              {completion.assessmentAnswers?.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Assessment Q&A</h3>
                  <div className="space-y-3">
                    {completion.assessmentAnswers.map((qa, i) => (
                      <div key={i}>
                        <p className="text-sm font-medium text-gray-700">{qa.question}</p>
                        <p className="text-sm text-gray-600">{qa.answer || ''}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(completion.attachmentUrls?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Attachments</h3>
                  <ul className="space-y-1">
                    {completion.attachmentUrls.map((url) => (
                      <li key={url}>
                        <a href={url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                          {url.split('/').pop()?.split('?')[0]}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {completion.reportGeneratedPdfUrl ? (
                <a
                  href={completion.reportGeneratedPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-4 py-2"
                >
                  <Download className="w-4 h-4" /> Download PDF Report
                </a>
              ) : (
                <p className="text-xs text-gray-400">PDF report is being generated.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              Knowledge report not yet submitted by the trainee.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
