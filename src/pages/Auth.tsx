import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Mail, Lock, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

import { ForgotPasswordDialog } from '@/components/auth/ForgotPasswordDialog';
import { FormFieldError } from '@/components/FormFieldError';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [rememberMe, setRememberMe] = useState(false);
  
  const [searchParams] = useSearchParams();

  // Check if user is already logged in
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        console.log('🔍 Auth page: Checking if user is already logged in...');
        
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log('🔍 Auth page: Session check result:', {
          session: !!session,
          error: error
        });
        
        if (session && !error) {
          console.log('✅ Auth page: User already logged in, redirecting to dashboard');
          
          // Force page refresh to ensure clean state
          window.location.href = '/';
          return;
        }
        
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkExistingSession();
  }, [searchParams]);

  // Validation helper
  const validateField = (field: string, value: string) => {
    const errors: Record<string, string> = {};
    
    switch (field) {
      case 'email':
        if (!value.trim()) {
          errors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(value)) {
          errors.email = 'Please enter a valid email address';
        }
        break;
      case 'password':
        if (!value) {
          errors.password = 'Password is required';
        }
        break;
    }
    
    setFieldErrors(prev => ({ ...prev, ...errors }));
    return Object.keys(errors).length === 0;
  };

  // Clear field error when user types
  const handleFieldChange = (field: string, value: string) => {
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: '' }));
    }
    
    switch (field) {
      case 'email':
        setEmail(value);
        break;
      case 'password':
        setPassword(value);
        break;
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setFieldErrors({});
    
    // Validate form
    const emailValid = validateField('email', email);
    const passwordValid = validateField('password', password);
    
    if (!emailValid || !passwordValid) {
      setLoading(false);
      return;
    }
    
    try {
      console.log('🔐 Auth: Starting sign in process...');
      
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      clearTimeout(timeoutId);
      
      if (error) {
        console.error('❌ Sign in error:', error);
        throw error;
      }
      
      if (data.user) {
        console.log('✅ Auth: Sign in successful');
        
        // Store remember me preference
        if (rememberMe) {
          localStorage.setItem('auth_remember_me', 'true');
        } else {
          localStorage.removeItem('auth_remember_me');
        }
        
        toast({
          title: "Welcome back!",
          description: "You have been signed in successfully.",
        });
        
        // Wait a moment for auth state to propagate, then redirect
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
      }
      
    } catch (error: any) {
      console.error('💥 Sign in failed:', error);
      
      let errorMessage = 'An unexpected error occurred';
      
      if (error.name === 'AbortError') {
        errorMessage = 'Login timed out. Please check your connection and try again.';
      } else if (error.message?.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (error.message?.includes('Email not confirmed')) {
        errorMessage = 'Please check your email and click the confirmation link before signing in.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      toast({
        title: "Sign In Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Checking authentication...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4 sm:p-6">
      <Card className="w-full max-w-md shadow-xl">
        {/* Logo Section */}
        <div className="pt-8 pb-6 px-6 sm:px-8">
          <div className="flex justify-center">
            <img 
              src="/brand/d57228a9-3aea-44c1-9331-d5c7640e4b3e.png"
              alt="Latitude Premier Properties" 
              className="h-24 sm:h-28 w-auto object-contain"
            />
          </div>
        </div>
        
        {/* Header Section */}
        <CardHeader className="text-center pt-0 pb-6 px-6 sm:px-8">
          <CardTitle className="text-2xl sm:text-3xl font-bold mb-2">Welcome</CardTitle>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
            Please sign in to your account
          </p>
        </CardHeader>
        {/* Form Section */}
        <CardContent className="px-6 pb-8 sm:px-8">
          <form onSubmit={handleSignIn} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => handleFieldChange('email', e.target.value)}
                  className="pl-12"
                  required
                />
              </div>
              <FormFieldError error={fieldErrors.email} />
            </div>
            
            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => handleFieldChange('password', e.target.value)}
                  className="pl-12 pr-12"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Eye className="h-5 w-5 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <FormFieldError error={fieldErrors.password} />
            </div>

            {/* Remember Me and Forgot Password */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remember-me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-2 border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
                <Label htmlFor="remember-me" className="text-sm font-medium cursor-pointer">
                  Remember me
                </Label>
              </div>
              <Button
                type="button"
                variant="link"
                className="p-0 h-auto text-sm font-medium"
                onClick={() => setForgotPasswordOpen(true)}
              >
                Forgot password?
              </Button>
            </div>
            
            {/* Error Display */}
            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm leading-relaxed">{error}</AlertDescription>
              </Alert>
            )}
            
            {/* Sign In Button */}
            <Button
              type="submit"
              className="w-full mt-6"
              size="lg"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  Sign In
                </>
              )}
            </Button>
          </form>
          
          {/* Footer Message */}
          <div className="text-center pt-6 mt-6 border-t border-border">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Need access? Contact your administrator to create an account.
            </p>
          </div>
        </CardContent>
      </Card>

      <ForgotPasswordDialog
        open={forgotPasswordOpen}
        onOpenChange={setForgotPasswordOpen}
      />
    </div>
  );
};

export default Auth;