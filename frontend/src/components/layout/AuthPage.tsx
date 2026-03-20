import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerSchema = loginSchema.extend({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setUser, setTokens } = useAuthStore();

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const handleLogin = async (data: LoginForm) => {
    try {
      setError('');
      const res = await api.login(data);
      setTokens(res.data.tokens);
      setUser(res.data.user);
      navigate(res.data.user.creature ? '/game' : '/create');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Invalid credentials');
    }
  };

  const handleRegister = async (data: RegisterForm) => {
    try {
      setError('');
      const res = await api.register({
        email: data.email,
        password: data.password,
        username: data.username,
      });
      setTokens(res.data.tokens);
      setUser(res.data.user);
      navigate('/create');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen bg-game-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <button onClick={() => navigate('/')} className="text-4xl mb-2 block mx-auto hover:scale-110 transition-transform">🌍</button>
          <h1 className="text-2xl font-bold text-white">Creature World</h1>
          <p className="text-gray-400 text-sm mt-1">
            {mode === 'login' ? 'Welcome back, commander.' : 'Join the world. Claim your land.'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg bg-game-elevated border border-game-border mb-6 p-1">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                mode === m ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {m === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {/* Forms */}
        <div className="card">
          {error && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 mb-4 text-red-300 text-sm">
              {error}
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input {...loginForm.register('email')} type="email" className="input" placeholder="you@example.com" />
                {loginForm.formState.errors.email && (
                  <p className="text-red-400 text-xs mt-1">{loginForm.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <label className="label">Password</label>
                <input {...loginForm.register('password')} type="password" className="input" placeholder="••••••••" />
                {loginForm.formState.errors.password && (
                  <p className="text-red-400 text-xs mt-1">{loginForm.formState.errors.password.message}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={loginForm.formState.isSubmitting}
                className="btn-primary w-full py-3"
              >
                {loginForm.formState.isSubmitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
              <div>
                <label className="label">Username</label>
                <input {...registerForm.register('username')} className="input" placeholder="cool_player_123" />
                {registerForm.formState.errors.username && (
                  <p className="text-red-400 text-xs mt-1">{registerForm.formState.errors.username.message}</p>
                )}
              </div>
              <div>
                <label className="label">Email</label>
                <input {...registerForm.register('email')} type="email" className="input" placeholder="you@example.com" />
                {registerForm.formState.errors.email && (
                  <p className="text-red-400 text-xs mt-1">{registerForm.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <label className="label">Password</label>
                <input {...registerForm.register('password')} type="password" className="input" placeholder="••••••••" />
                {registerForm.formState.errors.password && (
                  <p className="text-red-400 text-xs mt-1">{registerForm.formState.errors.password.message}</p>
                )}
              </div>
              <div>
                <label className="label">Confirm Password</label>
                <input {...registerForm.register('confirmPassword')} type="password" className="input" placeholder="••••••••" />
                {registerForm.formState.errors.confirmPassword && (
                  <p className="text-red-400 text-xs mt-1">{registerForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={registerForm.formState.isSubmitting}
                className="btn-primary w-full py-3"
              >
                {registerForm.formState.isSubmitting ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-gray-500 text-xs mt-4">
          By playing you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
