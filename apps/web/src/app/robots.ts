import type { MetadataRoute } from 'next';

/**
 * Project-wide `robots.txt`. We split into two policy groups:
 *
 *   1. Mainstream search engines — allowed everywhere except the
 *      authenticated dashboard (which is non-indexable anyway).
 *
 *   2. Known AI training crawlers — globally disallowed. These bots
 *      respect `Disallow: /` rules and we have no business letting
 *      them scrape paying customers' photos to train commercial
 *      models. Per-studio overrides happen via `noai`/`noimageai`
 *      meta tags emitted in `generateMetadata`, but the blocklist
 *      below is the floor we apply to every studio at all times.
 *
 * Sources for the bot user-agent strings:
 *   - OpenAI: GPTBot, OAI-SearchBot, ChatGPT-User
 *   - Anthropic: ClaudeBot, Claude-Web, anthropic-ai
 *   - Google: Google-Extended (the AI/Bard opt-out)
 *   - Common Crawl: CCBot (the dataset most LLMs are trained on)
 *   - Perplexity: PerplexityBot
 *   - Meta: FacebookBot, Meta-ExternalAgent
 *   - Amazon/Apple: Amazonbot, Applebot-Extended
 *   - Bytedance/Cohere: Bytespider, cohere-ai
 *   - Image-specific: img2dataset, ImagesiftBot
 */
const AI_TRAINING_BOTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'Google-Extended',
  'CCBot',
  'PerplexityBot',
  'FacebookBot',
  'Meta-ExternalAgent',
  'Amazonbot',
  'Applebot-Extended',
  'Bytespider',
  'cohere-ai',
  'Diffbot',
  'img2dataset',
  'ImagesiftBot',
  'Omgili',
  'YouBot',
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/login'],
      },
      ...AI_TRAINING_BOTS.map((userAgent) => ({
        userAgent,
        disallow: '/',
      })),
    ],
  };
}
