import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CommunicationRequest {
  recipients: string[];
  subject: string;
  content: string;
  channels: string[]; // ['email', 'sms', 'push']
  type: 'manual' | 'automated';
  maintenance_id?: string;
  property_id?: string;
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
    
    const { recipients, subject, content, channels, type, maintenance_id, property_id }: CommunicationRequest = 
      await req.json();

    // Get sender info
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    // Get recipient details and preferences
    let recipientData = [];
    
    if (recipients.includes('all-tenants')) {
      const { data: tenants } = await supabase
        .from('tenants')
        .select('user_account_id, first_name, last_name, email, phone');
      recipientData.push(...(tenants || []));
    }
    
    if (recipients.includes('all-owners')) {
      const { data: owners } = await supabase
        .from('property_owners')
        .select('user_id, first_name, last_name, email, phone');
      recipientData.push(...(owners || []));
    }

    if (recipients.includes('maintenance-team')) {
      const { data: maintenance } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          profiles(first_name, last_name, phone)
        `)
        .eq('role', 'maintenance_staff');
      recipientData.push(...(maintenance || []));
    }

    const notifications = [];

    // Send email notifications
    if (channels.includes('email') && resendApiKey) {
      for (const recipient of recipientData) {
        if (recipient.email) {
          try {
            const emailResponse = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'Property Management <noreply@yourdomain.com>',
                to: [recipient.email],
                subject: subject,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">${subject}</h2>
                    <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      ${content.replace(/\n/g, '<br>')}
                    </div>
                    <p style="color: #666; font-size: 12px;">
                      This is an automated message from your property management system.
                      <br>
                      <a href="${appPublicUrl}">Login to your dashboard</a>
                    </p>
                  </div>
                `,
              }),
            });

            if (emailResponse.ok) {
              notifications.push({ 
                type: 'email', 
                status: 'sent', 
                recipient: recipient.user_id || recipient.user_account_id,
                email: recipient.email
              });
            }
          } catch (error) {
            console.error('Email send error:', error);
            notifications.push({ 
              type: 'email', 
              status: 'failed', 
              recipient: recipient.user_id || recipient.user_account_id,
              error: error.message
            });
          }
        }
      }
    }

    // Send SMS notifications
    if (channels.includes('sms') && twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
      for (const recipient of recipientData) {
        if (recipient.phone) {
          try {
            const smsContent = `${subject}\n\n${content}`;
            const truncatedContent = smsContent.length > 160 ? 
              smsContent.substring(0, 157) + '...' : smsContent;

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
                  To: recipient.phone,
                  Body: truncatedContent,
                }),
              }
            );

            if (smsResponse.ok) {
              notifications.push({ 
                type: 'sms', 
                status: 'sent', 
                recipient: recipient.user_id || recipient.user_account_id,
                phone: recipient.phone
              });
            }
          } catch (error) {
            console.error('SMS send error:', error);
            notifications.push({ 
              type: 'sms', 
              status: 'failed', 
              recipient: recipient.user_id || recipient.user_account_id,
              error: error.message
            });
          }
        }
      }
    }

    // Log the communication in the database (you would create a communications_log table)
    // For now, we'll just return the results

    return new Response(
      JSON.stringify({ 
        success: true, 
        notifications_sent: notifications.filter(n => n.status === 'sent').length,
        notifications_failed: notifications.filter(n => n.status === 'failed').length,
        details: notifications 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in send-communication:', error);
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