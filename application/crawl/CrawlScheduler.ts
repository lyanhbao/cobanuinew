/**
 * CrawlScheduler — orchestrates the 6-job weekly crawl pipeline.
 *
 * Job order:
 *  1. CrawlDelta — crawl from Jan 1 current year → now, upsert posts
 *  2. GapCalculation — post-level W vs W-1 gap analysis
 *  3. Aggregation — compute weekly_stats
 *  4. RankingsAndSoV — compute SOV + rankings
 *  5. ActivityReport — create brand_activity records
 *  6. FinalizeAndNotify — finalize weekly_report + notify
 */
import { GroupId } from '../../lib/types';
import { crawlDelta } from './Job1_CrawlDelta';
import { calculateGaps } from './Job2_GapCalculation';
import { aggregateWeeklyStats } from './Job3_Aggregation';
import { computeRankingsAndSoV } from './Job4_RankingsAndSoV';
import { generateActivityReport } from './Job5_ActivityReport';
import { finalizeAndNotify } from './Job6_FinalizeAndNotify';
import { query } from '../../lib/db';
import { JobStatus } from '../../lib/types';

export interface SchedulerResult {
  groupId: GroupId;
  jobs: {
    name: string;
    status: 'completed' | 'failed';
    duration: number;
    error?: string;
  }[];
}

export interface SchedulerOptions {
  groupId: GroupId;
  crawlFrom?: string; // YYYY-MM-DD, defaults to Jan 1 of current year
  crawlTo?: string; // YYYY-MM-DD, defaults to today
}

/**
 * Run the full 6-job crawl pipeline for a group.
 */
export async function runCrawlPipeline(
  options: SchedulerOptions,
): Promise<SchedulerResult> {
  const { groupId, crawlFrom, crawlTo } = options;
  const jobs: SchedulerResult['jobs'] = [];

  const jobDefs = [
    { name: 'Job1_CrawlDelta', fn: () => crawlDelta(groupId, crawlFrom, crawlTo) },
    { name: 'Job2_GapCalculation', fn: () => calculateGaps(groupId) },
    { name: 'Job3_Aggregation', fn: () => aggregateWeeklyStats(groupId) },
    { name: 'Job4_RankingsAndSoV', fn: () => computeRankingsAndSoV(groupId) },
    { name: 'Job5_ActivityReport', fn: () => generateActivityReport(groupId) },
    { name: 'Job6_FinalizeAndNotify', fn: () => finalizeAndNotify(groupId) },
  ];

  for (const def of jobDefs) {
    const start = Date.now();
    try {
      await def.fn();
      jobs.push({ name: def.name, status: 'completed', duration: Date.now() - start });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      jobs.push({ name: def.name, status: 'failed', duration: Date.now() - start, error: msg });
      // Stop pipeline on first failure
      break;
    }
  }

  return { groupId, jobs };
}

/**
 * List groups that have brands ready for crawl.
 */
export async function getGroupsPendingCrawl(): Promise<GroupId[]> {
  const result = await query<{ group_id: GroupId }>(
    `SELECT DISTINCT g.id AS group_id
     FROM "group" g
     JOIN brand b ON b.group_id = g.id
     WHERE g.crawl_status IN ('pending', 'ready')
       AND b.crawl_status != 'crawling'
     LIMIT 50`,
  );
  return result.rows.map((r) => r.group_id);
}

/**
 * Create a crawl job record for a group.
 */
export async function createCrawlJobRecord(
  groupId: GroupId,
  brandId: string,
  jobType: string,
  crawlFrom: string,
  crawlTo: string,
): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO crawl_job (group_id, brand_id, job_type, crawl_from, crawl_to, status)
     VALUES ($1, $2, $3, $4, $5, 'queued')
     RETURNING id`,
    [groupId, brandId, jobType, crawlFrom, crawlTo],
  );
  return result.rows[0]!.id;
}

/**
 * Update crawl job status.
 */
export async function updateCrawlJobStatus(
  jobId: string,
  status: JobStatus,
  errorMessage?: string,
): Promise<void> {
  const sql =
    status === 'completed' || status === 'failed'
      ? `UPDATE crawl_job SET status = $2, completed_at = now(), error_message = $3 WHERE id = $1`
      : status === 'running'
        ? `UPDATE crawl_job SET status = $2, started_at = now() WHERE id = $1`
        : `UPDATE crawl_job SET status = $2 WHERE id = $1`;

  await query(sql, [jobId, status, errorMessage ?? null]);
}
