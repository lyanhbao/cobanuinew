/**
 * POST /api/ingest/csv
 * Accept CSV file upload and trigger bulk ingest.
 */
import { NextRequest, NextResponse } from 'next/server';
import { parseCsv } from '../../../../application/ingestion/CsvParser';
import { bulkIngest } from '../../../../application/ingestion/PostBulkIngest';
import { z } from 'zod';

const uploadSchema = z.object({
  csv: z.string().min(1, 'CSV content is required'),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let csvContent: string;

    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file');
      if (!file || typeof file === 'string') {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 },
        );
      }
      csvContent = await file.text();
    } else {
      const body = await req.json();
      const parsed = uploadSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.message },
          { status: 400 },
        );
      }
      csvContent = parsed.data.csv;
    }

    // Parse CSV
    const rows = parseCsv(csvContent);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No valid rows found in CSV' },
        { status: 400 },
      );
    }

    // Bulk ingest
    const stats = await bulkIngest(rows);

    return NextResponse.json({
      success: true,
      stats: {
        total: stats.total,
        inserted: stats.inserted,
        updated: stats.updated,
        skipped: stats.skipped,
        errorCount: stats.errors.length,
        errors: stats.errors.slice(0, 20), // Limit error details
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ingestion failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
