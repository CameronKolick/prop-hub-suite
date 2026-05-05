import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TriageRequest {
  requestId?: string;
  title: string;
  description: string;
  photos?: Array<{ url: string }>;
  propertyId?: string;
  propertyType?: string;
  tenantReported?: boolean;
}

interface TriageResult {
  category: string;
  subcategory: string;
  priority: "emergency" | "urgent" | "normal" | "low";
  priorityReason: string;
  estimatedCostRange: { min: number; max: number };
  troubleshootingSteps: string[];
  safetyWarnings: string[];
  dispatchRecommendation: "immediate" | "schedule" | "troubleshoot_first" | "monitor";
  suggestedVendors: Array<{
    id: string;
    name: string;
    specialty: string;
    rating: number;
    matchScore: number;
    reason: string;
  }>;
  aiNotes: string;
  photoAnalysis?: string;
  estimatedResolutionTime: string;
  ownerApprovalRequired: boolean;
  ownerApprovalReason?: string;
}

const CATEGORIES = [
  "Plumbing",
  "HVAC",
  "Electrical",
  "Appliance",
  "Structural",
  "Roofing",
  "Flooring",
  "Pest Control",
  "Landscaping",
  "Security",
  "General Maintenance",
  "Cleaning",
  "Lock/Key",
  "Pool/Spa",
  "Fire Safety"
];

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

    const data: TriageRequest = await req.json();
    console.log("Triaging maintenance request:", data.title);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch available vendors for matching
    const { data: vendors } = await supabase
      .from("vendors")
      .select("id, company_name, contact_name, specialty, rating, hourly_rate, status")
      .eq("status", "active")
      .order("rating", { ascending: false });

    const vendorContext = vendors?.map(v => 
      `- ${v.company_name} (${v.contact_name}): ${v.specialty || 'General'}, Rating: ${v.rating || 'N/A'}, Rate: $${v.hourly_rate || 'N/A'}/hr`
    ).join("\n") || "No vendors available";

    // Build the AI prompt
    const userContent: any[] = [
      {
        type: "text",
        text: `You are an expert property maintenance triage system. Analyze the following maintenance request and provide a comprehensive triage assessment.

MAINTENANCE REQUEST:
Title: ${data.title}
Description: ${data.description}
Property Type: ${data.propertyType || 'Unknown'}
Reported By: ${data.tenantReported ? 'Tenant' : 'Staff/Owner'}

AVAILABLE VENDORS:
${vendorContext}

CATEGORIES TO CHOOSE FROM:
${CATEGORIES.join(", ")}

Provide your analysis as a JSON object with this EXACT structure:
{
  "category": "Primary category from the list",
  "subcategory": "More specific issue type",
  "priority": "emergency|urgent|normal|low",
  "priorityReason": "Brief explanation of priority level",
  "estimatedCostRange": { "min": number, "max": number },
  "troubleshootingSteps": ["Step 1 tenant can try", "Step 2", "Step 3"],
  "safetyWarnings": ["Any safety concerns"],
  "dispatchRecommendation": "immediate|schedule|troubleshoot_first|monitor",
  "suggestedVendors": [
    {
      "id": "vendor_id_from_list_or_null",
      "name": "Vendor name",
      "specialty": "Their specialty",
      "rating": number_or_0,
      "matchScore": 1-100,
      "reason": "Why this vendor is recommended"
    }
  ],
  "aiNotes": "Additional insights or recommendations",
  "photoAnalysis": "Description of what photos show (if provided)",
  "estimatedResolutionTime": "e.g., '2-4 hours', '1-2 days'",
  "ownerApprovalRequired": boolean,
  "ownerApprovalReason": "If approval needed, explain why"
}

Priority Guidelines:
- EMERGENCY: Active water leak, gas smell, no heat in freezing temps, electrical hazard, fire risk, security breach
- URGENT: HVAC issues in extreme weather, broken locks, major appliance failure, partial water issues
- NORMAL: Routine repairs, cosmetic issues, minor appliance problems
- LOW: Preventive maintenance, minor cosmetic issues, non-essential upgrades

Cost Estimation Guidelines:
- Consider labor ($50-150/hr), parts, and complexity
- Provide realistic ranges based on market rates

Return ONLY the JSON object, no additional text.`
      }
    ];

    // Add photos for vision analysis if available
    if (data.photos && data.photos.length > 0) {
      const photosToAnalyze = data.photos.slice(0, 3);
      for (const photo of photosToAnalyze) {
        if (photo.url) {
          userContent.push({
            type: "image_url",
            image_url: { url: photo.url }
          });
        }
      }
      console.log(`Analyzing ${photosToAnalyze.length} photos with vision AI`);
    }

    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_GATEWAY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: userContent }],
        temperature: 0.2,
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
    let resultText = aiResponse.choices?.[0]?.message?.content || "";
    
    // Clean up the response - remove markdown code blocks if present
    resultText = resultText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    let triageResult: TriageResult;
    try {
      triageResult = JSON.parse(resultText);
    } catch (parseError) {
      console.error("Failed to parse AI response:", resultText);
      throw new Error("AI returned invalid response format");
    }

    console.log("Triage complete:", triageResult.category, triageResult.priority);

    // Update the maintenance request if ID provided
    if (data.requestId) {
      const { error: updateError } = await supabase
        .from("maintenance_requests")
        .update({
          priority: triageResult.priority,
          notes: JSON.stringify({
            ai_triage: triageResult,
            triaged_at: new Date().toISOString(),
          }),
        })
        .eq("id", data.requestId);

      if (updateError) {
        console.error("Error updating maintenance request:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        triage: triageResult,
        triagedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Maintenance triage error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
