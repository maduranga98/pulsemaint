import { useHandoverStore } from '@/store/handover.store';

export function useHandover() {
  return useHandoverStore();
}
