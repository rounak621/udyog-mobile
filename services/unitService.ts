import { api } from './api';
import { UNITS as DEFAULT_UNITS } from '../constants/theme';

export interface UnitCategoriesResponse {
  categories: string[];
  units?: string[];
}

export interface CustomUnitResponse {
  id: string;
  business_id: string;
  unit_name: string;
  created_at?: string;
}

export const unitService = {
  getUnits: async (businessId: string): Promise<string[]> => {
    if (!businessId) return DEFAULT_UNITS;
    try {
      const res = await api.get<UnitCategoriesResponse>(`/units/categories?business_id=${businessId}`);
      const serverUnits = res.data.categories || res.data.units || [];
      if (!serverUnits || serverUnits.length === 0) {
        return DEFAULT_UNITS;
      }

      // Merge server units with defaults to ensure standard units are always present
      const seen = new Set<string>();
      const result: string[] = [];

      // Add server units first (which includes business custom units + server standard units)
      for (const u of serverUnits) {
        const clean = (u || '').trim();
        if (clean && !seen.has(clean.toUpperCase())) {
          seen.add(clean.toUpperCase());
          result.push(clean);
        }
      }

      // Then add any default units not already seen
      for (const u of DEFAULT_UNITS) {
        if (!seen.has(u.toUpperCase())) {
          seen.add(u.toUpperCase());
          result.push(u);
        }
      }

      return result;
    } catch (err) {
      console.log('Failed to fetch units from server, using fallback:', err);
      return DEFAULT_UNITS;
    }
  },

  createUnit: async (businessId: string, unitName: string): Promise<CustomUnitResponse> => {
    const trimmed = (unitName || '').trim();
    const res = await api.post<CustomUnitResponse>(
      `/units?business_id=${businessId}`,
      { unit_name: trimmed }
    );
    return res.data;
  },
};
