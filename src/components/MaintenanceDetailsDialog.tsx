import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, User, Clock, History, Save, UserPlus, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { MaintenanceRequest, useUpdateMaintenanceRequest, useMaintenanceStatusHistory, useAssignMaintenanceRequest } from "@/hooks/queries/useMaintenanceRequests";
import { useProfiles } from "@/hooks/queries/useProfiles";
import MaintenanceTimeline from "@/components/MaintenanceTimeline";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
interface MaintenanceDetailsDialogProps {
  request: MaintenanceRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MaintenanceDetailsDialog = ({ request, open, onOpenChange }: MaintenanceDetailsDialogProps) => {
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(
    request?.scheduled_date ? new Date(request.scheduled_date) : undefined
  );
  const [dueDate, setDueDate] = useState<Date | undefined>(
    request?.due_date ? new Date(request.due_date) : undefined
  );
  const [status, setStatus] = useState<MaintenanceRequest['status']>(request?.status || 'pending');
  const [assignedTo, setAssignedTo] = useState(request?.assigned_to || 'unassigned');
  const [completionNotes, setCompletionNotes] = useState(request?.completion_notes || '');
  const [actualCost, setActualCost] = useState(request?.actual_cost?.toString() || '');

  const updateRequest = useUpdateMaintenanceRequest();
  const assignRequest = useAssignMaintenanceRequest();
  const { data: profiles = [] } = useProfiles();
  const { data: statusHistory = [] } = useMaintenanceStatusHistory(request?.id || '');
  const { toast } = useToast();
  if (!request) return null;

  const handleSave = async () => {
    const updates: Partial<MaintenanceRequest> = {
      status: status as MaintenanceRequest['status'],
      scheduled_date: scheduledDate?.toISOString() || null,
      due_date: dueDate?.toISOString() || null,
      completion_notes: completionNotes || null,
      actual_cost: actualCost ? parseFloat(actualCost) : null,
    };

    const statusChanged = request.status !== status;

    await updateRequest.mutateAsync({ id: request.id, updates });

    if (statusChanged) {
      try {
        const { error } = await supabase.functions.invoke('send-maintenance-update', {
          body: {
            maintenance_id: request.id,
            status,
            notes: completionNotes,
            channels: ['email']
          }
        });
        if (error) throw error;
        toast({ title: 'Status updated', description: 'Notifications sent' });
      } catch (e) {
        console.error('Failed to send maintenance update', e);
        toast({ title: 'Notification failed', description: 'Could not send notifications', variant: 'destructive' });
      }
    }
  };

  const handleAssign = async () => {
    if (assignedTo !== request.assigned_to) {
      const assignToUser = assignedTo === 'unassigned' ? null : assignedTo;
      await assignRequest.mutateAsync({ requestId: request.id, assignedTo: assignToUser });
    }
  };

  const handleTimelineStatusChange = async (newStatus: string, notes?: string) => {
    try {
      setStatus(newStatus as MaintenanceRequest['status']);
      await updateRequest.mutateAsync({ id: request.id, updates: { status: newStatus as MaintenanceRequest['status'] } });

      const { error } = await supabase.functions.invoke('send-maintenance-update', {
        body: {
          maintenance_id: request.id,
          status: newStatus,
          notes,
          channels: ['email']
        }
      });

      if (error) throw error;

      toast({ title: 'Status updated', description: 'Notifications sent' });
    } catch (e) {
      console.error('Failed to update status/notify', e);
      toast({ title: 'Update failed', description: 'Could not send notifications', variant: 'destructive' });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800 border-red-200";
      case "high": return "bg-orange-100 text-orange-800 border-orange-200";
      case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low": return "bg-green-100 text-green-800 border-green-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800 border-green-200";
      case "in-progress": return "bg-blue-100 text-blue-800 border-blue-200";
      case "scheduled": return "bg-purple-100 text-purple-800 border-purple-200";
      case "pending": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "cancelled": return "bg-gray-100 text-gray-800 border-gray-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{request.title}</span>
            <div className="flex gap-2">
              <Badge className={`${getPriorityColor(request.priority)} border`}>
                {request.priority}
              </Badge>
              <Badge className={`${getStatusColor(status)} border`}>
                {status}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Request Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Property</Label>
                    <p className="text-sm font-medium">
                      {request.properties ? 
                        `${request.properties.address}${request.properties.city ? `, ${request.properties.city}` : ''}` :
                        'Unknown Property'
                      }
                    </p>
                  </div>
                  <div>
                    <Label>Request ID</Label>
                    <p className="text-sm font-mono">{request.id}</p>
                  </div>
                </div>
                
                <div>
                  <Label>Description</Label>
                  <p className="text-sm">{request.description || 'No description provided'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Contractor</Label>
                    <p className="text-sm">{request.contractor_name || 'Not assigned'}</p>
                  </div>
                  <div>
                    <Label>Contact</Label>
                    <p className="text-sm">{request.contractor_contact || 'No contact info'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Estimated Cost</Label>
                    <p className="text-sm">{request.estimated_cost ? `$${request.estimated_cost}` : 'Not estimated'}</p>
                  </div>
                  <div>
                    <Label>Actual Cost</Label>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <Input
                        type="number"
                        value={actualCost}
                        onChange={(e) => setActualCost(e.target.value)}
                        placeholder="0.00"
                        className="w-24"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Completion Notes</Label>
                  <Textarea
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    placeholder="Add notes about the work completed..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as MaintenanceRequest['status'])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    Scheduling
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Scheduled Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !scheduledDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={scheduledDate}
                          onSelect={setScheduledDate}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label>Due Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !dueDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dueDate}
                          onSelect={setDueDate}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Assignment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Assign To</Label>
                    <Select value={assignedTo} onValueChange={setAssignedTo}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select user to assign" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {profiles.map((profile) => (
                          <SelectItem key={profile.user_id} value={profile.user_id}>
                            {profile.first_name} {profile.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {request.assigned_to && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Currently assigned to:</p>
                      <p className="font-medium">
                        {request.assigned_user ? 
                          `${request.assigned_user.first_name} ${request.assigned_user.last_name}` :
                          'Unknown User'
                        }
                      </p>
                      {request.assigned_at && (
                        <p className="text-xs text-muted-foreground">
                          Assigned: {format(new Date(request.assigned_at), "PPp")}
                        </p>
                      )}
                    </div>
                  )}

                  <Button onClick={handleAssign} className="w-full" variant="outline">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Update Assignment
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <MaintenanceTimeline
              requestId={request.id}
              currentStatus={status}
              onStatusChange={handleTimelineStatusChange}
            />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateRequest.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {updateRequest.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MaintenanceDetailsDialog;