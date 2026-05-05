import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Home,
  FileText,
  MessageSquare,
  Settings,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  Camera,
  MapPin,
  Phone,
  Mail
} from "lucide-react";

const ClientDashboard = () => {
  const [user] = useState({
    name: "Sarah Johnson",
    email: "sarah.johnson@email.com",
    phone: "(555) 123-4567"
  });

  const [properties] = useState([
    {
      id: 1,
      address: "456 Oak Street, Riverside, CA 92501",
      status: "Active",
      lastCheck: "2024-01-08",
      nextCheck: "2024-01-15",
      recentIssues: 0,
      service: "Weekly"
    },
    {
      id: 2,
      address: "123 Pine Avenue, Riverside, CA 92502",
      status: "Active", 
      lastCheck: "2024-01-07",
      nextCheck: "2024-01-21",
      recentIssues: 1,
      service: "Bi-weekly"
    }
  ]);

  const [recentActivity] = useState([
    {
      id: 1,
      type: "check_completed",
      property: "456 Oak Street",
      date: "2024-01-08",
      description: "Weekly property check completed - All systems normal"
    },
    {
      id: 2,
      type: "issue_reported",
      property: "123 Pine Avenue",
      date: "2024-01-07",
      description: "Minor issue reported: Sprinkler system needs adjustment"
    },
    {
      id: 3,
      type: "check_completed",
      property: "456 Oak Street",
      date: "2024-01-01",
      description: "Weekly property check completed - Holiday check"
    }
  ]);

  const [recentMessages] = useState([
    {
      id: 1,
      from: "Property Manager",
      subject: "Scheduled Maintenance Update",
      preview: "Your scheduled maintenance for 456 Oak Street has been completed. All systems are working properly.",
      date: "2024-01-08",
      read: false,
      property: "456 Oak Street"
    },
    {
      id: 2,
      from: "Sarah at Latitude Premier",
      subject: "Monthly Report Available",
      preview: "Your monthly property report is now available for download. Please review the attached documents.",
      date: "2024-01-07",
      read: true,
      property: "123 Pine Avenue"
    },
    {
      id: 3,
      from: "Maintenance Team",
      subject: "Service Request Completed",
      preview: "The sprinkler system adjustment you requested has been completed. Everything is working normally.",
      date: "2024-01-06",
      read: false,
      property: "123 Pine Avenue"
    }
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active": return "bg-success text-success-foreground";
      case "Issue": return "bg-warning text-warning-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "check_completed": return <CheckCircle className="h-4 w-4 text-success" />;
      case "issue_reported": return <AlertCircle className="h-4 w-4 text-warning" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="bg-card border-b border-border p-6 shadow-sm">
        <div className="max-w-[min(1200px,100%)] mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src="/brand/42342793-c892-4f13-94af-fd1566d9a29a.png"
                alt="Latitude Premier Properties logo" 
                className="w-12 h-12 object-contain"
                loading="lazy"
                decoding="async"
              />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Client Portal</h1>
                <p className="text-muted-foreground">Welcome back, {user.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {user.email}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Phone className="h-4 w-4" />
                  {user.phone}
                </div>
              </div>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[min(1200px,100%)] mx-auto p-6">
        {/* Quick Actions */}
        <Card className="mb-6 shadow-md border-0">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
              <Link to={`${window.location.pathname.includes('/demo') ? '/demo' : ''}/client-portal/requests`}>
                <Button className="bg-gradient-primary hover:bg-primary-dark">
                  <Settings className="h-4 w-4 mr-2" />
                  Request Service
                </Button>
              </Link>
              <Link to={`${window.location.pathname.includes('/demo') ? '/demo' : ''}/client-portal/messages`}>
                <Button variant="outline">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
              </Link>
              <Link to={`${window.location.pathname.includes('/demo') ? '/demo' : ''}/client-portal/reports`}>
                <Button variant="outline">
                  <Camera className="h-4 w-4 mr-2" />
                  View Photos
                </Button>
              </Link>
              <Link to={`${window.location.pathname.includes('/demo') ? '/demo' : ''}/client-portal/properties`}>
                <Button variant="outline">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Visit
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link to={`${window.location.pathname.includes('/demo') ? '/demo' : ''}/client-portal/properties`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-0 shadow-md">
              <CardContent className="p-6 text-center">
                <Home className="h-12 w-12 mx-auto mb-3 text-primary" />
                <h3 className="font-semibold text-foreground">My Properties</h3>
                <p className="text-sm text-muted-foreground">View property details</p>
              </CardContent>
            </Card>
          </Link>

          <Link to={`${window.location.pathname.includes('/demo') ? '/demo' : ''}/client-portal/reports`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-0 shadow-md">
              <CardContent className="p-6 text-center">
                <FileText className="h-12 w-12 mx-auto mb-3 text-primary" />
                <h3 className="font-semibold text-foreground">Check Reports</h3>
                <p className="text-sm text-muted-foreground">View inspection reports</p>
              </CardContent>
            </Card>
          </Link>

          <Link to={`${window.location.pathname.includes('/demo') ? '/demo' : ''}/client-portal/requests`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-0 shadow-md">
              <CardContent className="p-6 text-center">
                <Settings className="h-12 w-12 mx-auto mb-3 text-primary" />
                <h3 className="font-semibold text-foreground">Service Requests</h3>
                <p className="text-sm text-muted-foreground">Request maintenance</p>
              </CardContent>
            </Card>
          </Link>

          <Link to={`${window.location.pathname.includes('/demo') ? '/demo' : ''}/client-portal/messages`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-0 shadow-md">
              <CardContent className="p-6 text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 text-primary" />
                <h3 className="font-semibold text-foreground">Messages</h3>
                <p className="text-sm text-muted-foreground">Communication center</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Properties Overview */}
          <Card className="shadow-md border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5" />
                Property Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {properties.map((property) => (
                <div key={property.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">{property.address}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Service: {property.service}</span>
                      <span>Last Check: {property.lastCheck}</span>
                      <span>Next: {property.nextCheck}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {property.recentIssues > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {property.recentIssues} Issue{property.recentIssues > 1 ? 's' : ''}
                      </Badge>
                    )}
                    <Badge className={getStatusColor(property.status)}>
                      {property.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent Messages */}
          <Card className="shadow-md border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Recent Messages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentMessages.map((message) => (
                <div key={message.id} className="flex items-start gap-3 p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                  <div className="mt-1">
                    {message.read ? (
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Badge className="w-2 h-2 p-0 bg-primary rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-medium text-foreground ${!message.read ? 'font-semibold' : ''}`}>
                        {message.from}
                      </span>
                      <span className="text-xs text-muted-foreground">{message.date}</span>
                    </div>
                    <p className={`text-sm font-medium mb-1 ${!message.read ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                      {message.subject}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">{message.preview}</p>
                    <p className="text-xs text-muted-foreground mt-2">Property: {message.property}</p>
                  </div>
                </div>
              ))}
              
              <div className="text-center pt-4">
                <Link to={`${window.location.pathname.includes('/demo') ? '/demo' : ''}/client-portal/messages`}>
                  <Button variant="outline" size="sm">
                    View All Messages
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="mt-6 shadow-md border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-4 border border-border rounded-lg">
                <div className="mt-1">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-foreground">{activity.property}</span>
                    <span className="text-xs text-muted-foreground">{activity.date}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{activity.description}</p>
                </div>
              </div>
            ))}
            
            <div className="text-center pt-4">
              <Link to={`${window.location.pathname.includes('/demo') ? '/demo' : ''}/client-portal/reports`}>
                <Button variant="outline" size="sm">
                  View All Reports
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ClientDashboard;