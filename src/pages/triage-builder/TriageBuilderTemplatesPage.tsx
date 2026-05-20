import { useTranslation } from 'react-i18next';
import { useTriageTemplates } from '../../hooks/triage/useTriageTemplates';
import TriageTemplateCard from '../../components/triage/builder/TriageTemplateCard';
import type { TriageFlow } from '../../types/triage';

export default function TriageBuilderTemplatesPage() {
  const { t } = useTranslation();
  const { templates, loading, error } = useTriageTemplates();

  const handleUse = (template: TriageFlow) => {
    console.log('Use template:', template.id);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-[#0A1628] font-['Sora'] mb-2">{t('triage.templates')}</h1>
      <p className="text-gray-500 text-sm mb-6">PulseMaint built-in triage flow templates</p>

      {loading ? (
        <p className="text-gray-400 text-sm">{t('triage.loading')}</p>
      ) : error ? (
        <p className="text-red-500 text-sm">{error}</p>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-500">No templates available.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tmpl) => (
            <TriageTemplateCard key={tmpl.id} template={tmpl} onUse={handleUse} />
          ))}
        </div>
      )}
    </div>
  );
}
