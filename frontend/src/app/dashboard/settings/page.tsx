'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, Building2, Save, Loader2, CheckCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, refreshUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState<any>({});

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: any = {};
    if (!pwForm.currentPassword) errs.currentPassword = 'Required';
    if (!pwForm.newPassword || pwForm.newPassword.length < 8) errs.newPassword = 'Min 8 characters';
    if (pwForm.newPassword !== pwForm.confirm) errs.confirm = 'Passwords do not match';
    if (Object.keys(errs).length > 0) { setPwErrors(errs); return; }

    setLoading(true);
    try {
      await authApi.changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast.success('Password updated successfully');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 8 }}>Account Settings</h1>
        <p style={{ color: '#64748B' }}>Manage your account information and security</p>
      </div>

      {/* Profile Info */}
      <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 24, fontSize: '1rem' }}>Profile Information</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
          {[
            { label: 'Full Name', value: user?.name, icon: User },
            { label: 'Email Address', value: user?.email, icon: null },
            { label: 'School / Organization', value: user?.schoolName || '—', icon: Building2 },
            { label: 'Account Status', value: user?.status, icon: null },
            { label: 'Images Processed', value: `${user?.imagesProcessed} / ${user?.quotaLimit}`, icon: null },
            { label: 'Role', value: user?.role, icon: null },
          ].map((f) => (
            <div key={f.label} style={{
              background: '#0D1322', borderRadius: 10, padding: '14px 16px',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: 6 }}>{f.label}</div>
              <div style={{ fontSize: '0.9rem', color: '#F1F5F9', fontWeight: 500 }}>{f.value}</div>
            </div>
          ))}
        </div>
        <p style={{ color: '#475569', fontSize: '0.8rem', marginTop: 16 }}>
          To update profile info, contact admin at faseehasghar167@gmail.com
        </p>
      </motion.div>

      {/* Change Password */}
      <motion.div className="card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <h3 style={{ marginBottom: 24, fontSize: '1rem' }}>Change Password</h3>
        <form onSubmit={handlePasswordChange} style={{ maxWidth: 400 }}>
          {[
            { label: 'Current Password', key: 'currentPassword', id: 'curr-pw' },
            { label: 'New Password', key: 'newPassword', id: 'new-pw' },
            { label: 'Confirm New Password', key: 'confirm', id: 'confirm-pw' },
          ].map((f) => (
            <div key={f.key} style={{ marginBottom: 20 }}>
              <label htmlFor={f.id} style={{ display: 'block', marginBottom: 8, fontSize: '0.875rem', fontWeight: 500, color: '#94A3B8' }}>
                {f.label}
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} color="#475569" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id={f.id}
                  className="input"
                  type="password"
                  value={(pwForm as any)[f.key]}
                  onChange={(e) => setPwForm({ ...pwForm, [f.key]: e.target.value })}
                  style={{ paddingLeft: 42 }}
                />
              </div>
              {(pwErrors as any)[f.key] && (
                <p style={{ color: '#FCA5A5', fontSize: '0.8rem', marginTop: 6 }}>{(pwErrors as any)[f.key]}</p>
              )}
            </div>
          ))}

          <button
            id="change-pw-submit"
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ gap: 8 }}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Update Password
          </button>
        </form>
      </motion.div>
    </div>
  );
}
