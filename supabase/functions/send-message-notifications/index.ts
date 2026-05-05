import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  conversation_id: string;
  message_content: string;
  conversation_title: string;
  recipients?: string[];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const appPublicUrl = Deno.env.get("APP_PUBLIC_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { conversation_id, message_content, conversation_title }: NotificationRequest = 
      await req.json();

    // Get conversation participants and their communication settings
    const { data: participants, error: participantsError } = await supabase
      .from('conversation_participants')
      .select(`
        user_id,
        profiles(first_name, last_name, phone),
        user_communication_settings(email_enabled, sms_enabled)
      `)
      .eq('conversation_id', conversation_id);

    if (participantsError) {
      console.error('Error fetching participants:', participantsError);
      throw participantsError;
    }

    // Get sender info from auth context
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { data: sender } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('user_id', user.id)
      .single();

    const senderName = sender ? `${sender.first_name} ${sender.last_name}` : 'Someone';

    const notifications = [];

    // Send email notifications
    if (resendApiKey && participants) {
      for (const participant of participants) {
        if (participant.user_id !== user.id && 
            participant.user_communication_settings?.email_enabled) {
          
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Property Management <noreply@yourdomain.com>',
              to: [`${participant.profiles?.first_name}@example.com`], // You'll need actual email
              subject: `New message in ${conversation_title}`,
              html: `
                <h2>New Message from ${senderName}</h2>
                <p><strong>Conversation:</strong> ${conversation_title}</p>
                <p><strong>Message:</strong></p>
                <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
                  ${message_content}
                </div>
                <p><a href="${appPublicUrl}/messages">View in App</a></p>
              `,
            }),
          });

          if (emailResponse.ok) {
            notifications.push({ type: 'email', status: 'sent', recipient: participant.user_id });
          }
        }
      }
    }

    // Send SMS notifications
    if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber && participants) {
      for (const participant of participants) {
        if (participant.user_id !== user.id && 
            participant.user_communication_settings?.sms_enabled &&
            participant.profiles?.phone) {
          
          const smsResponse = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                From: twilioPhoneNumber,
                To: participant.profiles.phone,
                Body: `New message from ${senderName} in ${conversation_title}: ${message_content.substring(0, 100)}${message_content.length > 100 ? '...' : ''}`,
              }),
            }
          );

          if (smsResponse.ok) {
            notifications.push({ type: 'sms', status: 'sent', recipient: participant.user_id });
          }
        }
      }
    }

    // Log notification deliveries
    if (notifications.length > 0) {
      await supabase
        .from('message_deliveries')
        .insert(
          notifications.map(n => ({
            conversation_id,
            recipient_id: n.recipient,
            delivery_method: n.type,
            delivery_status: n.status,
            delivered_at: new Date().toISOString()
          }))
        );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        notifications_sent: notifications.length,
        details: notifications 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in send-message-notifications:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});