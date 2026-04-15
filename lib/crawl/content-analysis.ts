/**
 * Content Analysis Agent — COBAN Pipeline
 *
 * Analyzes TikTok post captions using LLM (Sonnet).
 * NOT hard-coded rules — uses the user's configured LLM endpoint.
 *
 * Fields extracted:
 *   - mood        : emotional tone
 *   - tone        : delivery style
 *   - info_type   : type of information
 *   - target      : target audience
 *   - format      : content format
 *   - key_message : core message / campaign theme
 *
 * Batched 50 posts/call to minimize token usage.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PostContentAnalysis {
  post_id: string;
  mood: string;
  tone: string;
  info_type: string;
  target: string;
  format: string;
  key_message: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface CrawledPost {
  post_id: string;
  profile: string;
  content: string;
  post_type?: string;
}

interface LLMResult {
  post_id: string;
  mood: string;
  tone: string;
  info_type: string;
  target: string;
  format: string;
  key_message: string;
  confidence: 'high' | 'medium' | 'low';
}

// ─── Config ─────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? 'sk-aa0b3799a224a979a3efa137a7e8f7046543f87e47903dcad1ead586ec4c04b8';
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL ?? 'http://pro-x.io.vn';
const LLM_MODEL = process.env.LLM_MODEL ?? 'claude-opus-4-6';
const BATCH_SIZE = parseInt(process.env.CONTENT_ANALYSIS_BATCH ?? '50', 10);
const OUT_FILE = join(process.cwd(), 'artifacts', 'crawl-logs', 'content-analysis-results.json');

// ─── LLM Loader ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _Anthropic: any = null;
async function getAnthropic(): Promise<any> {
  if (_Anthropic) return _Anthropic;
  const mod = await import('anthropic' as any);
  _Anthropic = (mod as any).default ?? mod;
  return _Anthropic;
}

async function llmCall(prompt: string): Promise<string> {
  const SDK = await getAnthropic();
  const ClientClass = SDK.Anthropic ?? SDK;
  const client = new ClientClass({
    apiKey: ANTHROPIC_API_KEY,
    baseURL: ANTHROPIC_BASE_URL,
  });

  const response = await client.messages.create({
    model: LLM_MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = response.content?.[0];
  return (content?.type === 'text' ? content.text : JSON.stringify(content)) as string;
}

// ─── Analysis Prompt Builder ────────────────────────────────────────────────────

function buildContentPrompt(posts: CrawledPost[]): string {
  // Format posts with Vietnamese context for better analysis
  const postLines = posts.map((p, i) => {
    const truncated = p.content.length > 300 ? p.content.slice(0, 300) + '…' : p.content;
    return `${i + 1}. [${p.profile}] [${p.post_type ?? 'unk'}] "${truncated}"`;
  }).join('\n');

  return `Bạn là chuyên gia phân tích nội dung TikTok Việt Nam. Phân tích các post bên dưới và trả về JSON array.

Danh sách posts:
${postLines}

Với mỗi post, phân tích và trả về 1 object JSON chứa các trường:

- post_id: lấy từ input
- mood: cảm xúc chủ đạo (funny | heartfelt | inspiring | tense/dramatic | neutral | aggressive | nostalgic | surprising)
- tone: phong cách diễn đạt (casual | playful | formal | dramatic | conversational | promotional | authoritative | sentimental)
- info_type: loại nội dung (entertainment | educational | promotional | news/press | user_testimonial | lifestyle | viral_challenge | music)
- target: đối tượng mục tiêu (youth_18_25 | young_adult_25_35 | families | professionals | gen_z | millennials | all_ages | gamers)
- format: định dạng nội dung (sketch_comedy | vlog | tutorial | review | unboxing | livestream_clip | music_video | challenge | reaction | storytelling | food_cooking | asmr)
- key_message: 1 câu tóm tắt chủ đề CHÍNH, tối đa 100 chars, bằng tiếng Việt
- confidence: độ chắc chắn (high | medium | low)

Qui tắc phân tích:
- mood "funny": có comedy, pranks, fail, joke, reacts hài hước
- mood "heartfelt": kể chuyện cảm động, tình cảm gia đình, ơn nghĩa
- mood "inspiring": motivational, thành công, thử thách bản thân
- mood "tense/dramatic": drama, conflict, reveals, plot twist
- mood "aggressive": thách đấu, battle, diss, rap battle
- mood "nostalgic": hoài niệm, kỷ niệm, thời xưa
- mood "surprising": thử thách bất ngờ, reaction shock

- tone "casual": nói chuyện thường, quen thuộc
- tone "playful": đùa giỡn, chọc, troll
- tone "formal": thông tin chính thức, báo cáo, news
- tone "promotional": quảng cáo, review sản phẩm, giới thiệu
- tone "authoritative": hướng dẫn, tutorial, dạy chơi

- info_type "entertainment": giải trí thuần túy, không có message rõ ràng
- info_type "promotional": có sản phẩm, thương hiệu, quảng cáo
- info_type "educational": có kiến thức, mẹo, hướng dẫn
- info_type "viral_challenge": có challenge, tag, share

- key_message: viết 1 CÂU ngắn bằng tiếng Việt, KHÔNG dài quá 100 ký tự

Trả về JSON array, KHÔNG thêm text giải thích. Bắt đầu:`;
}

// ─── Main: Analyze batch via LLM ───────────────────────────────────────────────

export async function analyzeContentBatch(
  posts: CrawledPost[],
  onProgress?: (done: number, total: number) => void,
): Promise<PostContentAnalysis[]> {
  const results: PostContentAnalysis[] = [];
  const total = posts.length;

  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(posts.length / BATCH_SIZE);

    process.stdout.write(`\r  [ANALYZE] Batch ${batchNum}/${totalBatches} — ${Math.min(i + BATCH_SIZE, total)}/${total} posts  `);

    const prompt = buildContentPrompt(batch);

    try {
      const llmText = await llmCall(prompt);

      const jsonMatch = llmText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as LLMResult[];
        for (const item of parsed) {
          results.push({
            post_id: item.post_id,
            mood: item.mood ?? 'unknown',
            tone: item.tone ?? 'casual',
            info_type: item.info_type ?? 'entertainment',
            target: item.target ?? 'youth_18_25',
            format: item.format ?? 'sketch_comedy',
            key_message: (item.key_message ?? '').slice(0, 200),
            confidence: ['high', 'medium', 'low'].includes(String(item.confidence ?? ''))
              ? (item.confidence as 'high' | 'medium' | 'low')
              : 'medium',
          });
        }
      } else {
        // LLM didn't return valid JSON — use minimal defaults
        for (const p of batch) {
          results.push({
            post_id: p.post_id,
            mood: 'unknown',
            tone: 'unknown',
            info_type: 'unknown',
            target: 'unknown',
            format: 'unknown',
            key_message: '',
            confidence: 'low',
          });
        }
      }
    } catch (err) {
      // LLM call failed — mark batch as unknown
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(`\n  [ANALYZE] ⚠️ Batch ${batchNum} failed: ${msg} — marking unknown\n`);
      for (const p of batch) {
        results.push({
          post_id: p.post_id,
          mood: 'unknown',
          tone: 'unknown',
          info_type: 'unknown',
          target: 'unknown',
          format: 'unknown',
          key_message: '',
          confidence: 'low',
        });
      }
    }

    if (onProgress) onProgress(Math.min(i + BATCH_SIZE, total), total);

    // Rate limit between batches
    if (i + BATCH_SIZE < posts.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  process.stdout.write('\n');

  try {
    writeFileSync(OUT_FILE, JSON.stringify(results, null, 2));
  } catch { /* ignore */ }

  return results;
}

// ─── Agent: analyze single post with explanation ─────────────────────────────

export interface PostAnalysisWithReasoning {
  post_id: string;
  mood: string;
  tone: string;
  info_type: string;
  target: string;
  format: string;
  key_message: string;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Deep analysis for a single post — includes reasoning explanation.
 * Use for high-value posts that need detailed understanding.
 */
export async function analyzeSinglePost(
  post: CrawledPost,
): Promise<PostAnalysisWithReasoning> {
  const prompt = `Bạn là chuyên gia phân tích nội dung TikTok Việt Nam.

Phân tích post sau chi tiết:

Profile: ${post.profile}
Post ID: ${post.post_id}
Type: ${post.post_type ?? 'unknown'}
Content: "${post.content}"

Trả về JSON object (không thêm text):
{
  "mood": "...",         // cảm xúc chủ đạo
  "tone": "...",         // phong cách diễn đạt
  "info_type": "...",    // loại nội dung
  "target": "...",       // đối tượng mục tiêu
  "format": "...",       // định dạng
  "key_message": "...",  // 1 câu tiếng Việt, tối đa 100 chars
  "reasoning": "...",    // GIẢI THÍCH ngắn tại sao bạn chọn như vậy
  "confidence": "..."    // high | medium | low
}

Chỉ trả về JSON. Bắt đầu:`;

  try {
    const llmText = await llmCall(prompt);
    const jsonMatch = llmText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const item = JSON.parse(jsonMatch[0]);
      return {
        post_id: post.post_id,
        mood: item.mood ?? 'unknown',
        tone: item.tone ?? 'casual',
        info_type: item.info_type ?? 'entertainment',
        target: item.target ?? 'youth_18_25',
        format: item.format ?? 'sketch_comedy',
        key_message: (item.key_message ?? '').slice(0, 200),
        reasoning: item.reasoning ?? '',
        confidence: ['high', 'medium', 'low'].includes(String(item.confidence ?? ''))
          ? (item.confidence as 'high' | 'medium' | 'low')
          : 'medium',
      };
    }
  } catch { /* fall through */ }

  return {
    post_id: post.post_id,
    mood: 'unknown',
    tone: 'unknown',
    info_type: 'unknown',
    target: 'unknown',
    format: 'unknown',
    key_message: '',
    reasoning: 'LLM call failed — no analysis available',
    confidence: 'low',
  };
}

// ─── Rule-based fallback (only when LLM unavailable) ──────────────────────────

export function analyzeContentRuleBased(posts: CrawledPost[]): PostContentAnalysis[] {
  // Minimal fallback — only used when LLM is completely unavailable
  return posts.map(p => ({
    post_id: p.post_id,
    mood: 'unknown',
    tone: 'unknown',
    info_type: 'unknown',
    target: 'unknown',
    format: 'unknown',
    key_message: '',
    confidence: 'low' as const,
  }));
}