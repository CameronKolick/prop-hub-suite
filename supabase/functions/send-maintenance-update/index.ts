import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MaintenanceUpdateRequest {
  maintenance_id: string;
  status: string;
  notes?: string;
  channels: string[];
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
    
    const { maintenance_id, status, notes, channels }: MaintenanceUpdateRequest = await req.json();

    // Get maintenance request details
    const { data: maintenanceRequest, error: requestError } = await supabase
      .from('maintenance_requests')
      .select(`
        *,
        properties(address, city, state),
        profiles!maintenance_requests_user_id_fkey(first_name, last_name, phone)
      `)
      .eq('id', maintenance_id)
      .single();

    if (requestError || !maintenanceRequest) {
      throw new Error('Maintenance request not found');
    }

    // Get property owner and tenant details
    const { data: property } = await supabase
      .from('properties')
      .select(`
        *,
        property_owners(first_name, last_name, email, phone),
        tenants(first_name, last_name, email, phone)
      `)
      .eq('id', maintenanceRequest.property_id)
      .single();

    // Prepare notification content
    const statusMessages = {
      'scheduled': 'Your maintenance request has been scheduled',
      'in-progress': 'Work on your maintenance request has begun',
      'completed': 'Your maintenance request has been completed',
      'cancelled': 'Your maintenance request has been cancelled',
      'on-hold': 'Your maintenance request is temporarily on hold'
    };

    const subject = `Maintenance Update: ${maintenanceRequest.title}`;
    const content = `
${statusMessages[status] || `Status updated to: ${status}`}

Property: ${property?.address}, ${property?.city}, ${property?.state}
Request: ${maintenanceRequest.title}
Description: ${maintenanceRequest.description}

${notes ? `Additional Notes: ${notes}` : ''}

Status: ${status.toUpperCase()}
${maintenanceRequest.scheduled_date ? `Scheduled Date: ${new Date(maintenanceRequest.scheduled_date).toLocaleDateString()}` : ''}
${maintenanceRequest.estimated_cost ? `Estimated Cost: $${maintenanceRequest.estimated_cost}` : ''}
`;

    const notifications = [];
    const recipients = [];

    // Add property owner to recipients
    if (property?.property_owners) {
      recipients.push({
        type: 'owner',
        email: property.property_owners.email,
        phone: property.property_owners.phone,
        name: `${property.property_owners.first_name} ${property.property_owners.last_name}`
      });
    }

    // Add tenant to recipients
    if (property?.tenants) {
      recipients.push({
        type: 'tenant',
        email: property.tenants.email,
        phone: property.tenants.phone,
        name: `${property.tenants.first_name} ${property.tenants.last_name}`
      });
    }

    // Send email notifications
    if (channels.includes('email') && resendApiKey) {
      for (const recipient of recipients) {
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
                      <p>Hello ${recipient.name},</p>
                      ${content.replace(/\n/g, '<br>')}
                    </div>
                    <div style="background: ${getStatusColor(status)}; color: white; padding: 10px; border-radius: 5px; text-align: center; margin: 20px 0;">
                      <strong>Current Status: ${status.toUpperCase()}</strong>
                    </div>
                    <p style="color: #666; font-size: 12px;">
                      This is an automated update from your property management system.
                      <br>
                      <a href="${appPublicUrl}/maintenance">View Maintenance Dashboard</a>
                    </p>
                  </div>
                `,
              }),
            });

            if (emailResponse.ok) {
              notifications.push({ 
                type: 'email', 
                status: 'sent', 
                recipient: recipient.name,
                email: recipient.email
              });
            }
          } catch (error) {
            console.error('Email send error:', error);
            notifications.push({ 
              type: 'email', 
              status: 'failed', 
              recipient: recipient.name,
              error: error.message
            });
          }
        }
      }
    }

    // Send SMS notifications
    if (channels.includes('sms') && twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
      for (const recipient of recipients) {
        if (recipient.phone) {
          try {
            const smsContent = `${subject}\n\n${statusMessages[status] || `Status: ${status}`}\n\nProperty: ${property?.address}\nRequest: ${maintenanceRequest.title}${notes ? `\n\nNotes: ${notes}` : ''}`;
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
                recipient: recipient.name,
                phone: recipient.phone
              });
            }
          } catch (error) {
            console.error('SMS send error:', error);
            notifications.push({ 
              type: 'sms', 
              status: 'failed', 
              recipient: recipient.name,
              error: error.message
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        maintenance_id,
        status,
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
    console.error('Error in send-maintenance-update:', error);
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

function getStatusColor(status: string): string {
  switch (status) {
    case 'scheduled': return '#3b82f6';
    case 'in-progress': return '#f59e0b';
    case 'completed': return '#10b981';
    case 'cancelled': return '#ef4444';
    case 'on-hold': return '#6b7280';
    default: return '#6b7280';
  }
}