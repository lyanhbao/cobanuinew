/**
 * Job 1: CrawlDelta — crawl new/modified posts from Jan 1 of current year to now.
 *
 * Stub implementation: queries posts from the post table that were updated
 * since the last crawl, simulating a delta crawl from external APIs.
 *
 * In production, this would call YouTube/FB/TT API endpoints per brand.
 */
import { GroupId } from '../../lib/types';
import { query, transaction } from '../../lib/db';

export interface CrawlDeltaResult {
  groupId: GroupId;
  postsFetched: number;
  postsUpserted: number;
  postsFailed: number;
}

/**
 * Crawl delta posts for all brands in a group.
 * Uses the brand's last_crawl_at to determine the delta window.
 */
export async function crawlDelta(
  groupId: GroupId,
  crawlFrom?: string,
  crawlTo?: string,
): Promise<CrawlDeltaResult> {
  // Default crawl window: Jan 1 of current year → today
  const toDate = crawlTo ?? new Date().toISOString().slice(0, 10);
  const fromDate =
    crawlFrom ??
    `${new Date().getFullYear()}-01-01`;

  // Get all brands in this group
  const brands = await query<{
    brand_id: string;
    curated_brand_id: string;
    last_crawl_at: string | null;
  }>(
    `SELECT b.id AS brand_id, b.curated_brand_id, b.last_crawl_at
     FROM brand b
     WHERE b.group_id = $1`,
    [groupId],
  );

  const result: CrawlDeltaResult = {
    groupId,
    postsFetched: 0,
    postsUpserted: 0,
    postsFailed: 0,
  };

  for (const brand of brands.rows) {
    const deltaResult = await crawlBrandDelta(
      groupId,
      brand.brand_id,
      brand.curated_brand_id,
      fromDate,
      toDate,
    );
    result.postsFetched += deltaResult.postsFetched;
    result.postsUpserted += deltaResult.postsUpserted;
    result.postsFailed += deltaResult.postsFailed;
  }

  return result;
}

interface BrandDeltaResult {
  postsFetched: number;
  postsUpserted: number;
  postsFailed: number;
}

/**
 * Crawl delta for a single brand.
 * In production, this would call the platform API.
 */
async function crawlBrandDelta(
  groupId: GroupId,
  brandId: string,
  curatedBrandId: string,
  fromDate: string,
  toDate: string,
): Promise<BrandDeltaResult> {
  // Stub: query existing posts in the date range (simulating external API data)
  // In production, replace with API calls to YouTube/FB/TT APIs
  const existingPosts = await query<{
    post_id: string;
    platform: string;
    updated_at: string;
  }>(
    `SELECT post_id, platform, updated_at
     FROM post
     WHERE curated_brand_id = $1
       AND posted_at >= $2::date
       AND posted_at <= $3::date`,
    [curatedBrandId, fromDate, toDate],
  );

  const result: BrandDeltaResult = {
    postsFetched: existingPosts.rows.length,
    postsUpserted: 0,
    postsFailed: 0,
  };

  if (existingPosts.rows.length === 0) return result;

  // Update brand crawl status
  await transaction(async (client) => {
    // Upsert posts (in production this is done by the API data)
    // Here we simulate by re-touching existing posts
    for (const post of existingPosts.rows) {
      await client.query(
        `UPDATE post SET updated_at = now()
         WHERE curated_brand_id = $1 AND platform = $2 AND post_id = $3`,
        [curatedBrandId, post.platform, post.post_id],
      );
    }

    // Update brand crawl metadata
    await client.query(
      `UPDATE brand SET
         crawl_status = 'ready',
         last_crawl_at = now(),
         first_crawl_at = COALESCE(first_crawl_at, now())
       WHERE id = $1`,
      [brandId],
    );

    result.postsUpserted = existingPosts.rows.length;
  });

  return result;
}
