import { isSupabaseConfigured } from './supabaseClient';
import { localProspectRepository, supabaseProspectRepository } from './prospectRepository';

export type MigrationResult = {
  migrated: number;
  failed: number;
  errors: string[];
};

export const migrateLocalProspectsToCloud = async (): Promise<MigrationResult> => {
  const result: MigrationResult = { migrated: 0, failed: 0, errors: [] };

  if (!isSupabaseConfigured) {
    result.errors.push('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable cloud sync.');
    return result;
  }

  let localProspects;
  try {
    localProspects = await localProspectRepository.listProspects();
  } catch (e) {
    result.errors.push(`Failed to read local prospects: ${(e as Error).message}`);
    return result;
  }

  for (const prospect of localProspects) {
    try {
      // upsert: updateProspect uses Supabase .upsert() which creates or replaces by id
      await supabaseProspectRepository.updateProspect(prospect.id, prospect);
      result.migrated++;
    } catch (e) {
      result.failed++;
      result.errors.push(`${prospect.name} (${prospect.id}): ${(e as Error).message}`);
    }
  }

  return result;
};
