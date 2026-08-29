'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Loader2, CheckCircle2, Eye, EyeOff, ImageIcon } from 'lucide-react';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const [step, setStep]     = useState<'form' | 'success'>('form');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<any>({});

  const [form, setForm] = useState({
    name: '', email: '', password: '',
    paymentMethod: 'jazzcash', paymentNote: '',
  });

  const validate = () => {
    const e: any = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.email)       e.email = 'Required';
    if (!form.password || form.password.length < 8) e.password = 'Min 8 characters';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({}); setLoading(true);
    try {
      await authApi.register(form);
      setStep('success');
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Registration failed');
    } finally { setLoading(false); }
  };

  if (step === 'success') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--bg-base)' }}>
        <div className="card" style={{ padding: 32, maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <CheckCircle2 size={48} color="var(--brand-success)" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ marginBottom: 10, fontSize: '1.2rem' }}>Registration Sent!</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.7 }}>
            Pay via JazzCash <strong>0303 0934664</strong> and your account will be activated within 24 hours.
          </p>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 20 }}>
            WhatsApp: <strong>0306 9136380</strong>
          </p>
          <Link href="/login">
            <button className="btn btn-primary btn-full">Go to Login</button>
          </Link>
        </div>
      </div>
    );
  }

  const field = (key: keyof typeof form, label: string, type = 'text', placeholder = '') => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', marginBottom: 6, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</label>
      <input
        className="input"
        type={type}
        placeholder={placeholder}
        value={form[key]}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
      />
      {errors[key] && <p style={{ color: 'var(--brand-danger)', fontSize: '0.75rem', marginTop: 4 }}>{errors[key]}</p>}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--bg-base)' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <ImageIcon size={20} color="var(--brand-primary)" />
            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>PhotoProof</span>
          </Link>
          <h1 style={{ marginTop: 16, marginBottom: 4, fontSize: '1.3rem' }}>Create Account</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Register and pay to get started</p>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <form onSubmit={handleSubmit}>
            {field('name', 'Full Name', 'text', 'Your name')}
            {field('email', 'Email', 'email', 'you@example.com')}

            {/* Password with toggle */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showPw ? 'text' : 'password'} placeholder="Min 8 characters"
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  style={{ paddingRight: 42 }} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && <p style={{ color: 'var(--brand-danger)', fontSize: '0.75rem', marginTop: 4 }}>{errors.password}</p>}
            </div>

            {/* Payment note */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Payment Note <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              <input className="input" type="text" placeholder="JazzCash transaction ID or note"
                value={form.paymentNote} onChange={e => setForm({ ...form, paymentNote: e.target.value })} />
            </div>

            {/* Payment info */}
            <div style={{ padding: '12px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, marginBottom: 20, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              💳 Pay via JazzCash: <strong style={{ color: 'var(--text-primary)' }}>0303 0934664</strong><br />
              50 photos = 100 Rs &nbsp;|&nbsp; 100 photos = 200 Rs
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? <><Loader2 size={15} className="animate-spin" /> Registering…</> : 'Register'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Already have an account? <Link href="/login" style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>Login</Link>
          &nbsp;·&nbsp;
          <Link href="/" style={{ color: 'var(--text-muted)' }}>Home</Link>
        </p>
      </div>
    </div>
  );
}
