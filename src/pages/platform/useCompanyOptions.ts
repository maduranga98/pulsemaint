import { useEffect, useState } from 'react';
import { platformService } from '@/services/platformService';

export interface CompanyOption { id: string; name: string }

let cache: Promise<CompanyOption[]> | null = null;

/** Registered companies (id + name) for pickers, loaded once per session through platformListCompanies. */
export function useCompanyOptions(): CompanyOption[] {
  const [rows, setRows] = useState<CompanyOption[]>([]);
  useEffect(() => {
    cache ??= platformService.listCompanies()
      .then((r) => r.companies.map((c) => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name)))
      .catch(() => {
        cache = null;
        return [];
      });
    let live = true;
    void cache.then((r) => live && setRows(r));
    return () => {
      live = false;
    };
  }, []);
  return rows;
}
