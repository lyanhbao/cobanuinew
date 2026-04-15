/**
 * Type stub for 'anthropic' package (user's custom endpoint).
 * The package is installed in the tiktok scrape directory.
 * This stub makes it resolvable at the project root level.
 */
declare module 'anthropic' {
  export interface Message {
    content: Array<{ type: 'text'; text: string } | { type: string; [key: string]: unknown }>;
  }

  export interface MessagesCreateParams {
    model: string;
    max_tokens: number;
    messages: Array<{ role: string; content: string }>;
    system?: string;
  }

  export class Anthropic {
    constructor(params: { apiKey: string; baseURL?: string });
    messages: {
      create(params: MessagesCreateParams): Promise<Message>;
    };
  }
}
