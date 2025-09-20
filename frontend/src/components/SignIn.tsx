import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';

const SignIn: React.FC = () => {
  const { signIn, signUp, signInWithOAuth, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    if (isSignUp && password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setError('');

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, name);
        if (error) {
          setError(error.message || 'Failed to create account');
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error.message || 'Invalid email or password');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'github') => {
    setError('');
    try {
      console.log(`🔐 Attempting OAuth sign-in with ${provider}...`);
      const { error } = await signInWithOAuth(provider);
      
      if (error) {
        console.error(`❌ OAuth ${provider} error:`, error);
        
        if (error.message?.includes('OAuth provider not configured')) {
          setError(`${provider.charAt(0).toUpperCase() + provider.slice(1)} OAuth is not configured in your Supabase project. Please configure it in Authentication > Providers.`);
        } else if (error.message?.includes('redirect_uri')) {
          setError(`OAuth redirect URI issue. Please check your Supabase OAuth configuration.`);
        } else {
          setError(`Failed to sign in with ${provider}: ${error.message}`);
        }
      } else {
        console.log(`✅ OAuth ${provider} initiated successfully - redirecting...`);
      }
    } catch (err: any) {
      console.error(`❌ OAuth ${provider} unexpected error:`, err);
      setError(`Unexpected error during ${provider} sign-in: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="glass-background min-h-screen flex items-center justify-center p-4 font-inter">
      <div className="w-full max-w-md">
        {/* Demo Mode Banner */}
        {!isSupabaseConfigured && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/20 border border-amber-400/30">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-5 h-5 text-amber-300 flex items-center justify-center">⚠️</div>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-white mb-1">Demo Mode Active</h3>
                <p className="text-sm text-gray-200 leading-relaxed">
                  Use any email/password to sign in for demo purposes.
                </p>
              </div>
            </div>
          </div>
        )}

        <form className="oauth-form" onSubmit={handleSubmit}>
          <div className="form-title">
            Welcome,
            <span>{isSignUp ? 'create your account to continue' : 'sign in to continue'}</span>
          </div>

          {/* OAuth Buttons */}
          <button 
            type="button"
            className="oauth-button oauth-button--google"
            onClick={() => handleOAuthSignIn('google')}
            disabled={loading}
          >
            <svg className="oauth-icon" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
              <path d="M1 1h22v22H1z" fill="none"></path>
            </svg>
            Continue with Google
          </button>

          <button 
            type="button"
            className="oauth-button oauth-button--github"
            onClick={() => handleOAuthSignIn('github')}
            disabled={loading}
          >
            <svg className="oauth-icon" viewBox="0 0 24 24">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"></path>
            </svg>
            Continue with Github
          </button>

          <div className="oauth-separator">
            <div></div>
            <span>OR</span>
            <div></div>
          </div>

          {/* Name Field (only for sign up) */}
          {isSignUp && (
            <input
              type="text"
              className="oauth-input"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required={isSignUp}
            />
          )}

          {/* Email Field */}
          <input
            type="email"
            className="oauth-input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {/* Password Field */}
          <input
            type="password"
            className="oauth-input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-red-500/20 border border-red-400/30 text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="oauth-button oauth-button--primary"
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {isSignUp ? 'Creating Account...' : 'Signing in...'}
              </div>
            ) : (
              <>
                {isSignUp ? 'Create Account' : 'Continue'}
                <svg className="oauth-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 17 5-5-5-5"></path>
                  <path d="m13 17 5-5-5-5"></path>
                </svg>
              </>
            )}
          </button>

          {/* Toggle Sign Up/In */}
          <div className="text-center mt-4">
            <p className="text-white/80 text-sm">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setIsSignUp(!isSignUp);
                }}
                className="text-white font-semibold hover:underline transition-all cursor-pointer"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </a>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SignIn;
