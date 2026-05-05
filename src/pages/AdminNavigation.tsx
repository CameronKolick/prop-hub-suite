import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  Settings, 
  Users, 
  Home, 
  FileText, 
  MessageSquare, 
  BarChart3, 
  Wrench,
  CheckSquare,
  UserCog,
  Building,
  Bug,
  Crown
} from "lucide-react";
import { DevAdminToggle } from "@/components/dev/DevAdminToggle";
import { DebugPanel } from "@/components/dev/DebugPanel";
import { RoleDebugger } from "@/components/dev/RoleDebugger";

const AdminNavigation = () => {
  const navigationSections = [
    {
      title: "Development Tools",
      description: "Development and debugging tools",
      pages: [
        { title: "Dev Tools", url: "/dev-tools", icon: Wrench, description: "Development utilities and debugging" },
      ]
    },
    {
      title: "Property Management",
      description: "Advanced property management features",
      pages: [
        { title: "Property Check", url: "/property-check", icon: CheckSquare, description: "Property inspection interface" },
      ]
    },
    {
      title: "User Management",
      description: "User and role management pages",
      pages: [
        { title: "User Management", url: "/user-management", icon: UserCog, description: "Manage users and roles" },
        { title: "Property Owners", url: "/property-owners", icon: Users, description: "Manage property owners" },
      ]
    },
    {
      title: "Development Tools",
      description: "Development and debugging tools (development only)",
      pages: []
    }
  ];

  return (
    <div className="max-w-[min(1200px,100%)] mx-auto px-4 py-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Admin Navigation</h1>
        <p className="text-muted-foreground">
          Access all administrative pages and tools. These pages are not included in the main navigation 
          but are available for administrative purposes.
        </p>
      </div>

      <div className="grid gap-6">
        {navigationSections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.pages.map((page) => (
                  <Link key={page.url} to={page.url}>
                    <Button
                      variant="outline"
                      className="h-auto p-4 flex flex-col items-start space-y-2 w-full hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <page.icon className="h-4 w-4" />
                        <span className="font-medium">{page.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground text-left leading-relaxed">
                        {page.description}
                      </p>
                    </Button>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Development Tools Section - Only show in development */}
      {import.meta.env.DEV && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
              <Bug className="h-5 w-5" />
              Development Tools
            </CardTitle>
            <CardDescription className="text-blue-700 dark:text-blue-300">
              Debug utilities and admin tools for development
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-blue-800 dark:text-blue-200 flex items-center gap-2">
                  <Crown className="h-4 w-4" />
                  Admin Development Mode
                </h4>
                <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                  Temporarily grant admin privileges without changing database
                </p>
                <DevAdminToggle />
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-blue-800 dark:text-blue-200 flex items-center gap-2">
                  <Bug className="h-4 w-4" />
                  Debug Panel
                </h4>
                <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                  Debug user information, roles, and permissions
                </p>
                <DebugPanel />
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-blue-800 dark:text-blue-200 flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Role Debugger
                </h4>
                <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                  Advanced role debugging and troubleshooting
                </p>
                <RoleDebugger />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
        <CardHeader>
          <CardTitle className="text-amber-800 dark:text-amber-200">Important Notes</CardTitle>
        </CardHeader>
        <CardContent className="text-amber-700 dark:text-amber-300 text-sm space-y-2">
          <p>• This page is only accessible to administrators</p>
          <p>• Some pages may require specific roles or permissions</p>
          <p>• Dev tools are only available in development mode</p>
          <p>• Property check pages may require property-specific URLs</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminNavigation;