import { useState } from 'react';
import { Pin, X } from 'lucide-react';
import type { FiveSAudit, PillarId } from '../types/fives.types';
import { DEFAULT_CHECKLIST } from '../data/defaultChecklist';
import { useAuthStore } from '../../../store/authStore';
import { updateCorrectiveAction } from '../services/fives.service';

interface BestPracticePhoto {
  photoUrl: string;
  auditId: string;
  zoneId: string;
  zoneName: string;
  pillarId: PillarId;
  pillarName: string;
  checkItemId: string;
  checkItemDescription: string;
  auditorName: string;
  auditDate: string;
  pinned?: boolean;
}

function extractBestPhotos(audits: FiveSAudit[]): BestPracticePhoto[] {
  const photos: BestPracticePhoto[] = [];

  for (const audit of audits) {
    for (const itemScore of audit.itemScores) {
      if (itemScore.score !== 4 || !itemScore.photoUrls?.length) continue;

      const pillar = DEFAULT_CHECKLIST.find((p) =>
        p.checklistItems.some((ci) => ci.id === itemScore.checkItemId),
      );
      const item = pillar?.checklistItems.find((ci) => ci.id === itemScore.checkItemId);
      if (!pillar || !item) continue;

      for (const url of itemScore.photoUrls) {
        photos.push({
          photoUrl: url,
          auditId: audit.id,
          zoneId: audit.zoneId,
          zoneName: audit.zoneName,
          pillarId: pillar.id,
          pillarName: pillar.name,
          checkItemId: item.id,
          checkItemDescription: item.description,
          auditorName: audit.auditorName,
          auditDate: audit.auditDate,
        });
      }
    }
  }

  return photos.sort((a, b) => b.auditDate.localeCompare(a.auditDate));
}

interface BestPracticeGalleryProps {
  audits: FiveSAudit[];
}

export function BestPracticeGallery({ audits }: BestPracticeGalleryProps) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const canPin = ['supervisor', 'admin', 'plant_manager'].includes(userProfile?.role ?? '');

  const [filterPillar, setFilterPillar] = useState<PillarId | ''>('');
  const [filterZone, setFilterZone] = useState('');
  const [lightbox, setLightbox] = useState<BestPracticePhoto | null>(null);

  const allPhotos = extractBestPhotos(audits);

  const zones = [...new Set(allPhotos.map((p) => ({ id: p.zoneId, name: p.zoneName })).map((z) => JSON.stringify(z)))].map((s) => JSON.parse(s) as { id: string; name: string });

  const filtered = allPhotos.filter((p) => {
    if (filterPillar && p.pillarId !== filterPillar) return false;
    if (filterZone && p.zoneId !== filterZone) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterPillar}
          onChange={(e) => setFilterPillar(e.target.value as PillarId | '')}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="">All Pillars</option>
          {DEFAULT_CHECKLIST.map((p) => (
            <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
          ))}
        </select>
        {zones.length > 0 && (
          <select
            value={filterZone}
            onChange={(e) => setFilterZone(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All Zones</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>
        )}
        <span className="text-xs text-slate-500 self-center ml-auto">{filtered.length} best practice photos</span>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-3">⭐</p>
          <p className="text-sm">No "Excellent" (score 4) photos yet.</p>
          <p className="text-xs mt-1">Capture photos when scoring items 4 during audits.</p>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {filtered.map((photo, idx) => (
          <div
            key={idx}
            onClick={() => setLightbox(photo)}
            className="relative bg-[#0F1E35] border border-[#1E3A5F] rounded-xl overflow-hidden cursor-pointer hover:border-blue-500/50 transition-colors group"
          >
            <img
              src={photo.photoUrl}
              alt=""
              className="w-full aspect-square object-cover group-hover:opacity-90 transition-opacity"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-2">
              <p className="text-[10px] font-semibold text-white truncate">{photo.zoneName}</p>
              <p className="text-[10px] text-slate-300/80">{photo.pillarName} · {photo.auditDate}</p>
            </div>
            {photo.pinned && (
              <div className="absolute top-1.5 right-1.5 bg-blue-600 rounded-full p-1">
                <Pin className="h-3 w-3 text-white" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="max-w-lg w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.photoUrl} alt="" className="w-full rounded-xl object-contain max-h-[60vh]" />
            <div className="bg-[#0F1E35] border border-[#1E3A5F] rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{lightbox.checkItemDescription}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {lightbox.pillarName} · {lightbox.zoneName}
                  </p>
                  <p className="text-xs text-slate-500">
                    Audited by {lightbox.auditorName} on {lightbox.auditDate}
                  </p>
                </div>
                {canPin && (
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 border border-blue-600/40 text-blue-400 text-xs font-semibold rounded-lg hover:bg-blue-600/30 transition-colors">
                    <Pin className="h-3.5 w-3.5" />
                    Pin
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => setLightbox(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <X className="h-4 w-4" />
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
