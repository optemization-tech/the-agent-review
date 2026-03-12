// The KB URL — Worker fetches this server-side so the client never sends sensitive data
const KB_URL = 'https://optemization.github.io/the-agent-review/knowledge-base.json';

// System prompt template — lives server-side, not sent from client
const SYSTEM_PROMPT_TEMPLATE = `You are an AI agent recommendation engine for The Agent Review. You help business users (non-technical: Chiefs of Staff, VP Ops, COOs, CEOs) find the right AI agent tool.

Here is the complete knowledge base of agents:
{{agents_json}}

The user selected these tasks they want to automate:
{{selected_tasks}}

The user already uses these tools:
{{selected_tools}}

The user's description of what they want:
{{user_text}}

Based on our scoring, the top recommended agent is: {{top_agent}}

Generate a JSON response with exactly two keys:
- "recommendation": A 2-3 sentence personalized paragraph explaining why this specific agent is the best fit for THEIR described needs. Be specific to what they wrote, not generic. Write in second person ("you").
- "starter_prompt": A ready-to-paste prompt they can copy directly into the recommended tool to start working on their described task immediately. Make it specific to their input.

Respond ONLY with valid JSON. No markdown, no code fences.`;

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env.ALLOWED_ORIGIN) });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Rate limiting: use Cloudflare's built-in Rate Limiting rules (configured in dashboard)
    // - Match: POST requests to this worker's URL
    // - Threshold: 5 requests per hour per IP
    // - Action: Block with 429

    try {
      const body = await request.json();
      const { selected_tasks, selected_tools, user_text, top_agent } = body;

      // Fetch KB server-side
      const kbResponse = await fetch(KB_URL);
      if (!kbResponse.ok) throw new Error('Failed to fetch knowledge base');
      const kb = await kbResponse.json();

      // Build system prompt
      const systemPrompt = SYSTEM_PROMPT_TEMPLATE
        .replace('{{agents_json}}', JSON.stringify(kb.agents))
        .replace('{{selected_tasks}}', (selected_tasks || []).join(', '))
        .replace('{{selected_tools}}', (selected_tools || []).join(', '))
        .replace('{{user_text}}', user_text || '')
        .replace('{{top_agent}}', top_agent || '');

      const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: kb.quiz?.api_config?.model || 'claude-sonnet-4-20250514',
          max_tokens: kb.quiz?.api_config?.max_tokens || 500,
          messages: [
            { role: 'user', content: 'Based on my selections and description, what agent do you recommend and what starter prompt should I use?' }
          ],
          system: systemPrompt,
        }),
      });

      if (!anthropicResponse.ok) {
        const err = await anthropicResponse.text();
        console.error('Anthropic API error:', err);
        return new Response(JSON.stringify({ error: 'API error' }), {
          status: 502,
          headers: { ...corsHeaders(env.ALLOWED_ORIGIN), 'Content-Type': 'application/json' },
        });
      }

      const result = await anthropicResponse.json();
      const content = result.content?.[0]?.text || '';

      // Parse the JSON response from Claude
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = { recommendation: content, starter_prompt: null };
      }

      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders(env.ALLOWED_ORIGIN), 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('Worker error:', err);
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { ...corsHeaders(env.ALLOWED_ORIGIN), 'Content-Type': 'application/json' },
      });
    }
  },
};

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
