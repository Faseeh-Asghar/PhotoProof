'use client';
import { Suspense } from 'react';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ImageIcon, Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, user, hydrate, isHydrated } = useAuthStore();

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { hydrate(); }, []);
  useEffect(() => {
    if (isHydrated && user) {
      router.replace(user.role === 'admin' ? '/admin' : '/dashboard');
    }
  }, [isHydrated, user]);

  useEffect(() => {
    if (searchParams.get('expired')) toast.error('Session expired. Please login again.');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await authApi.login(form.email, form.password);
      const { token, user: userData } = res.data;
      login(token, userData);
      toast.success(`Welcome back, ${userData.name}!`);
      router.push(userData.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'radial-gradient(ellipse at 50% 20%, rgba(79,70,229,0.1) 0%, transparent 60%)',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ width: '100%', maxWidth: 420 }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Link href="/">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ImageIcon size={22} color="white" />
              </div>
              <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.4rem', color: '#F1F5F9' }}>
                PhotoProof
              </span>
            </div>
          </Link>
          <h1 style={{ fontSize: '1.5rem', marginTop: 24, marginBottom: 8 }}>Welcome back</h1>
          <p style={{ color: '#64748B', fontSize: '0.9rem' }}>Sign in to your account</p>
        </div>

        {/* Form Card */}
        <div className="card" style={{ padding: 32 }}>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 10, padding: '12px 16px',
                color: '#FCA5A5', fontSize: '0.875rem', marginBottom: 24,
              }}
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="login-email" style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem', fontWeight: 500, color: '#94A3B8' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="#475569" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="login-email"
                  className="input"
                  type="email"
                  placeholder="you@school.edu.pk"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  style={{ paddingLeft: 42 }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <label htmlFor="login-password" style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem', fontWeight: 500, color: '#94A3B8' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="#475569" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="login-password"
                  className="input"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  style={{ paddingLeft: 42, paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div style={{ textAlign: 'right', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  style={{ background: 'none', border: 'none', color: '#818CF8', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <motion.button
              id="login-submit"
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in...</> : 'Sign In'}
            </motion.button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, color: '#64748B', fontSize: '0.875rem' }}>
          Don't have an account?{' '}
          <Link href="/register" style={{ color: '#818CF8', fontWeight: 600 }}>Register here</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 8, color: '#475569', fontSize: '0.8rem' }}>
          <Link href="/" style={{ color: '#475569' }}>← Back to home</Link>
        </p>
      </motion.div>

      {showForgotModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24, backdropFilter: 'blur(4px)' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card"
            style={{ padding: 32, maxWidth: 400, width: '100%', textAlign: 'center' }}
          >
            <h2 style={{ marginBottom: 12 }}>Forgot Password?</h2>
            <p style={{ color: '#94A3B8', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: 24 }}>
              To reset your password, please contact the administrator directly using the details below:
            </p>
            <div style={{ background: 'rgba(79,70,229,0.1)', border: '1px solid rgba(79,70,229,0.25)', borderRadius: 12, padding: 16, marginBottom: 24, textAlign: 'left' }}>
              <p style={{ color: '#F1F5F9', fontWeight: 600, fontSize: '0.9rem', marginBottom: 8 }}>📞 Phone: <span style={{ color: '#818CF8' }}>0306 9136380</span></p>
              <p style={{ color: '#F1F5F9', fontWeight: 600, fontSize: '0.9rem' }}>💳 JazzCash: <span style={{ color: '#818CF8' }}>0303 0934664</span></p>
            </div>
            <button onClick={() => setShowForgotModal(false)} className="btn btn-primary btn-full">
              Close
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #4F46E5', borderTopColor: 'transparent', borderRadius: '50%' }} />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
