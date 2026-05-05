import { useState } from "react";
import { 
  Home, 
  Building, 
  Users, 
  UserCheck,
  UserCog,
  FileText, 
  DollarSign, 
  Wrench, 
  MessageCircle,
  FolderOpen,
  BarChart3,
  Settings,
  Plus,
  Search,
  Eye,
  Shield,
  X,
  Activity,
  TrendingUp,
  ClipboardCheck,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useMobileDetection } from "@/hooks/useMobileDetection";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddPropertyDialog } from "@/components/AddPropertyDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { useAuth } from "@/contexts/AuthContext";

// Define menu items for different user roles with simplified grouping
const adminMenuItems = [
  // Core Operations
  {
    title: "Home",
    url: "/",
    icon: Home,
    description: "Main hub",
    group: "Core"
  },
  {
    title: "Properties",
    url: "/properties",
    icon: Building,
    description: "Manage properties",
    group: "Core"
  },
  {
    title: "Activity",
    url: "/activity",
    icon: Activity,
    description: "Recent activity",
    group: "Core"
  },

  // People & Assignments
  {
    title: "Property Owners",
    url: "/property-owners",
    icon: UserCheck,
    description: "Manage owners",
    group: "People"
  },
  {
    title: "Tenants",
    url: "/admin/tenants",
    icon: Users,
    description: "Tenant management",
    group: "People"
  },
  {
    title: "House Watchers",
    url: "/house-watching",
    icon: Eye,
    description: "House watchers",
    group: "People"
  },
  {
    title: "Property Managers",
    url: "/property-manager-dashboard",
    icon: UserCog,
    description: "Manager operations",
    group: "People"
  },

  // Operations
  {
    title: "Maintenance",
    url: "/admin/maintenance",
    icon: Wrench,
    description: "Work orders",
    group: "Operations"
  },
  {
    title: "Finances",
    url: "/finances",
    icon: DollarSign,
    description: "Financial management",
    group: "Operations"
  },
  {
    title: "Messages",
    url: "/messages",
    icon: MessageCircle,
    description: "Communications",
    group: "Operations"
  },
  {
    title: "Documents",
    url: "/documents",
    icon: FolderOpen,
    description: "File management",
    group: "Operations"
  },
  {
    title: "Reports",
    url: "/client-portal/reports",
    icon: BarChart3,
    description: "Analytics",
    group: "Operations"
  },

  // Settings
  {
    title: "Users",
    url: "/user-management",
    icon: UserCog,
    description: "User management",
    group: "Settings"
  },
  {
    title: "Templates",
    url: "/admin/check-templates",
    icon: FileText,
    description: "Check templates",
    group: "Settings"
  },
  {
    title: "Services",
    url: "/services",
    icon: Settings,
    description: "Service packages",
    group: "Settings"
  },
  {
    title: "Audit Logs",
    url: "/admin/audit-logs",
    icon: Shield,
    description: "Security audit",
    group: "Settings"
  }
] as const;

const propertyOwnerMenuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
    description: "Owner dashboard"
  },
  {
    title: "My Properties",
    url: "/properties",
    icon: Building,
    description: "Your properties"
  },
  {
    title: "My Tenants",
    url: "/tenants",
    icon: Users,
    description: "Your tenants"
  },
  {
    title: "Maintenance Requests",
    url: "/maintenance",
    icon: Wrench,
    description: "Property maintenance"
  },
  {
    title: "Financial Reports",
    url: "/finances",
    icon: DollarSign,
    description: "Income & expenses"
  },
  {
    title: "My Profile",
    url: "/settings",
    icon: Settings,
    description: "Account settings"
  }
];

const tenantMenuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
    description: "Tenant dashboard"
  },
  {
    title: "My Lease",
    url: "/leases",
    icon: FileText,
    description: "Lease agreement"
  },
  {
    title: "Pay Rent",
    url: "/finances",
    icon: DollarSign,
    description: "Payment portal"
  },
  {
    title: "Maintenance Requests",
    url: "/maintenance",
    icon: Wrench,
    description: "Submit requests"
  },
  {
    title: "Documents",
    url: "/documents",
    icon: FolderOpen,
    description: "Lease documents"
  },
  {
    title: "My Profile",
    url: "/settings",
    icon: Settings,
    description: "Account settings"
  }
];

const propertyManagerMenuItems = [
  {
    title: "Home",
    url: "/property-manager-home",
    icon: Home,
    description: "Property schedule"
  },
  {
    title: "Properties",
    url: "/property-manager-properties",
    icon: Building,
    description: "Managed properties"
  },
  {
    title: "Tenants",
    url: "/tenants",
    icon: Users,
    description: "Tenant management"
  },
  {
    title: "Maintenance",
    url: "/maintenance",
    icon: Wrench,
    description: "Work orders"
  },
  {
    title: "Messages",
    url: "/messages",
    icon: MessageCircle,
    description: "Communication"
  },
  {
    title: "Documents",
    url: "/documents",
    icon: FolderOpen,
    description: "File management"
  },
  {
    title: "Activity",
    url: "/activity",
    icon: Activity,
    description: "Activity dashboard"
  },
  {
    title: "Settings",
    url: "/property-manager-settings",
    icon: Settings,
    description: "Profile & preferences"
  }
];

const houseWatcherMenuItems = [
  {
    title: "Home",
    url: "/house-watcher-home",
    icon: Home,
    description: "Weekly schedule"
  },
  {
    title: "My Properties",
    url: "/house-watcher-properties",
    icon: Building,
    description: "Assigned properties"
  },
  {
    title: "Checks",
    url: "/house-watcher/checks",
    icon: ClipboardCheck,
    description: "Start and review checks"
  },
  {
    title: "Settings",
    url: "/house-watcher-settings",
    icon: Settings,
    description: "Profile & preferences"
  }
];

export function AppSidebar() {
  const { state, setOpen } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const collapsed = state === "collapsed";
  const { isMobile } = useMobileDetection();
  const { activeRole, isRoleSwitched } = useAuth();
  const { getRoleDisplayName } = useUserRole();
  
  // Use activeRole instead of userRole for all role checks
  const userRole = activeRole;

  // Get menu items based on user role
  const getMenuItems = () => {
    switch (userRole) {
      case 'admin':
        return adminMenuItems;
      case 'property_manager':
        return propertyManagerMenuItems;
      case 'owner_investor':
        return propertyOwnerMenuItems;
      case 'tenant':
        return tenantMenuItems;
      case 'house_watcher':
        return houseWatcherMenuItems;
      case 'client':
        return tenantMenuItems; // Clients see tenant view
      case 'contractor':
        return tenantMenuItems; // Contractors see tenant view
      case 'leasing_agent':
        return adminMenuItems; // Leasing agents see admin view
      default:
        return adminMenuItems; // Default fallback
    }
  };

  const menuItems = getMenuItems();

  // Check if we're in demo mode
  const isDemoMode = currentPath.startsWith('/demo');
  const basePath = isDemoMode ? '/demo' : '';

  const isActive = (path: string) => {
    const fullPath = basePath + path;
    if (path === "/" && currentPath === fullPath) return true;
    if (path !== "/" && currentPath.startsWith(fullPath)) return true;
    return false;
  };

  const filteredItems = menuItems.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <Sidebar 
        variant="inset" 
        collapsible={isMobile ? "offcanvas" : "icon"}
        className={isMobile ? "fixed inset-y-0 left-0 z-50" : ""}
        style={isMobile ? { width: 'min(320px, 85vw)' } : undefined}
      >
        <SidebarContent>
          {/* Header */}
          <div className="p-2 border-b border-sidebar-border">
            <div className="flex items-center justify-between">
              {!collapsed && (
                <div className="flex items-center justify-center w-full">
                  <img 
                    src="/brand/42342793-c892-4f13-94af-fd1566d9a29a.png"
                    alt="Latitude Premier Properties logo" 
                    className={`${isMobile ? "w-32 h-32" : "w-40 h-40"} object-contain`}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                {isMobile && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setOpen(false)}
                    className="p-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>


          {/* Quick Actions */}
          {!collapsed && !isMobile && (
            <div className="p-4 border-b border-sidebar-border">
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  className="flex-1 bg-gradient-primary hover:bg-primary-dark"
                  onClick={() => setIsAddPropertyOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Property
                </Button>
              </div>
            </div>
          )}

          {/* Navigation */}
          {(() => {
            const isGrouped = filteredItems.some((i: any) => (i as any).group || (i as any).favorite);
            if (!isGrouped) {
              return (
                <SidebarGroup>
                  <SidebarGroupLabel className="text-sidebar-foreground/60 uppercase tracking-wider text-xs font-medium">
                    {collapsed ? "Menu" : "Main Navigation"}
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {filteredItems.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild>
                            <NavLink 
                              to={basePath + item.url} 
                              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                                isActive(item.url) 
                                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" 
                                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                              }`}
                            >
                              <item.icon className="w-5 h-5 flex-shrink-0" />
                              {!collapsed && (
                                <span className="font-medium">{item.title}</span>
                              )}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              );
            }

            // Grouped rendering with cleaner organization
            const groupsOrder = ["Core", "People", "Operations", "Settings"];
            const byGroup = (group: string) => (filteredItems as any[]).filter((i: any) => i.group === group);

            return (
              <>
                {groupsOrder.map((group) => {
                  const groupItems = byGroup(group);
                  if (groupItems.length === 0) return null;
                  
                  return (
                    <SidebarGroup key={group}>
                      <SidebarGroupLabel className="text-sidebar-foreground/60 uppercase tracking-wider text-xs font-medium px-2">
                        {collapsed ? group.slice(0, 3) : group}
                      </SidebarGroupLabel>
                      <SidebarGroupContent>
                        <SidebarMenu>
                          {groupItems.map((item: any) => (
                            <SidebarMenuItem key={item.title}>
                              <SidebarMenuButton asChild>
                                {collapsed ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <NavLink
                                        to={basePath + item.url}
                                        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${
                                          isActive(item.url)
                                            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm font-medium"
                                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                        }`}
                                        aria-label={item.title}
                                      >
                                        <item.icon className="w-4 h-4 flex-shrink-0" />
                                      </NavLink>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                      <p>{item.title}</p>
                                      {item.description && (
                                        <p className="text-xs text-muted-foreground">{item.description}</p>
                                      )}
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <NavLink
                                    to={basePath + item.url}
                                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${
                                      isActive(item.url)
                                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm font-medium"
                                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                    }`}
                                  >
                                    <item.icon className="w-4 h-4 flex-shrink-0" />
                                    <span className="text-sm">{item.title}</span>
                                  </NavLink>
                                )}
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </SidebarMenu>
                      </SidebarGroupContent>
                    </SidebarGroup>
                  );
                })}
              </>
            );
          })()}


          {/* Search */}
          {!collapsed && (
            <div className="p-4 border-t border-sidebar-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-sidebar-foreground/40" />
                <Input
                  placeholder="Search menu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-sidebar-accent border-sidebar-border"
                />
              </div>
            </div>
          )}

          {/* Role Indicator */}
          {!collapsed && userRole && (
            <div className="p-4 border-t border-sidebar-border">
              <div className="flex items-center gap-2 text-xs text-sidebar-foreground/60">
                <Shield className="w-3 h-3" />
                <span>Role: {getRoleDisplayName()}</span>
              </div>
            </div>
          )}

          {/* Settings */}
          <div className="mt-auto p-4 border-t border-sidebar-border">
            <SidebarMenuButton asChild>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <NavLink 
                      to={basePath + (userRole === 'house_watcher' ? "/house-watcher-settings" : "/settings")}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive(userRole === 'house_watcher' ? "/house-watcher-settings" : "/settings") 
                          ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                          : "text-sidebar-foreground hover:bg-sidebar-accent"
                      }`}
                      aria-label="Settings"
                    >
                      <Settings className="w-5 h-5" />
                    </NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>Settings</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <NavLink 
                  to={basePath + (userRole === 'house_watcher' ? "/house-watcher-settings" : "/settings")}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive(userRole === 'house_watcher' ? "/house-watcher-settings" : "/settings") 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}
                >
                  <Settings className="w-5 h-5" />
                  <span>Settings</span>
                </NavLink>
              )}
            </SidebarMenuButton>
          </div>
          
          {/* Role Switcher for Admins */}
          <RoleSwitcher />
        </SidebarContent>
      </Sidebar>

      <AddPropertyDialog 
        open={isAddPropertyOpen} 
        onOpenChange={setIsAddPropertyOpen}
        onPropertyAdded={() => {
          // Could refresh property data here if needed
        }}
      />
    </>
  );
}