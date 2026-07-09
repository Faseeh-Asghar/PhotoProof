'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Upload, ImageIcon, CheckCircle, Clock, TrendingUp, Download, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { uploadApi } from '@/lib/api';

interface Job {
  id: string;
  status: string;
  total_files: number;
  processed_files: number;
  failed_files: number;
  zip_url: string | null;
  created_at: string;
}

export default function DashboardPage() {
  const { user, refreshUser } = useAuthStore();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  useEffect(() => {
    refreshUser();
    uploadApi.jobs().then((res) => {
      setJobs(res.data.jobs || []);
    }).catch(() => {}).finally(() => setLoadingJobs(false));
  }, []);

  const quotaPct = user ? Math.min(100, Math.round((user.imagesProcessed / user.quotaLimit) * 100)) : 0;
  const quotaRemaining = user ? user.quotaLimit - user.imagesProcessed : 0;

  const stats = [
    { label: 'Images Processed', value: user?.imagesProcessed ?? 0, icon: CheckCircle, color: '#10B981' },
    { label: 'Quota Remaining', value: quotaRemaining, icon: ImageIcon, color: '#818CF8' },
    { label: 'Total Jobs', value: user?.totalJobs ?? 0, icon: Clock, color: '#F59E0B' },
    { label: 'Usage', value: `${quotaPct}%`, icon: TrendingUp, color: '#3B82F6' },
  ];

  const statusBadge = (status: string) => {
    const map: any = {
      completed: 'badge-completed',
      processing: 'badge-processing',
      queued: 'badge-processing',
      failed: 'badge-failed',
      partial: 'badge-partial',
    };
    return map[status] || 'badge-pending';
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 8 }}>
          Welcome back, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p style={{ color: '#64748B' }}>{user?.schoolName} · {new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 32 }}>
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            className="stat-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 500 }}>{s.label}</span>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: `${s.color}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <s.icon size={16} color={s.color} />
              </div>
            </div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.8rem', color: '#F1F5F9' }}>
              {s.value}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quota Progress */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{ marginBottom: 32 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h4 style={{ marginBottom: 4 }}>Monthly Quota</h4>
            <p style={{ fontSize: '0.85rem', color: '#64748B' }}>
              {user?.imagesProcessed} of {user?.quotaLimit} images used this month
            </p>
          </div>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1.4rem', color: quotaPct > 80 ? '#EF4444' : '#818CF8' }}>
            {quotaPct}%
          </span>
        </div>
        <div className="progress-track" style={{ height: 8 }}>
          <div
            className="progress-fill"
            style={{
              width: `${quotaPct}%`,
              background: quotaPct > 80 ? 'linear-gradient(135deg, #EF4444, #DC2626)' : undefined,
            }}
          />
        </div>
        {quotaPct > 80 && (
          <p style={{ color: '#FCA5A5', fontSize: '0.8rem', marginTop: 8 }}>
            ⚠️ Running low on quota. Contact admin to upgrade.
          </p>
        )}
      </motion.div>

      {/* Upload CTA */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        style={{ marginBottom: 32 }}
      >
        <Link href="/dashboard/upload">
          <div style={{
            background: 'linear-gradient(135deg, rgba(79,70,229,0.15), rgba(124,58,237,0.10))',
            border: '2px dashed rgba(79,70,229,0.4)',
            borderRadius: 16,
            padding: '32px 40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 250ms',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as any).style.borderColor = 'rgba(79,70,229,0.7)';
            (e.currentTarget as any).style.background = 'linear-gradient(135deg, rgba(79,70,229,0.2), rgba(124,58,237,0.15))';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as any).style.borderColor = 'rgba(79,70,229,0.4)';
            (e.currentTarget as any).style.background = 'linear-gradient(135deg, rgba(79,70,229,0.15), rgba(124,58,237,0.10))';
          }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Upload size={24} color="white" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: 4, color: '#F1F5F9' }}>Upload Student Photos</h3>
                <p style={{ color: '#64748B', fontSize: '0.875rem' }}>Drag and drop up to 100 photos for batch processing</p>
              </div>
            </div>
            <ArrowRight size={20} color="#818CF8" />
          </div>
        </Link>
      </motion.div>

      {/* Recent Jobs */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h3 style={{ fontSize: '1.1rem' }}>Recent Jobs</h3>
          <Link href="/dashboard/jobs" style={{ color: '#818CF8', fontSize: '0.85rem', fontWeight: 600 }}>
            View All →
          </Link>
        </div>

        {loadingJobs ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#475569' }}>Loading...</div>
        ) : jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <ImageIcon size={40} color="#1F2A40" style={{ margin: '0 auto 12px', display: 'block' }} />
            <p style={{ color: '#475569', fontSize: '0.9rem' }}>No jobs yet. Upload your first batch!</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Files</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {jobs.slice(0, 5).map((job) => (
                <tr key={job.id}>
                  <td>{new Date(job.created_at).toLocaleDateString('en-PK')}</td>
                  <td>{job.processed_files}/{job.total_files} processed</td>
                  <td><span className={`badge ${statusBadge(job.status)}`}>{job.status}</span></td>
                  <td>
                    {job.zip_url ? (
                      <a href={uploadApi.downloadUrl(job.id)} download>
                        <button className="btn btn-success btn-sm" style={{ gap: 6 }}>
                          <Download size={13} /> ZIP
                        </button>
                      </a>
                    ) : (
                      <span style={{ color: '#475569', fontSize: '0.8rem' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
  );
}
