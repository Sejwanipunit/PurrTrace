// PawTrace pet-ai Edge Function.
//
// Claude-powered vision features, called from the signed-in web client via
// supabase.functions.invoke('pet-ai', { body: { action, ... } }).
//
//   action: 'describe'  → auto-tag a pet from a photo (species/breed/colour/markings/description)
//   action: 'match'     → compare a subject pet photo against candidate photos and rank likely matches
//
// Deploy:   supabase functions deploy pet-ai --no-verify-jwt
// Secrets:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//           (optional) supabase secrets set AI_MODEL=claude-haiku-4-5   # cheaper; default claude-opus-5
// (SUPABASE_URL and SUPABASE_ANON_KEY are provided automatically.)

import Anthropic from 'npm:@anthropic-ai/sdk@0.69.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const MODEL = Deno.env.get('AI_MODEL') ?? 'claude-opus-5';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

// Pull the first JSON object out of a model response (guards against stray prose).
function parseJsonObject(text: string): Record<string, unknown> {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error('No JSON object in model output');
  return JSON.parse(text.slice(start, end + 1));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function imageBlock(src: { imageUrl?: string; imageBase64?: string; mediaType?: string }): any {
  if (src.imageUrl) return { type: 'image', source: { type: 'url', url: src.imageUrl } };
  return {
    type: 'image',
    source: { type: 'base64', media_type: src.mediaType ?? 'image/jpeg', data: src.imageBase64 },
  };
}

async function callClaude(
  client: Anthropic,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any[],
  system: string,
  maxTokens: number,
  effort: 'low' | 'medium' | 'high',
): Promise<string> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    output_config: { effort },
    messages: [{ role: 'user', content }],
  });
  const textBlock = res.content.find((b) => b.type === 'text');
  // @ts-expect-error narrowed by runtime check
  return textBlock?.text ?? '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // Require a signed-in Supabase user (protects the Anthropic key from anonymous abuse).
  const authHeader = req.headers.get('Authorization') ?? '';
  try {
    const authed = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await authed.auth.getUser();
    if (!user) return json({ error: 'unauthorized' }, 401);
  } catch {
    return json({ error: 'unauthorized' }, 401);
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'ai_not_configured', detail: 'ANTHROPIC_API_KEY secret is not set' }, 503);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const client = new Anthropic({ apiKey });

  try {
    if (body.action === 'describe') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content: any[] = [
        imageBlock(body as { imageUrl?: string; imageBase64?: string; mediaType?: string }),
        {
          type: 'text',
          text:
            'Identify this pet for a lost-and-found listing. Respond with ONLY a JSON object, no other text:\n' +
            '{"species":"dog"|"cat"|"other","breed":string (best guess, "" if unsure),' +
            '"color":string,"markings":string (distinctive features: collar, patches, ear notches, tail, size),' +
            '"description":string (2-3 warm, factual sentences describing the pet)}',
        },
      ];
      const text = await callClaude(
        client,
        content,
        'You are a careful pet-identification assistant. Only state what is visible; never invent details.',
        1000,
        'low'
      );
      const parsed = parseJsonObject(text);
      return json({ result: parsed });
    }

    if (body.action === 'match') {
      const subject = body.subject as { imageUrl?: string; name?: string; species?: string; breed?: string };
      const candidates = (body.candidates ?? []) as Array<{ id: string; imageUrl?: string; name?: string; species?: string; breed?: string }>;
      if (!subject?.imageUrl || candidates.length === 0) return json({ result: { matches: [] } });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const content: any[] = [];
      content.push({ type: 'text', text: `SUBJECT pet — ${subject.species ?? 'pet'}${subject.breed ? `, ${subject.breed}` : ''}${subject.name ? `, named "${subject.name}"` : ''}:` });
      content.push(imageBlock(subject));
      for (const c of candidates.slice(0, 6)) {
        content.push({ type: 'text', text: `CANDIDATE id=${c.id} — ${c.species ?? 'pet'}${c.breed ? `, ${c.breed}` : ''}${c.name ? `, "${c.name}"` : ''}:` });
        content.push(imageBlock(c));
      }
      content.push({
        type: 'text',
        text:
          'Could any CANDIDATE be the SAME individual animal as the SUBJECT (for reuniting a lost pet)? ' +
          'Compare coat colour/pattern, markings, ears, face, size, collar. Be conservative — a different pet of the same breed is NOT a match. ' +
          'Respond with ONLY JSON: {"matches":[{"id":string,"confidence":number(0-100),"reasoning":string(one sentence citing specific visual evidence)}]}. ' +
          'Include only candidates with confidence >= 40, sorted by confidence descending. If none, return {"matches":[]}.',
      });
      const text = await callClaude(
        client,
        content,
        'You help reunite lost pets by judging whether two photos show the same individual animal. Precision matters more than recall — do not guess.',
        2000,
        'medium'
      );
      const parsed = parseJsonObject(text);
      return json({ result: parsed });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    return json({ error: 'ai_failed', detail: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }, 500);
  }
});
