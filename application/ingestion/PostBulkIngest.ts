/**
 * Bulk post ingestion from CSV.
 * Pipeline: parse CSV → normalize brand names → upsert posts in batches.
 */
import { transaction } from '../../lib/db';
import { ParsedCsvRow } from './CsvParser';
import { normalizeBrands, NormalizedBrand } from './BrandNormalizer';

export interface IngestStats {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
  brandMap: Map<string, NormalizedBrand | null>;
}

interface BatchResult {
  inserted: number;
  updated: number;
  errors: string[];
}

/**
 * Upsert a batch using multi-row INSERT with ON CONFLICT.
 * Returns insert/update/skip counts for the batch.
 */
async function upsertBatch(
  rows: ParsedCsvRow[],
  brandMap: Map<string, NormalizedBrand | null>,
): Promise<BatchResult> {
  if (rows.length === 0) return { inserted: 0, updated: 0, errors: [] };

  return transaction(async (client) => {
    const errors: string[] = [];
    let insertCount = 0;
    let updateCount = 0;

    // Phase 1: separate rows into insertable vs skippable
    const insertRows: { row: ParsedCsvRow; curatedBrandId: string }[] = [];

    for (const row of rows) {
      let curatedBrandId: string | null = null;
      for (const brandName of row.brands) {
        const normalized = brandMap.get(brandName);
        if (normalized) {
          curatedBrandId = normalized.id;
          break;
        }
      }

      if (!curatedBrandId) {
        errors.push(
          `No curated brand for post_id=${row.post_id}, brands=[${row.brands.join(', ')}]`,
        );
        continue;
      }

      insertRows.push({ row, curatedBrandId });
    }

    if (insertRows.length === 0) {
      return { inserted: 0, updated: 0, errors };
    }

    // Phase 2: check which post_ids already exist in this batch
    const postKeys = insertRows.map(({ row }) => `(${row.platform}, ${row.post_id})`);
    const conflictCheck = await client.query<{ platform: string; post_id: string }>(
      `SELECT platform, post_id FROM post
       WHERE (platform, post_id) IN (${postKeys.join(', ')})`,
    );
    const existingKeys = new Set(
      conflictCheck.rows.map((r) => `${r.platform}::${r.post_id}`),
    );

    const newRows: ParsedCsvRow[] = [];
    const existingRowIndices: number[] = [];

    for (let i = 0; i < insertRows.length; i++) {
      const key = `${insertRows[i]!.row.platform}::${insertRows[i]!.row.post_id}`;
      if (existingKeys.has(key)) {
        existingRowIndices.push(i);
      } else {
        newRows.push(insertRows[i]!.row);
      }
    }

    // Phase 3: INSERT new rows
    if (newRows.length > 0) {
      const values: string[] = [];
      const params: unknown[] = [];
      let paramIdx = 1;

      for (const { row, curatedBrandId } of insertRows) {
        if (!newRows.includes(row)) continue;

        values.push(
          `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, ` +
            `$${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, ` +
            `$${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, ` +
            `$${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`,
        );

        params.push(
          curatedBrandId,
          row.platform,
          row.post_id,
          row.content,
          row.posted_at,
          row.week_start,
          row.week_number,
          row.year,
          row.format,
          row.yt_format,
          row.cost,
          row.views,
          row.impressions,
          row.reactions,
          row.comments,
          row.shares,
          row.duration,
          row.link,
          row.advertiser,
          row.profile,
          JSON.stringify(row.brands),
          JSON.stringify(row.categories),
        );
      }

      const insertSql = `
        INSERT INTO post (
          curated_brand_id, platform, post_id, content, posted_at,
          week_start, week_number, year, format, yt_format,
          cost, views, impressions, reactions, comments, shares,
          duration, link, advertiser, profile, brands, categories
        ) VALUES ${values.join(', ')}
        ON CONFLICT (platform, post_id) DO NOTHING`;

      try {
        const result = await client.query(insertSql, params);
        insertCount += result.rowCount ?? 0;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Batch insert failed: ${msg}`);
      }
    }

    // Phase 4: UPDATE existing rows
    if (existingRowIndices.length > 0) {
      const values: string[] = [];
      const params: unknown[] = [];
      let paramIdx = 1;

      for (const idx of existingRowIndices) {
        const { row, curatedBrandId } = insertRows[idx]!;
        values.push(
          `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, ` +
            `$${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, ` +
            `$${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, ` +
            `$${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`,
        );

        params.push(
          curatedBrandId,
          row.platform,
          row.post_id,
          row.content,
          row.posted_at,
          row.week_start,
          row.week_number,
          row.year,
          row.format,
          row.yt_format,
          row.cost,
          row.views,
          row.impressions,
          row.reactions,
          row.comments,
          row.shares,
          row.duration,
          row.link,
          row.advertiser,
          row.profile,
          JSON.stringify(row.brands),
          JSON.stringify(row.categories),
        );
      }

      const updateSql = `
        INSERT INTO post (
          curated_brand_id, platform, post_id, content, posted_at,
          week_start, week_number, year, format, yt_format,
          cost, views, impressions, reactions, comments, shares,
          duration, link, advertiser, profile, brands, categories
        ) VALUES ${values.join(', ')}
        ON CONFLICT (platform, post_id) DO UPDATE SET
          content = EXCLUDED.content,
          posted_at = EXCLUDED.posted_at,
          week_start = EXCLUDED.week_start,
          week_number = EXCLUDED.week_number,
          year = EXCLUDED.year,
          format = EXCLUDED.format,
          yt_format = EXCLUDED.yt_format,
          cost = EXCLUDED.cost,
          views = EXCLUDED.views,
          impressions = EXCLUDED.impressions,
          reactions = EXCLUDED.reactions,
          comments = EXCLUDED.comments,
          shares = EXCLUDED.shares,
          duration = EXCLUDED.duration,
          link = EXCLUDED.link,
          advertiser = EXCLUDED.advertiser,
          profile = EXCLUDED.profile,
          brands = EXCLUDED.brands,
          categories = EXCLUDED.categories,
          updated_at = now()`;

      try {
        const result = await client.query(updateSql, params);
        updateCount += result.rowCount ?? 0;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Batch update failed: ${msg}`);
      }
    }

    return { inserted: insertCount, updated: updateCount, errors };
  });
}

/**
 * Bulk ingest parsed CSV rows into the post table.
 *
 * @param rows ParsedCsvRow[] from CsvParser.parseCsv()
 * @param batchSize Number of rows per upsert batch (default 500)
 * @returns IngestStats with total/inserted/updated/skipped/errors
 */
export async function bulkIngest(
  rows: ParsedCsvRow[],
  batchSize = 500,
): Promise<IngestStats> {
  const stats: IngestStats = {
    total: rows.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    brandMap: new Map(),
  };

  if (stats.total === 0) return stats;

  // Collect all unique brand names
  const brandNames = new Set<string>();
  for (const row of rows) {
    for (const brand of row.brands) {
      brandNames.add(brand);
    }
  }

  // Normalize all brand names upfront
  const brandMap = await normalizeBrands([...brandNames]);
  stats.brandMap = brandMap;

  // Split into batches
  const batches: ParsedCsvRow[][] = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    batches.push(rows.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    const result = await upsertBatch(batch, brandMap);
    stats.errors.push(...result.errors);
    stats.skipped += result.errors.filter((e) => e.startsWith('No curated brand')).length;
    stats.inserted += result.inserted;
    stats.updated += result.updated;
  }

  return stats;
}