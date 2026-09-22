import { useAuthStore } from '../../store/authStore';
import { useActivePlantStore } from '../../store/activePlantStore';
import { usePlants } from '../../hooks/usePlants';
import { useTranslation } from 'react-i18next';

/**
 * Admin-only plant switcher. Plant is the main scoping category across the
 * app; every other role is locked to their own registered plant, but admin
 * manages all of them, so they pick which one they're "viewing as" here —
 * "All Plants" (the default) leaves every module unscoped/company-wide,
 * same as before this existed. Anything that reads useDepartmentScope's
 * plantId (Machines' department picker today, more modules as they land
 * plant scoping) automatically follows this selection.
 */
export function PlantTabs() {
  const { t } = useTranslation();
  const userProfile = useAuthStore((s) => s.userProfile);
  const companyId = userProfile?.companyId ?? '';
  const { activePlants, loading } = usePlants(companyId);
  const activePlantId = useActivePlantStore((s) => s.activePlantId);
  const setActivePlant = useActivePlantStore((s) => s.setActivePlant);

  if (userProfile?.role !== 'admin' || loading || activePlants.length === 0) return null;

  return (
    <div className="shrink-0 bg-[#0F1E35] border-b border-[#1E3A5F] px-4 lg:px-6 overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-1 h-10">
        <button
          type="button"
          onClick={() => setActivePlant(null)}
          className={`px-3 h-7 rounded-md text-[12px] font-medium whitespace-nowrap transition-colors ${
            activePlantId === null
              ? 'bg-[#1A56DB] text-white'
              : 'text-[#8BA3BF] hover:bg-[#142849] hover:text-[#D5DEEA]'
          }`}
        >
          {t('common.layout.plantTabs.allPlants', 'All Plants')}
        </button>
        {activePlants.map((plant) => (
          <button
            key={plant.id}
            type="button"
            onClick={() => setActivePlant(plant.id)}
            className={`px-3 h-7 rounded-md text-[12px] font-medium whitespace-nowrap transition-colors ${
              activePlantId === plant.id
                ? 'bg-[#1A56DB] text-white'
                : 'text-[#8BA3BF] hover:bg-[#142849] hover:text-[#D5DEEA]'
            }`}
          >
            {plant.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default PlantTabs;
