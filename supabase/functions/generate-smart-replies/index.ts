import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message } = await req.json();
    const AI_GATEWAY_API_KEY = Deno.env.get('AI_GATEWAY_API_KEY');
    const AI_GATEWAY_URL = Deno.env.get('AI_GATEWAY_URL');

    if (!AI_GATEWAY_API_KEY || !AI_GATEWAY_URL) {
      throw new Error('AI gateway not configured (set AI_GATEWAY_API_KEY and AI_GATEWAY_URL)');
    }

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_GATEWAY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Generate 3 short, professional quick reply suggestions for the given message. Each reply should be concise (1-2 sentences) and appropriate for a business context. Return only the replies as a JSON array.'
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error('Failed to generate replies');
    }

    const data = await response.json();
    const replyText = data.choices[0].message.content;
    
    // Try to parse as JSON array, fallback to splitting by newlines
    let replies;
    try {
      replies = JSON.parse(replyText);
    } catch {
      replies = replyText
        .split('\n')
        .filter((line: string) => line.trim())
        .slice(0, 3);
    }

    return new Response(
      JSON.stringify({ replies }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating smart replies:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
