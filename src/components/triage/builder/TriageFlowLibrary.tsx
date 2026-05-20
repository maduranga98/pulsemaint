import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useTriageFlowLibrary } from '../../../hooks/triage/useTriageFlowLibrary';
import { useTriageTemplates } from '../../../hooks/triage/useTriageTemplates';
import TriageFlowCard from './TriageFlowCard';
import TriageTemplateCard from './TriageTemplateCard';
import type { TriageFlow } from '../../../types/triage';

export default function TriageFlowLibrary() {
  const { t } = useTranslation();
  const { flows, loading: flowsLoading } = useTriageFlowLibrary();
  const { templates, loading: templatesLoading } = useTriageTemplates();

  const handleUseTemplate = (template: TriageFlow) => {
    // Navigate to create page with template pre-filled (future enhancement)
    console.log('Use template:', template.id);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0A1628] font-['Sora']">Triage Flows</h1>
          <p className="text-gray-500 text-sm mt-1">Manage operator triage guidance flows</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/app/triage-builder/templates"
            className="px-4 py-2 border-2 border-[#1A56DB] text-[#1A56DB] font-medium rounded-lg text-sm hover:bg-blue-50"
          >
            {t('triage.browse_templates')}
          </Link>
          <Link
            to="/app/triage-builder/new"
            className="px-4 py-2 bg-[#1A56DB] text-white font-medium rounded-lg text-sm hover:bg-blue-700"
          >
            {t('triage.create_flow')}
          </Link>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-[#0A1628] mb-3">{t('triage.custom_flows')}</h2>
        {flowsLoading ? (
          <p className="text-gray-400 text-sm">{t('triage.loading')}</p>
        ) : flows.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
            <p className="text-gray-500">{t('triage.no_flows')}</p>
            <Link to="/app/triage-builder/new" className="mt-3 inline-block text-[#1A56DB] font-medium text-sm underline">
              {t('triage.create_flow')}
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {flows.map((flow) => <TriageFlowCard key={flow.id} flow={flow} />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[#0A1628] mb-3">{t('triage.templates')}</h2>
        {templatesLoading ? (
          <p className="text-gray-400 text-sm">{t('triage.loading')}</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((tmpl) => (
              <TriageTemplateCard
                key={tmpl.id}
                template={tmpl}
                onUse={handleUseTemplate}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
