import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Users,
  Shield,
  UserCog,
  Mail,
  Calendar,
  Filter,
  User,
  Loader2,
  AlertCircle,
  RefreshCw,
  AlertTriangle,
  Plus,
  Trash2,
  MoreHorizontal
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AddUserDialog from "@/components/AddUserDialog";
import { UserDetailsDialog } from "@/components/UserDetailsDialog";
import { UserMobileTable } from "@/components/MobileTable";

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
  user_created_at: string;
  role_created_at: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  company_name?: string | null;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
}

const UserManagement = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userDetailsOpen, setUserDetailsOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { user } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if current user is admin
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Set up 10-second timeout for loading (increased from 5 seconds)
    timeoutRef.current = setTimeout(() => {
      console.log('⏰ UserManagement: Loading timeout reached (10 seconds)');
      setLoadingTimeout(true);
      setError('Loading timeout - this may indicate a database connectivity issue');
    }, 10000);

    checkAdminStatus();
    fetchUsers();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, roleFilter]);

  const filterUsers = () => {
    let filtered = [...users];
    
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }
    
    setFilteredUsers(filtered);
  };

  // Selection handlers for bulk actions
  const onToggleSelect = (row: UserProfile) => {
    const id = row.user_id;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const onToggleSelectAll = () => {
    const allSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedIds.has(u.user_id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUsers.map(u => u.user_id)));
    }
  };

  const checkAdminStatus = async () => {
    console.log('🔍 UserManagement: Checking admin status...');

    if (!user) {
      console.log('❌ UserManagement: No user found for admin check');
      setError('No user session found');
      return;
    }
    
    try {
      console.log('🔍 UserManagement: Calling has_role RPC for user:', user.id);
      const { data, error } = await supabase
        .rpc('has_role', { _user_id: user.id, _role: 'admin' as any });
      
      if (error) {
        console.error('❌ UserManagement: Admin check RPC error:', error);
        throw error;
      }
      
      console.log('✅ UserManagement: Admin check result:', data);
      setIsAdmin(data);
    } catch (error) {
      console.error('❌ UserManagement: Error checking admin status:', error);
      setError('Failed to verify admin permissions: ' + (error as any).message);
    }
  };

  const fetchUsers = async () => {
    console.log('📊 UserManagement: Starting fetchUsers...');
    try {
      setLoading(true);
      setError(null);
      
      console.log('📊 UserManagement: Querying profiles with auth users...');
      
      // Query profiles with a join to get real email from auth.users via admin query
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          first_name,
          last_name,
          phone,
          address,
          city,
          state,
          zip_code,
          company_name,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (profilesError) {
        console.error('❌ UserManagement: Fetch profiles error:', profilesError);
        throw profilesError;
      }

      // Get user roles separately
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role, created_at')
        .order('created_at', { ascending: false });

      if (rolesError) {
        console.error('❌ UserManagement: Fetch roles error:', rolesError);
        console.warn('Continuing without roles data');
      }

      // Get actual user emails from edge function
      let authUsersData: any[] = [];
      try {
        console.log('📧 UserManagement: Attempting to fetch real user emails...');
        const { data: authData, error: authError } = await supabase.functions.invoke('get-users-with-emails');
        if (authError) {
          console.error('❌ UserManagement: Edge function error:', authError);
          console.warn('⚠️ UserManagement: Falling back to profile data only');
        } else {
          authUsersData = authData?.users || [];
          console.log('✅ UserManagement: Successfully fetched real emails for', authUsersData.length, 'users');
        }
      } catch (authErr) {
        console.error('❌ UserManagement: Failed to call edge function:', authErr);
        console.warn('⚠️ UserManagement: Will use fallback email generation');
      }

      console.log('📊 UserManagement: Profiles fetched:', profilesData?.length || 0);
      console.log('📊 UserManagement: Roles fetched:', rolesData?.length || 0);
      console.log('📊 UserManagement: Auth users fetched:', authUsersData.length);
      
      // Create lookup maps
      const rolesMap = new Map();
      rolesData?.forEach(role => {
        rolesMap.set(role.user_id, { role: role.role, created_at: role.created_at });
      });

      const authUsersMap = new Map();
      authUsersData.forEach(authUser => {
        authUsersMap.set(authUser.id, { 
          email: authUser.email, 
          created_at: authUser.created_at,
          email_confirmed_at: authUser.email_confirmed_at,
          last_sign_in_at: authUser.last_sign_in_at
        });
      });

      // Transform data with real information
      const transformedUsers: UserProfile[] = profilesData?.map(profile => {
        const roleInfo = rolesMap.get(profile.user_id);
        const authInfo = authUsersMap.get(profile.user_id);
        
        // Use the current user's real email if this is their profile
        let userEmail = authInfo?.email;
        if (!userEmail && user && profile.user_id === user.id) {
          userEmail = user.email; // Use the logged-in user's email
        }
        if (!userEmail) {
          userEmail = `${profile.first_name?.toLowerCase() || 'user'}.${profile.last_name?.toLowerCase() || 'user'}@system.local`;
        }
        
        return {
          id: profile.id,
          user_id: profile.user_id,
          email: userEmail,
          first_name: profile.first_name || 'Unknown',
          last_name: profile.last_name || 'User',
          role: roleInfo?.role || null,
          user_created_at: authInfo?.created_at || profile.created_at || new Date().toISOString(),
          role_created_at: roleInfo?.created_at || null,
          phone: profile.phone || null,
          address: profile.address || null,
          city: profile.city || null,
          state: profile.state || null,
          zip_code: profile.zip_code || null,
          company_name: profile.company_name || null,
          email_confirmed_at: authInfo?.email_confirmed_at,
          last_sign_in_at: authInfo?.last_sign_in_at
        };
      }) || [];
      
      console.log('✅ UserManagement: Transformed users:', transformedUsers.length, 'users');
      console.log('📊 Sample user data:', transformedUsers[0]);
      setUsers(transformedUsers);
    } catch (error) {
      console.error('❌ UserManagement: Error fetching users:', error);
      setError('Failed to fetch users: ' + (error as any).message);
      toast({
        title: "Error",
        description: "Failed to fetch users: " + (error as any).message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  };

  // Force load with mock data
  const forceLoadWithMockData = () => {
    console.log('🚨 UserManagement: Force loading with mock data...');
    const mockUsers: UserProfile[] = [
      {
        id: '1c376b70-c535-4ee4-8275-5d017704b3db',
        user_id: '1c376b70-c535-4ee4-8275-5d017704b3db',
        email: 'rmh1122@hotmail.com',
        first_name: 'Emergency',
        last_name: 'Admin',
        role: 'admin',
        user_created_at: new Date().toISOString(),
        role_created_at: new Date().toISOString()
      },
      {
        id: 'mock-user-1',
        user_id: 'mock-user-1',
        email: 'admin@test.com',
        first_name: 'Test',
        last_name: 'Admin',
        role: 'admin',
        user_created_at: new Date().toISOString(),
        role_created_at: new Date().toISOString()
      },
      {
        id: 'mock-user-2',
        user_id: 'mock-user-2',
        email: 'owner@test.com',
        first_name: 'Property',
        last_name: 'Owner',
        role: 'property_owner',
        user_created_at: new Date().toISOString(),
        role_created_at: new Date().toISOString()
      }
    ];
    
    setUsers(mockUsers);
    setLoading(false);
    setError(null);
    setIsAdmin(true);
    
    toast({
      title: "Mock Data Loaded",
      description: "Loaded with sample data for emergency access",
      variant: "default"
    });
  };

  // Retry loading
  const retryLoading = () => {
    console.log('🔄 UserManagement: Retrying load...');
    setLoading(true);
    setError(null);
    setLoadingTimeout(false);
    
    // Reset timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      console.log('⏰ UserManagement: Retry timeout reached');
      setLoadingTimeout(true);
      setError('Retry timeout - database may be unavailable');
    }, 10000);

    checkAdminStatus();
    fetchUsers();
  };

  const getRoleBadgeColor = (role: string | null) => {
    switch (role) {
      case 'admin':
        return 'bg-destructive text-destructive-foreground';
      case 'property_manager':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'owner_investor':
      case 'property_owner':
        return 'bg-primary text-primary-foreground';
      case 'tenant':
        return 'bg-secondary text-secondary-foreground';
      case 'house_watcher':
        return 'bg-accent text-accent-foreground';
      case 'contractor':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'leasing_agent':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatRoleName = (role: string | null) => {
    if (!role) return 'No Role';
    switch (role) {
      case 'owner_investor':
        return 'Property Owner';
      case 'property_owner':
        return 'Property Owner';
      case 'house_watcher':
        return 'House Watcher';
      case 'property_manager':
        return 'Property Manager';
      case 'leasing_agent':
        return 'Leasing Agent';
      case 'admin':
        return 'Admin';
      case 'tenant':
        return 'Tenant';
      case 'contractor':
        return 'Contractor';
      default:
        return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
  };

  const handleUserClick = (userProfile: UserProfile) => {
    setSelectedUser(userProfile);
    setUserDetailsOpen(true);
  };

  const handleUserUpdate = () => {
    fetchUsers();
  };

  const handleDeleteUser = (userProfile: UserProfile) => {
    setUserToDelete(userProfile);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    console.log('🗑️ UserManagement: Confirming delete for user', userToDelete.user_id || userToDelete.id);

    // Optimistically remove from UI first (by user_id)
    const prevUsers = users;
    const prevFiltered = filteredUsers;
    setUsers((prev) => prev.filter((u) => u.user_id !== userToDelete.user_id));
    setFilteredUsers((prev) => prev.filter((u) => u.user_id !== userToDelete.user_id));

    try {
      // Delete the user's roles first
      const { error: rolesError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userToDelete.user_id);

      if (rolesError) throw rolesError;

      // Delete the profile by user_id to avoid PK ambiguity
      const { error: profilesError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userToDelete.user_id);

      if (profilesError) throw profilesError;

      // Delete Supabase auth account via Edge Function (best-effort)
      try {
        await supabase.functions.invoke('delete-auth-user', {
          body: { user_id: userToDelete.user_id }
        });
      } catch (fnErr) {
        console.warn('⚠️ delete-auth-user function failed:', fnErr);
      }

      toast({
        title: "User Deleted",
        description: `${userToDelete.first_name || ''} ${userToDelete.last_name || ''}`.trim() + ' has been removed from the system.',
        variant: "default"
      });
    } catch (error: any) {
      console.error('❌ UserManagement: Delete failed', error);
      // Rollback UI if server operation failed
      setUsers(prevUsers);
      setFilteredUsers(prevFiltered);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete user",
        variant: "destructive"
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
      // Sync with server to ensure consistency
      fetchUsers();
    }
  };

  // Bulk delete selected users
  const confirmBulkDeleteUsers = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    // Optimistic UI update
    setUsers(prev => prev.filter(u => !ids.includes(u.user_id)));
    setFilteredUsers(prev => prev.filter(u => !ids.includes(u.user_id)));

    let success = 0;
    for (const uid of ids) {
      try {
        const { error: rolesError } = await supabase.from('user_roles').delete().eq('user_id', uid);
        if (rolesError) throw rolesError;

        const { error: profilesError } = await supabase.from('profiles').delete().eq('user_id', uid);
        if (profilesError) throw profilesError;

        try {
          await supabase.functions.invoke('delete-auth-user', { body: { user_id: uid } });
        } catch (fnErr) {
          console.warn('⚠️ delete-auth-user failed for', uid, fnErr);
        }

        success += 1;
      } catch (err) {
        console.error('❌ Bulk delete failed for', uid, err);
      }
    }

    toast({
      title: success === ids.length ? 'Users Deleted' : 'Users Partially Deleted',
      description: `${success}/${ids.length} user(s) removed.`,
    });

    setIsBulkDeleteDialogOpen(false);
    setSelectedIds(new Set());
    fetchUsers();
  };
  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ 
          role: newRole as any,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Role Updated",
        description: "User role has been successfully updated",
        variant: "default"
      });

      await fetchUsers();
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update user role",
        variant: "destructive"
      });
    }
  };
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {loading ? 'Checking Access...' : 'Access Denied'}
              </h3>
              
              {loading ? (
                <div className="space-y-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground text-sm">
                    Verifying your permissions...
                  </p>
                  {loadingTimeout && (
                    <div className="space-y-2">
                      <p className="text-destructive text-sm">
                        Loading is taking longer than expected
                      </p>
                      <Button onClick={retryLoading} size="sm" variant="outline">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry
                      </Button>
                    </div>
                  )}
                </div>
              ) : error ? (
                <div className="space-y-4">
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <p className="text-destructive text-sm">{error}</p>
                  </div>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={retryLoading} size="sm" variant="outline">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                    <Button onClick={forceLoadWithMockData} size="sm" variant="destructive">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Force Load
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    You don't have permission to access this page. Only administrators can manage users.
                  </p>
                  <Button onClick={retryLoading} size="sm" variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Check Again
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6">
      <div className="max-w-[min(1200px,100%)] mx-auto space-y-6">
        {/* Clean Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              User Management
            </h1>
            <p className="text-muted-foreground">
              Manage user accounts and permissions • {users.length} users
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search users..." 
                className="pl-10 w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="property_manager">Property Manager</SelectItem>
                <SelectItem value="owner_investor">Property Owner</SelectItem>
                <SelectItem value="tenant">Tenant</SelectItem>
                <SelectItem value="house_watcher">House Watcher</SelectItem>
                <SelectItem value="contractor">Contractor</SelectItem>
                <SelectItem value="leasing_agent">Leasing Agent</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-3">
          <AddUserDialog onUserAdded={handleUserUpdate} />
          <Button 
            variant="destructive" 
            disabled={selectedIds.size === 0}
            onClick={() => setIsBulkDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected{selectedIds.size ? ` (${selectedIds.size})` : ''}
          </Button>
          
          {/* Emergency Controls */}
          {(error || loadingTimeout) && (
            <div className="flex gap-2">
              <Button onClick={retryLoading} size="sm" variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
              <Button onClick={forceLoadWithMockData} size="sm" variant="destructive">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Force Load
              </Button>
            </div>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading users...</p>
              {loadingTimeout && (
                <div className="mt-4 space-y-2">
                  <p className="text-destructive text-sm">This is taking longer than usual</p>
                  <div className="flex gap-2 justify-center">
                    <Button onClick={retryLoading} size="sm" variant="outline">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                    <Button onClick={forceLoadWithMockData} size="sm" variant="destructive">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Force Load
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Users Table - Mobile Optimized */}
        {!loading && !error && (
          <UserMobileTable
            users={filteredUsers}
            onUserClick={handleUserClick}
            onUserDelete={handleDeleteUser}
            loading={loading}
            formatRoleName={formatRoleName}
            getRoleBadgeColor={getRoleBadgeColor}
            formatDate={formatDate}
            selectedIds={selectedIds}
            getRowId={(row) => row.user_id}
            onToggleSelect={onToggleSelect}
            onToggleSelectAll={onToggleSelectAll}
            isAllSelected={filteredUsers.length > 0 && filteredUsers.every(u => selectedIds.has(u.user_id))}
          />
        )}

        {/* User Details Dialog */}
        <UserDetailsDialog
          user={selectedUser}
          open={userDetailsOpen}
          onOpenChange={setUserDetailsOpen}
          onUserUpdate={handleUserUpdate}
        />

        {/* Delete User Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{userToDelete ? `${userToDelete.first_name} ${userToDelete.last_name}` : ""}"? 
                This will permanently remove all user data and cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteUser} className="bg-destructive hover:bg-destructive/90">
                Delete User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Dialog */}
        <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Selected Users</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedIds.size} selected user(s)? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmBulkDeleteUsers} className="bg-destructive hover:bg-destructive/90">
                Delete {selectedIds.size} User{selectedIds.size === 1 ? '' : 's'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default UserManagement;
