/**
 * aiService.js — Provider-agnostic AI service
 * 
 * Supports: grok (xAI), openai
 * Uses the OpenAI SDK since Grok's API is OpenAI-compatible.
 * All AI logic is centralized here — single entry point.
 */

const OpenAI = require('openai');

// ─── Provider configs ───
const PROVIDERS = {
  grok: {
    baseURL: 'https://api.x.ai/v1',
    envKey: 'XAI_API_KEY',
    defaultModel: 'grok-3-mini-fast',
  },
  openai: {
    baseURL: 'https://api.openai.com/v1',
    envKey: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o-mini',
  },
};

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_INPUT_CHARS = 12000;
const MAX_TOKENS = 800;

// ─── Config ───
function getConfig() {
  const provider = (process.env.AI_PROVIDER || 'grok').toLowerCase();
  const providerConfig = PROVIDERS[provider];
  if (!providerConfig) {
    throw new Error(`Unsupported AI_PROVIDER: ${provider}. Use 'grok' or 'openai'.`);
  }

  const apiKey = process.env[providerConfig.envKey];
  if (!apiKey) {
    throw new Error(`${providerConfig.envKey} is required for AI generation (provider=${provider})`);
  }

  return {
    provider,
    apiKey,
    baseURL: providerConfig.baseURL,
    model: process.env.AI_MODEL || providerConfig.defaultModel,
    timeoutMs: Number(process.env.AI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
    maxInputChars: Number(process.env.AI_MAX_INPUT_CHARS) || DEFAULT_MAX_INPUT_CHARS,
  };
}

// ─── Client (cached per process) ───
let _client = null;
let _clientProvider = null;

function getClient() {
  const config = getConfig();
  // Rebuild client if provider changed
  if (!_client || _clientProvider !== config.provider) {
    _client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeoutMs,
    });
    _clientProvider = config.provider;
  }
  return _client;
}

// ─── JSON extraction ───
function extractJson(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('AI response was empty or non-string');
  }

  // Strip markdown fences
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // Try to find JSON object
  const match = cleaned.match(/\{[\s\S]*\}$/);
  const candidate = match ? match[0] : cleaned;

  try {
    return JSON.parse(candidate);
  } catch (_) {
    // Attempt light cleanup: unquoted keys, single quotes, trailing commas
    const sanitized = candidate
      .replace(/([,{\[]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
      .replace(/'/g, '"')
      .replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(sanitized);
  }
}

// ─── Review mode definitions ───
const REVIEW_MODES = {
  midyear_summary: {
    label: 'mid-year review',
    fields: ['overall_summary', 'key_achievements', 'blockers', 'support_needed', 'suggested_manager_talking_points'],
    systemPrompt: 'You are a concise HR review assistant. Use ONLY supplied data. No invented facts. Professional tone.',
  },
  final_self_assessment: {
    label: 'final self-assessment',
    fields: ['summary', 'top_achievements', 'challenges', 'lessons_learned', 'next_growth_focus'],
    systemPrompt: 'You are a concise HR review assistant. Use ONLY supplied data. No invented facts. Professional tone.',
  },
  manager_review: {
    label: 'manager review',
    fields: ['performance_summary', 'strengths', 'areas_for_improvement', 'recommended_rating_rationale', 'development_actions'],
    systemPrompt: 'You are a concise HR review assistant. Use ONLY supplied data. No invented facts. Professional tone.',
  },
  development_plan: {
    label: 'development plan',
    fields: ['summary', 'strengths', 'gap_areas', 'recommended_actions'],
    systemPrompt: 'You are a senior HR performance coach. Analyze ONLY the supplied data. Be specific — reference actual scores and goals. No invented facts.',
  },
};

// ─── Build compact context string ───
function compactContext(context, maxChars) {
  let payload = JSON.stringify(context, null, 0); // no indentation = less tokens
  if (payload.length > maxChars) {
    console.warn(`AI context truncated from ${payload.length} to ${maxChars} chars`);
    payload = payload.slice(0, maxChars - 3) + '...';
  }
  return payload;
}

// ─── Build messages for a review ───
function buildReviewMessages(mode, context) {
  const config = getConfig();
  const modeConfig = REVIEW_MODES[mode];
  if (!modeConfig) throw new Error(`Unsupported review mode: ${mode}`);

  const contextStr = compactContext(context, config.maxInputChars);
  const fieldList = modeConfig.fields.join(', ');

  return [
    { role: 'system', content: modeConfig.systemPrompt },
    {
      role: 'user',
      content: `Mode: ${modeConfig.label}\nReturn ONLY valid JSON with keys: ${fieldList}. Empty string for unpopulated fields. No markdown.\n\nData:\n${contextStr}`,
    },
  ];
}

// ─── Build messages for development plan ───
function buildDevPlanMessages(dataContext) {
  const config = getConfig();
  const contextStr = compactContext(dataContext, config.maxInputChars);

  return [
    { role: 'system', content: REVIEW_MODES.development_plan.systemPrompt },
    {
      role: 'user',
      content: `Analyze this performance data. Generate 3-5 development actions.
Return ONLY valid JSON:
{"summary":"2-3 sentences","strengths":["..."],"gap_areas":["..."],"recommended_actions":[{"action_title":"max 8 words","description":"concrete action","rationale":"quote data point","suggested_timeline":"e.g. Next 30 days","success_metric":"how to measure"}]}

Data:
${contextStr}`,
    },
  ];
}

// ─── Core completion call ───
async function callAI(messages, temperature = 0.2) {
  const config = getConfig();
  const client = getClient();

  const completion = await client.chat.completions.create({
    model: config.model,
    messages,
    max_tokens: MAX_TOKENS,
    temperature,
  });

  const text = completion?.choices?.[0]?.message?.content || '';
  return text;
}

// ─── Validate review output ───
function validateReviewOutput(mode, parsed) {
  const modeConfig = REVIEW_MODES[mode];
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI response is not a valid JSON object');
  }

  return modeConfig.fields.reduce((acc, field) => {
    let val = parsed[field];
    if (val == null) val = '';
    if (typeof val !== 'string' && !Array.isArray(val)) val = String(val);
    if (typeof val === 'string') val = val.trim();
    acc[field] = val;
    return acc;
  }, {});
}

// ─── Safe fallback (no AI) ───
function createFallback(mode) {
  const modeConfig = REVIEW_MODES[mode];
  if (!modeConfig) return { warning: 'Unknown mode' };

  const fallback = modeConfig.fields.reduce((acc, field) => {
    acc[field] = '';
    return acc;
  }, {});
  fallback.warning = 'AI generation unavailable. Please complete this section manually.';
  return fallback;
}

// ─── Main entry: generate review ───
async function generateReview(mode, context) {
  const messages = buildReviewMessages(mode, context);

  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callAI(messages, attempt === 0 ? 0.2 : 0.0);
      const parsed = extractJson(text);
      return validateReviewOutput(mode, parsed);
    } catch (err) {
      lastError = err;
      console.warn(`AI review attempt ${attempt + 1} failed (mode=${mode}):`, err.message);
      if (attempt === 0) continue;
      // Fallback on final failure
      return createFallback(mode);
    }
  }

  const error = new Error('AI review generation failed');
  error.cause = lastError;
  throw error;
}

// ─── Convenience wrappers ───
async function generateMidyearReview(context) {
  return generateReview('midyear_summary', context);
}

async function generateFinalSelfReview(context) {
  return generateReview('final_self_assessment', context);
}

async function generateManagerReview(context) {
  return generateReview('manager_review', context);
}

// ─── Development plan generation ───
async function generateDevelopmentPlan(dataContext) {
  const messages = buildDevPlanMessages(dataContext);

  try {
    const text = await callAI(messages, 0.3);
    const parsed = extractJson(text);

    // Validate structure
    if (!parsed.recommended_actions || !Array.isArray(parsed.recommended_actions) || parsed.recommended_actions.length === 0) {
      return null; // Signal caller to use fallback
    }

    return {
      summary: parsed.summary || '',
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      gap_areas: Array.isArray(parsed.gap_areas) ? parsed.gap_areas : [],
      recommended_actions: parsed.recommended_actions.slice(0, 5).map(a => ({
        action_title: a.action_title || 'Untitled',
        description: a.description || '',
        rationale: a.rationale || '',
        suggested_timeline: a.suggested_timeline || 'TBD',
        success_metric: a.success_metric || '',
      })),
    };
  } catch (err) {
    console.warn('AI development plan generation failed:', err.message);
    return null; // Signal caller to use fallback
  }
}

// ─── Goal suggestions generation ───
async function generateGoalSuggestions(employeeData) {
  const config = getConfig();
  const contextStr = compactContext(employeeData, 3000); // very small context

  const messages = [
    {
      role: 'system',
      content: 'You are an HR performance strategist. Generate career objectives. Be concise.',
    },
    {
      role: 'user',
      content: `Generate 2-3 next career objectives for an employee. Each objective must have: title (short, actionable), description (1-2 sentences), successIndicator (measurable SMART criterion).
Analyze weaknesses to suggest improvement goals. Analyze strengths to suggest growth goals. Avoid repeating completed objectives.
Return ONLY a JSON array: [{"title":"","description":"","successIndicator":""}]
No explanations. No markdown.

Employee data:
${contextStr}`,
    },
  ];

  try {
    const text = await callAI(messages, 0.5);

    // Extract JSON array
    let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!arrayMatch) throw new Error('No JSON array found in AI response');

    const parsed = JSON.parse(arrayMatch[0]);
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Empty array');

    return parsed.slice(0, 3).map(g => ({
      title: String(g.title || '').trim().slice(0, 120),
      description: String(g.description || '').trim().slice(0, 300),
      successIndicator: String(g.successIndicator || '').trim().slice(0, 250),
    }));
  } catch (err) {
    console.warn('AI goal suggestion failed:', err.message);
    return null; // Signal caller to use fallback
  }
}

// ─── Check if AI is configured ───
function isConfigured() {
  try {
    getConfig();
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = {
  generateReview,
  generateMidyearReview,
  generateFinalSelfReview,
  generateManagerReview,
  generateDevelopmentPlan,
  generateGoalSuggestions,
  isConfigured,
  createFallback,
};
