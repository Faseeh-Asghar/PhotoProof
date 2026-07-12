'use client';
import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ImageIcon, Mail, Lock, User, CreditCard, Eye, EyeOff, CheckCircle2, Loader2 } from 'lucide-react';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';

const Field = ({ label, id, children, error }: any) => (
  <div style={{ marginBottom: 20 }}>
    <label htmlFor={id} style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem', fontWeight: 500, color: '#94A3B8' }}>
      {label}
    </label>
    {children}
    {error && <p style={{ color: '#FCA5A5', fontSize: '0.8rem', marginTop: 6 }}>{error}</p>}
  </div>
);

export default function RegisterPage() {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<any>({});

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    transactionId: '',
    paymentMethod: 'jazzcash',
    paymentNote: '',
  });

  const validate = () => {
    const e: any = {};
    if (!form.name.trim()) e.name = 'Full name is required';
    if (!form.email) e.email = 'Email is required';
    if (!form.password || form.password.length < 8) e.password = 'Password must be at least 8 characters';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);

    try {
      await authApi.register(form);
      setStep('success');
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Registration failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };



  if (step === 'success') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}
        >
          <div className="card" style={{ padding: 48 }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'rgba(16,185,129,0.1)', border: '2px solid rgba(16,185,129,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
            }}>
              <CheckCircle2 size={40} color="#10B981" />
            </div>
            <h2 style={{ marginBottom: 16 }}>Registration Submitted!</h2>
            <p style={{ marginBottom: 32, lineHeight: 1.7, color: '#94A3B8' }}>
              Your account is pending payment verification. Here's what happens next:
            </p>

            <div style={{ textAlign: 'left', background: '#0D1322', borderRadius: 12, padding: 24, marginBottom: 32 }}>
              {[
                ['📱', 'Send PKR 300 via JazzCash or EasyPaisa to admin'],
                ['✉️', 'Include your email in the payment description'],
                ['⏳', 'Admin verifies and activates your account (< 24 hours)'],
                ['🎉', 'You receive a confirmation email and can login'],
              ].map(([icon, text], i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: i < 3 ? 16 : 0 }}>
                  <span style={{ fontSize: '1.1rem' }}>{icon}</span>
                  <span style={{ color: '#94A3B8', fontSize: '0.9rem', lineHeight: 1.6 }}>{text}</span>
                </div>
              ))}
            </div>

            <div style={{
              background: 'rgba(79,70,229,0.1)', border: '1px solid rgba(79,70,229,0.25)',
              borderRadius: 12, padding: 20, marginBottom: 32, textAlign: 'center',
            }}>
              <p style={{ color: '#818CF8', fontSize: '0.85rem', fontWeight: 700, marginBottom: 4 }}>Payment Contact</p>
              <p style={{ color: '#F1F5F9', fontWeight: 600, marginTop: 8 }}>faseehasghar167@gmail.com</p>
              <p style={{ color: '#64748B', fontSize: '0.8rem', marginTop: 4 }}>Amount: PKR 300 / month</p>
            </div>

            <Link href="/login">
              <button className="btn btn-primary btn-full">Go to Login →</button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      background: 'radial-gradient(ellipse at 50% 20%, rgba(79,70,229,0.08) 0%, transparent 60%)',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ width: '100%', maxWidth: 480 }}
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
              <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.4rem', color: '#F1F5F9' }}>PhotoProof</span>
            </div>
          </Link>
          <h1 style={{ fontSize: '1.5rem', marginTop: 24, marginBottom: 8 }}>Create Account</h1>
          <p style={{ color: '#64748B', fontSize: '0.9rem' }}>Register for PKR 300/month — unlimited batch processing</p>
        </div>

        <div className="card" style={{ padding: 32 }}>
          <form onSubmit={handleSubmit}>
            <Field label="Full Name" id="reg-name" error={errors.name}>
              <div style={{ position: 'relative' }}>
                <User size={15} color="#475569" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input id="reg-name" className="input" type="text" placeholder="Muhammad Salman"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  style={{ paddingLeft: 42 }} />
              </div>
            </Field>

            <Field label="Email Address" id="reg-email" error={errors.email}>
              <div style={{ position: 'relative' }}>
                <Mail size={15} color="#475569" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input id="reg-email" className="input" type="email" placeholder="you@gmail.com"
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  style={{ paddingLeft: 42 }} />
              </div>
            </Field>

            <Field label="Password" id="reg-password" error={errors.password}>
              <div style={{ position: 'relative' }}>
                <Lock size={15} color="#475569" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input id="reg-password" className="input" type={showPw ? 'text' : 'password'} placeholder="At least 8 characters"
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  style={{ paddingLeft: 42, paddingRight: 42 }} />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 20, marginBottom: 20 }}>
              <p style={{ color: '#64748B', fontSize: '0.82rem', marginBottom: 20, lineHeight: 1.6 }}>
                <strong style={{ color: '#94A3B8' }}>Payment Info</strong> — Add your transaction ID after paying PKR 300.
                Admin will verify and activate your account within 24 hours.
              </p>

              <Field label="Payment Method" id="reg-payment-method">
                <select id="reg-payment-method" className="input"
                  value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                  <option value="jazzcash">JazzCash</option>
                  <option value="easypaisa">EasyPaisa</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="other">Other</option>
                </select>
              </Field>

              <Field label="Transaction ID (Optional)" id="reg-txn">
                <div style={{ position: 'relative' }}>
                  <CreditCard size={15} color="#475569" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                  <input id="reg-txn" className="input" type="text" placeholder="e.g. T123456789"
                    value={form.transactionId} onChange={(e) => setForm({ ...form, transactionId: e.target.value })}
                    style={{ paddingLeft: 42 }} />
                </div>
              </Field>
            </div>

            <motion.button
              id="reg-submit"
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.01 }}
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : 'Create Account →'}
            </motion.button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, color: '#64748B', fontSize: '0.875rem' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#818CF8', fontWeight: 600 }}>Sign in</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 8 }}>
          <Link href="/" style={{ color: '#475569', fontSize: '0.8rem' }}>← Back to home</Link>
        </p>
      </motion.div>
    </div>
  );
}
