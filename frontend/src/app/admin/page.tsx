'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, ImageIcon, CheckCircle, Clock, TrendingUp, AlertTriangle, Briefcase } from 'lucide-react';
import { adminApi } from '@/lib/api';
import Link from 'next/link';

interface Stats {
  users: { total_users: number; active_users: number; pending_users: number; suspended_users: number; new_this_month: number };
  jobs: { total_jobs: number; completed_jobs: number; active_jobs: number; failed_jobs: number; jobs_today: number };
  processing: { total_images_processed: number; images_today: number; images_this_month: number };
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.stats().then((res) => setStats(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const statCards = stats ? [
    { label: 'Total Users', value: stats.users.total_users, icon: Users, color: '#818CF8', sub: `${stats.users.new_this_month} new this month` },
    { label: 'Active Users', value: stats.users.active_users, icon: CheckCircle, color: '#10B981', sub: `${stats.users.pending_users} pending approval` },
    { label: 'Images Processed', value: stats.processing.total_images_processed, icon: ImageIcon, color: '#F59E0B', sub: `${stats.processing.images_today} today` },
    { label: 'Jobs Today', value: stats.jobs.jobs_today, icon: Briefcase, color: '#3B82F6', sub: `${stats.jobs.active_jobs} currently active` },
    { label: 'Pending Approval', value: stats.users.pending_users, icon: Clock, color: '#F59E0B', sub: 'Awaiting your action', alert: stats.users.pending_users > 0 },
    { label: 'Failed Jobs', value: stats.jobs.failed_jobs, icon: AlertTriangle, color: '#EF4444', sub: `of ${stats.jobs.total_jobs} total jobs` },
  ] : [];

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 8 }}>Admin Overview</h1>
        <p style={{ color: '#64748B' }}>Platform health and key metrics</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: '#475569' }}>Loading stats...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 40 }}>
            {statCards.map((s, i) => (
              <motion.div
                key={s.label}
                className="stat-card"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                style={{
                  borderTop: s.alert ? '2px solid rgba(245,158,11,0.7)' : undefined,
                }}
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
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '2rem', color: s.alert ? '#FCD34D' : '#F1F5F9', marginBottom: 6 }}>
                  {s.value?.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#475569' }}>{s.sub}</div>
              </motion.div>
            ))}
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            <Link href="/admin/users?status=pending_approval" style={{ textDecoration: 'none' }}>
              <motion.div
                className="card card-hover"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                style={{ borderColor: stats?.users.pending_users ? 'rgba(245,158,11,0.3)' : undefined }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: 'rgba(245,158,11,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Clock size={22} color="#F59E0B" />
                  </div>
                  <div>
                    <h4 style={{ marginBottom: 4, fontSize: '1rem' }}>Pending Approvals</h4>
                    <p style={{ fontSize: '0.85rem', color: '#64748B' }}>
                      {stats?.users.pending_users} user{stats?.users.pending_users !== 1 ? 's' : ''} waiting for activation
                    </p>
                  </div>
                </div>
              </motion.div>
            </Link>

            <Link href="/admin/users" style={{ textDecoration: 'none' }}>
              <motion.div
                className="card card-hover"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: 'rgba(79,70,229,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Users size={22} color="#818CF8" />
                  </div>
                  <div>
                    <h4 style={{ marginBottom: 4, fontSize: '1rem' }}>Manage Users</h4>
                    <p style={{ fontSize: '0.85rem', color: '#64748B' }}>
                      Approve, suspend, manage quotas
                    </p>
                  </div>
                </div>
              </motion.div>
            </Link>

            <Link href="/admin/jobs" style={{ textDecoration: 'none' }}>
              <motion.div
                className="card card-hover"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: 'rgba(16,185,129,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <TrendingUp size={22} color="#10B981" />
                  </div>
                  <div>
                    <h4 style={{ marginBottom: 4, fontSize: '1rem' }}>Job Monitor</h4>
                    <p style={{ fontSize: '0.85rem', color: '#64748B' }}>
                      View all processing jobs platform-wide
                    </p>
                  </div>
                </div>
              </motion.div>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
