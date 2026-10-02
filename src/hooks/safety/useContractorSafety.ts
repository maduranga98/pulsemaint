import { useEffect, useMemo, useState } from 'react';
import { usePlantFilter } from '@/hooks/usePlantFilter';
import {
  subscribeContractorInvites,
  subscribeSafetyCards,
} from '@/services/contractorSafetyTraining.service';
import type { ContractorSafetyCard, ContractorSafetyTrainingInvite } from '@/lib/safety/contractorSafety';

/**
 * Live contractor safety-training invites and issued safety cards for the
 * company, limited to the caller's plant (admin: the selected plant tab).
 */
export function useContractorSafety(companyId: string | undefined) {
  const [allInvites, setInvites] = useState<ContractorSafetyTrainingInvite[]>([]);
  const [allCards, setCards] = useState<ContractorSafetyCard[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [cardsLoading, setCardsLoading] = useState(true);
  const { inPlant } = usePlantFilter(companyId);

  useEffect(() => {
    if (!companyId) {
      setInvitesLoading(false);
      setCardsLoading(false);
      return;
    }
    const unsubInvites = subscribeContractorInvites(
      companyId,
      (next) => {
        setInvites(next);
        setInvitesLoading(false);
      },
      () => setInvitesLoading(false),
    );
    const unsubCards = subscribeSafetyCards(
      companyId,
      (next) => {
        setCards(next);
        setCardsLoading(false);
      },
      () => setCardsLoading(false),
    );
    return () => {
      unsubInvites();
      unsubCards();
    };
  }, [companyId]);

  const invites = useMemo(
    () =>
      allInvites
        .filter((i) => inPlant(i.plantId ?? null, null))
        .sort((a, b) => (b.assignedAt?.toMillis?.() ?? 0) - (a.assignedAt?.toMillis?.() ?? 0)),
    [allInvites, inPlant],
  );
  const cards = useMemo(() => allCards.filter((c) => inPlant(c.plantId ?? null, null)), [allCards, inPlant]);

  return { invites, cards, loading: invitesLoading || cardsLoading };
}
