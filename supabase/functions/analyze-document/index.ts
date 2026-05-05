import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId, fileName, description } = await req.json();

    const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY");
    const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL");
    if (!AI_GATEWAY_API_KEY || !AI_GATEWAY_URL) {
      throw new Error("AI gateway not configured (set AI_GATEWAY_API_KEY and AI_GATEWAY_URL)");
    }

    // Build context for AI analysis
    const context = `
Document: ${fileName}
${description ? `Description: ${description}` : ""}

Analyze this document and provide:
1. Suggested category (from: general, contracts, invoices, reports, photos, maintenance, legal)
2. 3-5 relevant tags
3. A brief summary of what this document likely contains based on the filename and description

Return the response in JSON format.
`;

    console.log("Analyzing document:", documentId);

    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_GATEWAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a document classification expert. Analyze documents and provide categorization, tags, and summaries. Always respond with valid JSON only.",
          },
          { role: "user", content: context },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classify_document",
              description: "Classify and tag a document",
              parameters: {
                type: "object",
                properties: {
                  category: {
                    type: "string",
                    enum: ["general", "contracts", "invoices", "reports", "photos", "maintenance", "legal"],
                    description: "The most appropriate category for this document",
                  },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-5 relevant tags for this document",
                    minItems: 3,
                    maxItems: 5,
                  },
                  summary: {
                    type: "string",
                    description: "A brief summary of the document content",
                  },
                  confidence: {
                    type: "number",
                    description: "Confidence score from 0 to 1",
                  },
                },
                required: ["category", "tags", "summary", "confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classify_document" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data, null, 2));

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in response");
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    // Update document with AI suggestions
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { error: updateError } = await supabase
        .from("documents")
        .update({
          category: analysis.category,
          tags: analysis.tags,
          description: analysis.summary,
        })
        .eq("id", documentId);

      if (updateError) {
        console.error("Error updating document:", updateError);
      } else {
        console.log("Document updated successfully");
      }
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in analyze-document function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
