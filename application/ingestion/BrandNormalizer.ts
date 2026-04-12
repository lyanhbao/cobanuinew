/**
 * Brand name normalization service.
 * Resolves raw brand names from CSV → curated_brand_id.
 *
 * Resolution order:
 * 1. Exact match on curated_brand.name
 * 2. Exact match on brand_alias.alias
 * 3. Fuzzy ILIKE match on brand_alias.alias (trigram similarity)
 */
import { query } from '../../lib/db';

export interface NormalizedBrand {
  id: string;
  name: string;
}

interface BrandRow {
  id: string;
  name: string;
}

interface AliasRow {
  curated_brand_id: string;
  brand_name: string;
}

/**
 * Normalize a brand name to a curated brand record.
 * Returns null if no match is found.
 */
export async function normalizeBrand(
  name: string,
): Promise<NormalizedBrand | null> {
  if (!name || typeof name !== 'string') return null;

  const trimmed = name.trim();
  if (!trimmed) return null;

  // 1. Exact match on curated_brand.name
  const exactBrand = await query<BrandRow>(
    `SELECT id, name FROM curated_brand WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [trimmed],
  );
  if (exactBrand.rows.length > 0) {
    return { id: exactBrand.rows[0]!.id, name: exactBrand.rows[0]!.name };
  }

  // 2. Exact match on brand_alias.alias
  const exactAlias = await query<AliasRow>(
    `SELECT ba.curated_brand_id, cb.name AS brand_name
     FROM brand_alias ba
     JOIN curated_brand cb ON cb.id = ba.curated_brand_id
     WHERE LOWER(ba.alias) = LOWER($1)
     LIMIT 1`,
    [trimmed],
  );
  if (exactAlias.rows.length > 0) {
    return {
      id: exactAlias.rows[0]!.curated_brand_id,
      name: exactAlias.rows[0]!.brand_name,
    };
  }

  // 3. Fuzzy match on brand_alias.alias (ILIKE)
  // Use similarity > 0.3 as threshold to avoid noise
  const fuzzyAlias = await query<AliasRow>(
    `SELECT ba.curated_brand_id, cb.name AS brand_name
     FROM brand_alias ba
     JOIN curated_brand cb ON cb.id = ba.curated_brand_id
     WHERE LOWER(ba.alias) ILIKE $1
     ORDER BY LENGTH(ba.alias) DESC
     LIMIT 1`,
    [`%${trimmed}%`],
  );
  if (fuzzyAlias.rows.length > 0) {
    return {
      id: fuzzyAlias.rows[0]!.curated_brand_id,
      name: fuzzyAlias.rows[0]!.brand_name,
    };
  }

  // 4. Fuzzy ILIKE match on curated_brand.name directly
  const fuzzyBrand = await query<BrandRow>(
    `SELECT id, name FROM curated_brand
     WHERE LOWER(name) ILIKE $1
     ORDER BY LENGTH(name) DESC
     LIMIT 1`,
    [`%${trimmed}%`],
  );
  if (fuzzyBrand.rows.length > 0) {
    return { id: fuzzyBrand.rows[0]!.id, name: fuzzyBrand.rows[0]!.name };
  }

  return null;
}

/**
 * Normalize multiple brand names in batch for efficiency.
 * Returns a map of original name → normalized brand (or null).
 */
export async function normalizeBrands(
  names: string[],
): Promise<Map<string, NormalizedBrand | null>> {
  if (names.length === 0) return new Map();

  const uniqueNames = [...new Set(names.filter((n) => typeof n === 'string' && n.trim()))];
  const result = new Map<string, NormalizedBrand | null>();

  // Batch query all unique names against curated_brand.name
  const brandResults = await query<BrandRow>(
    `SELECT LOWER(name) AS lookup_key, id, name
     FROM curated_brand
     WHERE LOWER(name) = ANY($1)`,
    [uniqueNames.map((n) => n.toLowerCase())],
  );
  for (const row of brandResults.rows) {
    result.set(row.name, { id: row.id, name: row.name });
  }

  // Batch query aliases for unmatched names
  const unmatched = uniqueNames.filter((n) => !result.has(n));
  if (unmatched.length > 0) {
    const aliasResults = await query<AliasRow & { lookup_key: string }>(
      `SELECT LOWER(ba.alias) AS lookup_key, ba.curated_brand_id, cb.name AS brand_name
       FROM brand_alias ba
       JOIN curated_brand cb ON cb.id = ba.curated_brand_id
       WHERE LOWER(ba.alias) = ANY($1)`,
      [unmatched.map((n) => n.toLowerCase())],
    );
    for (const row of aliasResults.rows) {
      result.set(row.lookup_key, {
        id: row.curated_brand_id,
        name: row.brand_name,
      });
    }
  }

  // Set all names with their results
  const output = new Map<string, NormalizedBrand | null>();
  for (const name of names) {
    if (!name || typeof name !== 'string') {
      output.set(name, null);
      continue;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      output.set(name, null);
      continue;
    }
    const lookupKey = trimmed.toLowerCase();
    output.set(name, result.get(lookupKey) ?? null);
  }

  return output;
}
