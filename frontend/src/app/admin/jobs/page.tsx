'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, RefreshCw, Download, Loader2, Filter } from 'lucide-react';
import { adminApi, uploadApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface Job {
  id: string;
  status: string;
  total_files: number;
  processed_files: number;
  failed_files: number;
  zip_url: string | null;
  created_at: string;
  user_name: string;
  user_email: string;
  school_name: string;
}

const statusBadge: any = {
  completed: 'badge-completed', processing: 'badge-processing',
  queued: 'badge-processing', failed: 'badge-failed', partial: 'badge-partial',
};

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await adminApi.jobs(params);
      setJobs(res.data.jobs);
    } catch {
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchJobs(); }, [page, statusFilter]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 8 }}>All Processing Jobs</h1>
          <p style={{ color: '#64748B' }}>Monitor all jobs across all users</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Filter size={14} color="#475569" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ paddingLeft: 36, minWidth: 160 }}
            >
              {['all', 'queued', 'processing', 'completed', 'failed', 'partial'].map(s => (
                <option key={s} value={s}>{s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
          <button onClick={fetchJobs} className="btn btn-ghost btn-sm" style={{ gap: 6 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <Loader2 size={28} color="#4F46E5" className="animate-spin" style={{ margin: '0 auto' }} />
        </div>
      ) : jobs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <Briefcase size={48} color="#1F2A40" style={{ margin: '0 auto 16px', display: 'block' }} />
          <p style={{ color: '#475569' }}>No jobs found</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Job ID</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Date</th>
                <th>Download</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, i) => (
                <motion.tr
                  key={job.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                >
                  <td>
                    <div style={{ fontWeight: 500, color: '#F1F5F9' }}>{job.user_name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#475569' }}>{job.user_email}</div>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#64748B' }}>
                    {job.id.slice(0, 12)}...
                  </td>
                  <td>
                    <span className={`badge ${statusBadge[job.status] || 'badge-pending'}`}>{job.status}</span>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>
                      {job.processed_files}/{job.total_files}
                    </div>
                    {job.failed_files > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#FCA5A5' }}>{job.failed_files} failed</div>
                    )}
                  </td>
                  <td style={{ fontSize: '0.82rem', color: '#64748B' }}>
                    {new Date(job.created_at).toLocaleDateString('en-PK')}
                  </td>
                  <td>
                    {job.zip_url ? (
                      <a href={uploadApi.downloadUrl(job.id)} download>
                        <button className="btn btn-success btn-sm" style={{ gap: 6 }}>
                          <Download size={13} /> {job.total_files === 1 ? 'Photo' : 'ZIP'}
                        </button>
                      </a>
                    ) : <span style={{ color: '#334155', fontSize: '0.8rem' }}>—</span>}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
