import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InspectionData {
  sessionId: string;
  propertyAddress: string;
  checkType: string;
  photos: Array<{ url: string; caption?: string }>;
  checklistData: Record<string, any>;
  generalNotes?: string;
  weather?: string;
  overallCondition?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY");
    const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL");
    if (!AI_GATEWAY_API_KEY || !AI_GATEWAY_URL) {
      throw new Error("AI gateway not configured (set AI_GATEWAY_API_KEY and AI_GATEWAY_URL)");
    }

    const data: InspectionData = await req.json();
    console.log("Generating inspection summary for session:", data.sessionId);

    // Build the prompt with all inspection context
    const checklistSummary = Object.entries(data.checklistData || {})
      .map(([section, items]) => {
        if (typeof items === 'object' && items !== null) {
          const itemsList = Object.entries(items)
            .map(([item, status]) => `  - ${item}: ${status}`)
            .join('\n');
          return `${section}:\n${itemsList}`;
        }
        return `${section}: ${items}`;
      })
      .join('\n\n');

    // Prepare messages with photos for vision analysis
    const userContent: any[] = [
      {
        type: "text",
        text: `You are a professional property inspector. Generate a comprehensive inspection summary report based on the following home check data and photos.

PROPERTY: ${data.propertyAddress}
CHECK TYPE: ${data.checkType}
WEATHER CONDITIONS: ${data.weather || 'Not recorded'}
OVERALL CONDITION NOTED: ${data.overallCondition || 'Not specified'}

CHECKLIST RESULTS:
${checklistSummary || 'No checklist data provided'}

INSPECTOR NOTES:
${data.generalNotes || 'No additional notes'}

Based on the above information and the attached photos, generate a professional inspection report with:

1. **Executive Summary** (2-3 sentences overview)
2. **Property Condition Assessment** (rate: Excellent/Good/Fair/Poor with explanation)
3. **Areas Inspected** (list with status)
4. **Issues Identified** (if any, with severity: Critical/Major/Minor)
5. **Photo Analysis** (describe what you observe in each photo)
6. **Recommendations** (immediate actions and preventive maintenance)
7. **Next Steps** (what the property owner should know)

Format the report professionally for sending to property owners.`
      }
    ];

    // Add photos for vision analysis (limit to 5 to avoid token limits)
    const photosToAnalyze = data.photos.slice(0, 5);
    for (const photo of photosToAnalyze) {
      if (photo.url) {
        userContent.push({
          type: "image_url",
          image_url: { url: photo.url }
        });
        if (photo.caption) {
          userContent.push({
            type: "text",
            text: `Photo caption: ${photo.caption}`
          });
        }
      }
    }

    console.log(`Analyzing ${photosToAnalyze.length} photos with vision AI`);

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
            role: "user",
            content: userContent
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
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

    const aiResponse = await response.json();
    const summary = aiResponse.choices?.[0]?.message?.content;

    if (!summary) {
      throw new Error("No summary generated from AI");
    }

    console.log("Inspection summary generated successfully");

    // Store the summary in the database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update the home check session with the AI summary
    const { error: updateError } = await supabase
      .from("home_check_sessions")
      .update({
        checklist_data: {
          ...data.checklistData,
          ai_summary: summary,
          ai_summary_generated_at: new Date().toISOString(),
          photos_analyzed: photosToAnalyze.length,
        }
      })
      .eq("id", data.sessionId);

    if (updateError) {
      console.error("Error saving summary:", updateError);
    }

    return new Response(
      JSON.stringify({ 
        summary,
        photosAnalyzed: photosToAnalyze.length,
        generatedAt: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Inspection summary error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
