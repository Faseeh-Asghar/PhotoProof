'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, RefreshCw, FolderOpen, Clock, Loader2 } from 'lucide-react';
import { uploadApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface Job {
  id: string;
  status: string;
  total_files: number;
  processed_files: number;
  failed_files: number;
  zip_url: string | null;
  zip_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

const statusBadge: any = {
  completed: 'badge-completed', processing: 'badge-processing',
  queued: 'badge-processing', failed: 'badge-failed', partial: 'badge-partial',
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchJobs = async (p = 1) => {
    try {
      const res = await uploadApi.jobs(p);
      setJobs(res.data.jobs);
      setTotal(res.data.total);
    } catch {
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchJobs(page); }, [page]);

  const formatDate = (d: string) => new Date(d).toLocaleString('en-PK', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const isExpired = (exp: string | null) => exp ? new Date(exp) < new Date() : false;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 8 }}>My Processing Jobs</h1>
          <p style={{ color: '#64748B' }}>All your photo batch jobs and their download links</p>
        </div>
        <button
          onClick={() => fetchJobs(page)}
          className="btn btn-ghost btn-sm"
          style={{ gap: 8 }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Loader2 size={32} color="#4F46E5" className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: '#475569' }}>Loading jobs...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <FolderOpen size={48} color="#1F2A40" style={{ margin: '0 auto 16px', display: 'block' }} />
          <h3 style={{ color: '#475569', marginBottom: 8 }}>No jobs yet</h3>
          <p style={{ color: '#334155', fontSize: '0.875rem' }}>Upload student photos to create your first job</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {jobs.map((job, i) => (
              <motion.div
                key={job.id}
                className="card"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                style={{ padding: '20px 24px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <span className={`badge ${statusBadge[job.status] || 'badge-pending'}`}>{job.status}</span>
                      <span style={{ color: '#475569', fontSize: '0.78rem', fontFamily: 'monospace' }}>
                        #{job.id.slice(0, 12)}...
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '1.4rem', fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#10B981' }}>
                          {job.processed_files}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Processed</div>
                      </div>
                      {job.failed_files > 0 && (
                        <div>
                          <div style={{ fontSize: '1.4rem', fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#EF4444' }}>
                            {job.failed_files}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Failed</div>
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: '1.4rem', fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#94A3B8' }}>
                          {job.total_files}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B' }}>Total</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontSize: '0.8rem', marginBottom: 12, justifyContent: 'flex-end' }}>
                      <Clock size={13} /> {formatDate(job.created_at)}
                    </div>

                    {job.zip_url && !isExpired(job.zip_expires_at) ? (
                      <div>
                        <a href={uploadApi.downloadUrl(job.id)} download>
                          <button className="btn btn-success" style={{ gap: 8 }}>
                            <Download size={15} /> Download {job.total_files === 1 ? 'Photo' : 'ZIP'}
                          </button>
                        </a>
                        {job.zip_expires_at && (
                          <p style={{ color: '#475569', fontSize: '0.75rem', marginTop: 6 }}>
                            Expires: {formatDate(job.zip_expires_at)}
                          </p>
                        )}
                      </div>
                    ) : job.zip_url && isExpired(job.zip_expires_at) ? (
                      <div style={{
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: 8, padding: '8px 16px', color: '#FCA5A5', fontSize: '0.82rem',
                      }}>
                        Download expired
                      </div>
                    ) : (job.status === 'processing' || job.status === 'queued') ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#818CF8', fontSize: '0.85rem' }}>
                        <Loader2 size={14} className="animate-spin" /> Processing...
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Progress bar for active jobs */}
                {(job.status === 'processing' || job.status === 'queued') && (
                  <div style={{ marginTop: 16 }}>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width: `${job.total_files > 0 ? Math.round((job.processed_files / job.total_files) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                )}
                
                {job.failed_files > 0 && (job as any).failed_details && (
                  <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 8 }}>
                    <h4 style={{ color: '#EF4444', fontSize: '0.85rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      Error Details
                    </h4>
                    <ul style={{ color: '#FCA5A5', fontSize: '0.8rem', paddingLeft: 16, margin: 0, fontFamily: 'monospace' }}>
                      {(job as any).failed_details.map((fail: any, idx: number) => (
                        <li key={idx} style={{ marginBottom: 4 }}>
                          <span style={{ color: '#94A3B8' }}>{fail.name}:</span> {fail.error || 'Unknown error'}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          {total > 10 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 32 }}>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </button>
              <span style={{ color: '#64748B', fontSize: '0.875rem', alignSelf: 'center' }}>
                Page {page} of {Math.ceil(total / 10)}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page >= Math.ceil(total / 10)}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
