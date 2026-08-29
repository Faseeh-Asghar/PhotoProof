'use client';
import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Eye, EyeOff, ImageIcon } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, user, hydrate, isHydrated } = useAuthStore();

  const [form, setForm]     = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [showForgot, setShowForgot] = useState(false);

  useEffect(() => { hydrate(); }, []);
  useEffect(() => {
    if (isHydrated && user) router.replace(user.role === 'admin' ? '/admin' : '/dashboard');
  }, [isHydrated, user]);
  useEffect(() => {
    if (searchParams.get('expired')) toast.error('Session expired. Please log in again.');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await authApi.login(form.email, form.password);
      const { token, user: u } = res.data;
      login(token, u);
      router.push(u.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--bg-base)' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <ImageIcon size={20} color="var(--brand-primary)" />
            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>PhotoProof</span>
          </Link>
          <h1 style={{ marginTop: 20, marginBottom: 4, fontSize: '1.3rem' }}>Sign In</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Enter your credentials to continue</p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 24 }}>
          {error && (
            <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', color: '#B91C1C', fontSize: '0.85rem', marginBottom: 18 }}>
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Email</label>
              <input className="input" type="email" placeholder="you@example.com" required
                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showPw ? 'text' : 'password'} placeholder="••••••••" required
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  style={{ paddingRight: 42 }} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'right', marginBottom: 20 }}>
              <button type="button" onClick={() => setShowForgot(true)}
                style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', fontSize: '0.78rem', cursor: 'pointer', padding: 0 }}>
                Forgot password?
              </button>
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? <><Loader2 size={15} className="animate-spin" /> Signing in…</> : 'Sign In'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 18, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          No account? <Link href="/register" style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>Register</Link>
          &nbsp;·&nbsp;
          <Link href="/" style={{ color: 'var(--text-muted)' }}>Home</Link>
        </p>
      </div>

      {/* Forgot password modal */}
      {showForgot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div className="card" style={{ padding: 24, maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <h2 style={{ marginBottom: 12, fontSize: '1.1rem' }}>Reset Password</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 16 }}>Contact the admin to reset your password:</p>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, textAlign: 'left' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 6 }}>📞 <strong>0306 9136380</strong></p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>💳 JazzCash: <strong>0303 0934664</strong></p>
            </div>
            <button className="btn btn-primary btn-full" onClick={() => setShowForgot(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={24} className="animate-spin" color="var(--brand-primary)" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
