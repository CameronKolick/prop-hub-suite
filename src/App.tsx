import { useState, lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { PropertyAssistant } from "@/components/ai/PropertyAssistant";

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { RoleBasedAccess, ROLE_COMBINATIONS } from "@/components/RoleBasedAccess";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PageTransition } from "@/components/PageTransition";
import { AuthProvider } from "@/contexts/AuthContext";
import { DevAdminProvider } from "@/contexts/DevAdminContext";
import { ViewAsProvider } from "@/contexts/ViewAsContext";
import { ViewAsBanner } from "@/components/ViewAsBanner";
import { RoleSwitcherBanner } from "@/components/RoleSwitcherBanner";
import { AppHeader } from "@/components/layout/AppHeader";
import { MobileTabBar } from "@/components/navigation/MobileTabBar";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { KeyboardShortcutsHelp } from "@/components/KeyboardShortcutsHelp";

import { useMobileDetection } from "@/hooks/useMobileDetection";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import { RoleBasedRedirect } from "@/components/RoleBasedRedirect";

import { logger } from "@/lib/logger";
import { RouteLoadingFallback } from "@/components/RouteLoadingFallback";
import { PreloadCriticalResources } from "@/components/PreloadCriticalResources";

// Lazy load ALL page components for optimal code splitting
const Index = lazy(() => import("./pages/Index"));
const PropertyOwnerHub = lazy(() => import("./pages/dashboards/PropertyOwnerHub"));
const HouseWatcherHub = lazy(() => import("./pages/dashboards/HouseWatcherHub"));
const PropertyManagerHub = lazy(() => import("./pages/dashboards/PropertyManagerHub"));
const TenantHub = lazy(() => import("./pages/dashboards/TenantHub"));
const Properties = lazy(() => import("./pages/Properties"));
const PropertyDetail = lazy(() => import("./pages/PropertyDetail"));
const Tenants = lazy(() => import("./pages/Tenants"));
const Finances = lazy(() => import("./pages/Finances"));
const LeasingPage = lazy(() => import("./pages/Leasing"));
const Maintenance = lazy(() => import("./pages/Maintenance"));
const Messages = lazy(() => import("./pages/Messages"));
const Services = lazy(() => import("./pages/Services"));
const ServiceManagement = lazy(() => import("./pages/ServiceManagement"));
const HouseWatching = lazy(() => import("./pages/HouseWatching"));
const HouseWatcherDetail = lazy(() => import("./pages/HouseWatcherDetail"));
const HouseWatcherHome = lazy(() => import("./pages/HouseWatcherHome"));
const HouseWatcherProperties = lazy(() => import("./pages/HouseWatcherProperties"));
const HouseWatcherSettings = lazy(() => import("./pages/HouseWatcherSettings"));
const PropertyManagerHome = lazy(() => import("./pages/PropertyManagerHome"));
const PropertyManagerProperties = lazy(() => import("./pages/PropertyManagerProperties"));
const PropertyManagerSettings = lazy(() => import("./pages/PropertyManagerSettings"));
const PropertyCheck = lazy(() => import("./pages/PropertyCheck"));
const HomeCheck = lazy(() => import("./pages/HomeCheck"));
const HouseWatcherMobileDashboard = lazy(() => import("./pages/dashboards/HouseWatcherMobileDashboard"));
const PropertyManagerMobileDashboard = lazy(() => import("./pages/dashboards/PropertyManagerMobileDashboard"));
const HouseWatcherMobileChecks = lazy(() => import("./pages/HouseWatcherMobileChecks"));
const PropertyManagerMobileMaintenance = lazy(() => import("./pages/PropertyManagerMobileMaintenance"));

const Documents = lazy(() => import("./pages/Documents"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const DevTools = lazy(() => import("./pages/DevTools"));
const Payments = lazy(() => import("./pages/Payments"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentCancelled = lazy(() => import("./pages/PaymentCancelled"));
const VendorPortalPage = lazy(() => import("./pages/VendorPortal"));
const Settings = lazy(() => import("./pages/Settings"));
const ClientDashboard = lazy(() => import("./pages/ClientPortal/Dashboard"));
const ClientProperties = lazy(() => import("./pages/ClientPortal/Properties"));
const ClientReports = lazy(() => import("./pages/ClientPortal/Reports"));
const ClientRequests = lazy(() => import("./pages/ClientPortal/Requests"));
const ClientMessages = lazy(() => import("./pages/ClientPortal/Messages"));
const Auth = lazy(() => import("./pages/Auth"));
const Setup = lazy(() => import("./pages/Setup"));
const WorkflowsDemo = lazy(() => import("./pages/WorkflowsDemo"));
const PropertyOwners = lazy(() => import("./pages/PropertyOwners"));
const PropertyOwnerDetail = lazy(() => import("./pages/PropertyOwnerDetail"));
const AdminNavigation = lazy(() => import("./pages/AdminNavigation"));
const Activity = lazy(() => import("./pages/Activity"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PropertyManagerView = lazy(() => import("./pages/PropertyManagerView"));
const CheckTemplates = lazy(() => import("./pages/admin/CheckTemplates"));
const AdminOverviewPage = lazy(() => import("./pages/admin/AdminOverview"));
const MaintenanceHub = lazy(() => import("./pages/admin/MaintenanceHub"));
const TenantsHub = lazy(() => import("./pages/admin/TenantsHub"));
const AuditLogsPage = lazy(() => import("./pages/admin/AuditLogs"));
const ProfileSetup = lazy(() => import("./components/ProfileSetup").then(m => ({ default: m.ProfileSetup })));



const AppContent = () => {
  const { isMobile } = useMobileDetection();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    // Get persisted state from localStorage on initial load
    const persistedState = localStorage.getItem('sidebar-state');
    if (persistedState !== null) {
      return JSON.parse(persistedState);
    }
    return !isMobile;
  });

  const handleSidebarOpenChange = (open: boolean) => {
    setSidebarOpen(open);
    localStorage.setItem('sidebar-state', JSON.stringify(open));
  };

  logger.info("App initialized");

  return (
    <GlobalErrorBoundary>
      <ErrorBoundary>
        <PreloadCriticalResources />
        <AuthProvider>
          <DevAdminProvider>
            <ViewAsProvider>
            
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <OfflineIndicator />
                <ViewAsBanner />
                <RoleSwitcherBanner />
          <Routes>
            {/* Public Auth Route - Always accessible */}
            <Route path="/auth" element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <Auth />
              </Suspense>
            } />
            
            {/* Setup Route - Always accessible for first admin setup */}
            <Route path="/setup" element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <Setup />
              </Suspense>
            } />

            {/* Workflows Demo - dev-only route outside the auth gate, uses the
                mock data + auth clients so it works without a real login. */}
            <Route path="/workflows-demo" element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <WorkflowsDemo />
              </Suspense>
            } />
            
            
            {/* Protected Routes */}
            <Route path="/*" element={
              <ProtectedRoute>
                <SidebarProvider 
                  open={sidebarOpen}
                  onOpenChange={handleSidebarOpenChange}
                  style={{
                    "--sidebar-width": isMobile ? "100vw" : "18rem",
                    "--sidebar-width-icon": "3rem",
                  } as React.CSSProperties}
                >
                  <div className="min-h-screen flex w-full">
                    <AppSidebar />
                    <main className="flex-1 flex flex-col min-w-0 pb-28 lg:pb-0 overflow-x-hidden">
                      <AppHeader />
                      <ErrorBoundary>
                         <Suspense fallback={<RouteLoadingFallback />}>
                        <Routes>
                        {/* Home route - redirects to role-specific dashboard */}
                        <Route path="/" element={<PageTransition><RoleBasedRedirect /></PageTransition>} />
                        
                        {/* Legacy home page (kept for backwards compatibility) */}
                        <Route path="/home" element={<PageTransition><Index /></PageTransition>} />
                        
                        {/* Property Owner Dashboard */}
                        <Route path="/owner-dashboard" element={
                          <PageTransition>
                            <RoleBasedAccess allowedRoles={['owner_investor']}>
                              <PropertyOwnerHub />
                            </RoleBasedAccess>
                          </PageTransition>
                        } />
                        <Route path="/house-watcher-dashboard" element={
                          <PageTransition>
                            <RoleBasedAccess allowedRoles={['house_watcher']}>
                              <HouseWatcherHub />
                            </RoleBasedAccess>
                          </PageTransition>
                        } />
                        <Route path="/property-manager-dashboard" element={
                          <PageTransition>
                            <RoleBasedAccess allowedRoles={['property_manager']}>
                              <PropertyManagerHub />
                            </RoleBasedAccess>
                          </PageTransition>
                        } />
                        <Route path="/tenant-dashboard" element={
                          <PageTransition>
                            <RoleBasedAccess allowedRoles={['tenant']}>
                              <TenantHub />
                            </RoleBasedAccess>
                          </PageTransition>
                        } />
                        
                        {/* Admin Dashboard Routes */}
                        <Route path="/admin/overview" element={
                          <PageTransition>
                            <RoleBasedAccess allowedRoles={ROLE_COMBINATIONS.ADMIN_ONLY}>
                              <AdminOverviewPage />
                            </RoleBasedAccess>
                          </PageTransition>
                        } />
                        <Route path="/admin/maintenance" element={
                          <PageTransition>
                            <RoleBasedAccess allowedRoles={ROLE_COMBINATIONS.ADMIN_ONLY}>
                              <MaintenanceHub />
                            </RoleBasedAccess>
                          </PageTransition>
                        } />
                        <Route path="/admin/tenants" element={
                          <PageTransition>
                            <RoleBasedAccess allowedRoles={ROLE_COMBINATIONS.ADMIN_ONLY}>
                              <TenantsHub />
                            </RoleBasedAccess>
                          </PageTransition>
                        } />
                        <Route path="/admin/audit-logs" element={
                          <PageTransition>
                            <RoleBasedAccess allowedRoles={ROLE_COMBINATIONS.ADMIN_ONLY}>
                              <AuditLogsPage />
                            </RoleBasedAccess>
                          </PageTransition>
                        } />
                        <Route path="/properties" element={
                          <PageTransition>
                            <RoleBasedAccess allowedRoles={ROLE_COMBINATIONS.PROPERTY_MANAGEMENT}>
                              <Properties />
                            </RoleBasedAccess>
                          </PageTransition>
                        } />
                        <Route path="/properties/:id" element={
                          <PageTransition>
                            <RoleBasedAccess allowedRoles={[...ROLE_COMBINATIONS.PROPERTY_MANAGEMENT, ...ROLE_COMBINATIONS.HOUSE_WATCHING]}>
                              <PropertyDetail />
                            </RoleBasedAccess>
                          </PageTransition>
                        } />
                        <Route path="/property-owners" element={
                          <PageTransition>
                            <RoleBasedAccess allowedRoles={ROLE_COMBINATIONS.ADMIN_ONLY}>
                              <PropertyOwners />
                            </RoleBasedAccess>
                          </PageTransition>
                        } />
                        <Route path="/tenants" element={
                          <PageTransition>
                            <RoleBasedAccess allowedRoles={ROLE_COMBINATIONS.PROPERTY_MANAGEMENT}>
                              <Tenants />
                            </RoleBasedAccess>
                          </PageTransition>
                        } />
                        <Route path="/admin/tenants" element={
                          <PageTransition>
                            <RoleBasedAccess allowedRoles={ROLE_COMBINATIONS.ADMIN_ONLY}>
                              <TenantsHub />
                            </RoleBasedAccess>
                          </PageTransition>
                        } />
                        <Route path="/user-management" element={
                          <PageTransition>
                            <RoleBasedAccess allowedRoles={ROLE_COMBINATIONS.ADMIN_ONLY}>
                              <UserManagement />
                            </RoleBasedAccess>
                          </PageTransition>
                        } />
                        <Route path="/finances" element={
                          <PageTransition>
                            <RoleBasedAccess allowedRoles={ROLE_COMBINATIONS.FINANCIAL_ACCESS}>
                              <Finances />
                            </RoleBasedAccess>
                          </PageTransition>
                        } />
                        <Route path="/maintenance" element={
                          <PageTransition>
                            <RoleBasedAccess allowedRoles={ROLE_COMBINATIONS.MAINTENANCE_ACCESS}>
                              <Maintenance />
                            </RoleBasedAccess>
                          </PageTransition>
                        } />
                        <Route path="/house-watching" element={
                          <PageTransition>
                            <RoleBasedAccess allowedRoles={ROLE_COMBINATIONS.HOUSE_WATCHING}>
                              <HouseWatching />
                            </RoleBasedAccess>
                          </PageTransition>
                        } />
                        <Route path="/house-watchers/:id" element={
                          <PageTransition>
                            <RoleBasedAccess allowedRoles={ROLE_COMBINATIONS.HOUSE_WATCHING}>
                              <HouseWatcherDetail />
                            </RoleBasedAccess>
                          </PageTransition>
                        } />
                        <Route path="/property-check" element={
                          <PageTransition>
                            <RoleBasedAccess allowedRoles={['admin', 'property_manager']}>
                              <PropertyCheck />
                            </RoleBasedAccess>
                          </PageTransition>
                        } />
                        <Route path="/property-manager-dashboard" element={
                          <PageTransition>
                            <RoleBasedAccess allowedRoles={ROLE_COMBINATIONS.ADMIN_ONLY}>
                              <PropertyManagerView />
                            </RoleBasedAccess>
                          </PageTransition>
                        } />
                        <Route path="/documents" element={
                          <PageTransition>
                            <RoleBasedAccess allowedRoles={ROLE_COMBINATIONS.ALL_ROLES}>
                              <Documents />
                            </RoleBasedAccess>
                          </PageTransition>
                        } />
                        <Route path="/payments" element={
                          <PageTransition>
                            <RoleBasedAccess allowedRoles={ROLE_COMBINATIONS.ALL_ROLES}>
                              <Payments />
                            </RoleBasedAccess>
                          </PageTransition>
                        } />
                        <Route path="/payment-success" element={
                          <PageTransition>
                            <PaymentSuccess />
                          </PageTransition>
                        } />
                        <Route path="/payment-cancelled" element={
                          <PageTransition>
                            <PaymentCancelled />
                          </PageTransition>
                        } />
                        <Route path="/vendor-portal" element={
                          <PageTransition>
                            <RoleBasedAccess allowedRoles={ROLE_COMBINATIONS.VENDOR_PORTAL}>
                              <VendorPortalPage />
                            </RoleBasedAccess>
                          </PageTransition>
                        } />
                        <Route path="/leasing" element={
                          <PageTransition>
                            <RoleBasedAccess allowedRoles={ROLE_COMBINATIONS.LEASING}>
                              <LeasingPage />
                            </RoleBasedAccess>
                          </PageTransition>
                        } />
                         <Route path="/messages" element={
                           <PageTransition>
                             <RoleBasedAccess allowedRoles={ROLE_COMBINATIONS.ALL_ROLES}>
                               <Messages />
                             </RoleBasedAccess>
                           </PageTransition>
                         } />
                          <Route path="/services" element={
                            <PageTransition>
                              <RoleBasedAccess allowedRoles={ROLE_COMBINATIONS.ALL_ROLES}>
                                <Services />
                              </RoleBasedAccess>
                            </PageTransition>
                          } />
                          <Route path="/service-management" element={
                            <PageTransition>
                              <RoleBasedAccess allowedRoles={ROLE_COMBINATIONS.ADMIN_ONLY}>
                                <ServiceManagement />
                              </RoleBasedAccess>
                            </PageTransition>
                          } />
                        <Route path="/property-check/:id" element={
                          <PageTransition>
                            <RoleBasedAccess allowedRoles={['admin', 'property_manager']}>
                              <PropertyCheck />
                            </RoleBasedAccess>
                          </PageTransition>
                        } />
<Route path="/home-check/:id" element={
  <PageTransition>
    <RoleBasedAccess allowedRoles={['admin', 'house_watcher']}>
      <HomeCheck />
    </RoleBasedAccess>
  </PageTransition>
 } />
 <Route path="/house-watcher/check/:id" element={
  <PageTransition>
    <RoleBasedAccess allowedRoles={['admin', 'house_watcher']}>
      <HomeCheck />
    </RoleBasedAccess>
  </PageTransition>
} />
                         <Route path="/house-watcher-home" element={
                           <PageTransition>
                             <RoleBasedAccess allowedRoles={['admin', 'house_watcher']}>
                               <HouseWatcherHome />
                             </RoleBasedAccess>
                           </PageTransition>
                         } />
                         <Route path="/house-watcher-properties" element={
                           <PageTransition>
                             <RoleBasedAccess allowedRoles={['admin', 'house_watcher']}>
                               <HouseWatcherProperties />
                             </RoleBasedAccess>
                            </PageTransition>
                          } />
                           <Route path="/house-watcher-settings" element={
                             <PageTransition>
                               <RoleBasedAccess allowedRoles={['admin', 'house_watcher']}>
                                 <HouseWatcherSettings />
                               </RoleBasedAccess>
                             </PageTransition>
                           } />
                           <Route path="/house-watcher/dashboard" element={
                             <PageTransition>
                               <RoleBasedAccess allowedRoles={['admin', 'house_watcher']}>
                                 <HouseWatcherMobileDashboard />
                               </RoleBasedAccess>
                             </PageTransition>
                            } />
                            <Route path="/house-watcher/new-check" element={
                              <PageTransition>
                                <RoleBasedAccess allowedRoles={['admin', 'house_watcher']}>
                                  <HouseWatcherMobileChecks />
                                </RoleBasedAccess>
                              </PageTransition>
                            } />
                            <Route path="/house-watcher/property/:propertyId" element={
                              <PageTransition>
                                <RoleBasedAccess allowedRoles={['admin', 'house_watcher']}>
                                  <PropertyDetail />
                                </RoleBasedAccess>
                              </PageTransition>
                            } />
                            <Route path="/house-watcher/checks" element={
                             <PageTransition>
                               <RoleBasedAccess allowedRoles={['admin', 'house_watcher']}>
                                 <HouseWatcherMobileChecks />
                               </RoleBasedAccess>
                             </PageTransition>
                           } />
                          <Route path="/property-manager-home" element={
                            <PageTransition>
                              <RoleBasedAccess allowedRoles={['admin', 'property_manager']}>
                                <PropertyManagerHome />
                              </RoleBasedAccess>
                            </PageTransition>
                          } />
                          <Route path="/property-manager-properties" element={
                            <PageTransition>
                              <RoleBasedAccess allowedRoles={['admin', 'property_manager']}>
                                <PropertyManagerProperties />
                              </RoleBasedAccess>
                            </PageTransition>
                          } />
                           <Route path="/property-manager-settings" element={
                             <PageTransition>
                               <RoleBasedAccess allowedRoles={['admin', 'property_manager']}>
                                 <PropertyManagerSettings />
                               </RoleBasedAccess>
                             </PageTransition>
                           } />
                           <Route path="/property-manager/dashboard" element={
                             <PageTransition>
                               <RoleBasedAccess allowedRoles={['admin', 'property_manager']}>
                                 <PropertyManagerMobileDashboard />
                               </RoleBasedAccess>
                             </PageTransition>
                           } />
                           <Route path="/property-manager/maintenance" element={
                             <PageTransition>
                               <RoleBasedAccess allowedRoles={['admin', 'property_manager']}>
                                 <PropertyManagerMobileMaintenance />
                               </RoleBasedAccess>
                             </PageTransition>
                           } />
                         <Route path="/property-owners/:ownerId" element={
                           <PageTransition>
                             <RoleBasedAccess allowedRoles={ROLE_COMBINATIONS.ADMIN_ONLY}>
                               <PropertyOwnerDetail />
                             </RoleBasedAccess>
                           </PageTransition>
                         } />
                         <Route path="/activity" element={
                           <PageTransition>
                             <RoleBasedAccess allowedRoles={ROLE_COMBINATIONS.ADMIN_ONLY}>
                               <Activity />
                             </RoleBasedAccess>
                           </PageTransition>
                         } />
                         <Route path="/settings" element={<PageTransition><Settings /></PageTransition>} />
                         <Route path="/profile" element={<PageTransition><ProfileSetup /></PageTransition>} />
                         <Route path="/admin-navigation" element={
                           <PageTransition>
                             <RoleBasedAccess allowedRoles={ROLE_COMBINATIONS.ADMIN_ONLY}>
                               <AdminNavigation />
                             </RoleBasedAccess>
                            </PageTransition>
                          } />
                          <Route path="/admin/check-templates" element={
                            <PageTransition>
                              <RoleBasedAccess allowedRoles={ROLE_COMBINATIONS.ADMIN_ONLY}>
                                <CheckTemplates />
                              </RoleBasedAccess>
                            </PageTransition>
                          } />
                        <Route path="/client-portal" element={<PageTransition><ClientDashboard /></PageTransition>} />
                        <Route path="/client-portal/properties" element={<PageTransition><ClientProperties /></PageTransition>} />
                        <Route path="/client-portal/reports" element={<PageTransition><ClientReports /></PageTransition>} />
                        <Route path="/client-portal/reports/:reportId" element={<PageTransition><ClientReports /></PageTransition>} />
                        <Route path="/client-portal/requests" element={<PageTransition><ClientRequests /></PageTransition>} />
                        <Route path="/client-portal/messages" element={<PageTransition><ClientMessages /></PageTransition>} />
                        {import.meta.env.DEV && (
                          <Route path="/dev-tools" element={<PageTransition><DevTools /></PageTransition>} />
                        )}
                        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
                        </Routes>
                        </Suspense>
                      </ErrorBoundary>
                      <MobileTabBar />
                      <KeyboardShortcutsHelp />
                    </main>
                  </div>
                  
                </SidebarProvider>
              </ProtectedRoute>
            } />
          </Routes>
          <PropertyAssistant />
        </BrowserRouter>
      </TooltipProvider>
    
      </ViewAsProvider>
    </DevAdminProvider>
  </AuthProvider>
      </ErrorBoundary>
    </GlobalErrorBoundary>
  );
};

const App = () => <AppContent />;

export default App;
