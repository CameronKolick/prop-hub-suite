import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userId } = await req.json();
    const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY");
    const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL");

    if (!AI_GATEWAY_API_KEY || !AI_GATEWAY_URL) {
      throw new Error("AI gateway not configured (set AI_GATEWAY_API_KEY and AI_GATEWAY_URL)");
    }

    // Get user context from database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let contextInfo = "";

    if (userId) {
      // Fetch user's properties
      const { data: properties } = await supabase
        .from("properties")
        .select("id, name, address, status, monthly_rent, property_type")
        .eq("user_id", userId)
        .limit(10);

      // Fetch recent maintenance requests
      const { data: maintenance } = await supabase
        .from("maintenance_requests")
        .select("id, title, status, priority, created_at, property_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);

      // Fetch house watching clients
      const { data: houseWatching } = await supabase
        .from("house_watching")
        .select("id, property_address, owner_name, status, next_check_date")
        .eq("user_id", userId)
        .limit(10);

      contextInfo = `
USER CONTEXT:
- Properties managed: ${properties?.length || 0}
${properties?.map(p => `  • ${p.name || p.address} (${p.status}, $${p.monthly_rent}/mo)`).join("\n") || "  None"}

- Recent maintenance requests: ${maintenance?.length || 0}
${maintenance?.map(m => `  • ${m.title} - ${m.status} (${m.priority} priority)`).join("\n") || "  None"}

- House watching clients: ${houseWatching?.length || 0}
${houseWatching?.map(h => `  • ${h.property_address} - ${h.owner_name} (${h.status})`).join("\n") || "  None"}
`;
    }

    const systemPrompt = `You are an AI Property Assistant for a professional property management and house watching application. You help property managers, house watchers, landlords, and tenants with their questions.

Your capabilities:
- Answer questions about properties, leases, and maintenance
- Provide guidance on property management best practices
- Help with house watching and home check procedures
- Explain features of the application
- Provide general real estate and property management advice

${contextInfo}

Guidelines:
- Be professional, helpful, and concise
- If you don't have specific data, provide general guidance
- For urgent maintenance issues, advise contacting emergency services if needed
- Always be accurate about the user's actual data when available
- Suggest using specific features of the app when relevant`;

    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_GATEWAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits required. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Property assistant error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
