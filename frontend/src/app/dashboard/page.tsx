'use client';
import { useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, X, CheckCircle, AlertCircle, Download, FileImage, Trash2, Zap, Loader2, ImageIcon, Image as ImageIcon2
} from 'lucide-react';
import { uploadApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

interface Job {
  id: string;
  status: string;
  total_files: number;
  processed_files: number;
  failed_files: number;
  zip_url: string | null;
  created_at: string;
}

interface FileItem {
  id: string;
  file: File;
  preview: string;
  customName: string;
  status: 'ready' | 'processing' | 'done' | 'error';
  processedFile?: File;
  processedPreview?: string;
}

interface JobResult {
  jobId: string;
  status: string;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  progress: number;
  downloadUrl: string | null;
}

export default function DashboardPage() {
  const { user, refreshUser } = useAuthStore();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [statusMsg, setStatusMsg] = useState('Processing...');
  const [jobResult, setJobResult] = useState<JobResult | null>(null);

  const [targetWidth, setTargetWidth] = useState(600);
  const [targetHeight, setTargetHeight] = useState(800);
  const [targetSizeKb, setTargetSizeKb] = useState(20);

  const loadJobs = () => {
    setLoadingJobs(true);
    uploadApi.jobs().then((res) => {
      setJobs(res.data.jobs || []);
    }).catch(() => {}).finally(() => setLoadingJobs(false));
  };

  useEffect(() => {
    refreshUser();
    loadJobs();
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.bmp'] },
    maxFiles: 100,
    maxSize: 20 * 1024 * 1024,
    onDrop: (accepted, rejected) => {
      if (rejected.length > 0) {
        toast.error(`${rejected.length} file(s) rejected (max 20MB, images only)`);
      }
      const newFiles: FileItem[] = accepted.map((f) => ({
        id: Math.random().toString(36).slice(2),
        file: f,
        preview: URL.createObjectURL(f),
        customName: f.name.replace(/\.[^/.]+$/, "") + "_processed.jpg",
        status: 'ready',
      }));
      setFiles((prev) => [...prev, ...newFiles].slice(0, 100));
      setJobResult(null);
    },
  });

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const f = prev.find((x) => x.id === id);
      if (f) {
        URL.revokeObjectURL(f.preview);
        if (f.processedPreview) URL.revokeObjectURL(f.processedPreview);
      }
      return prev.filter((x) => x.id !== id);
    });
  };

  const clearAll = () => {
    files.forEach((f) => {
      URL.revokeObjectURL(f.preview);
      if (f.processedPreview) URL.revokeObjectURL(f.processedPreview);
    });
    setFiles([]);
    setJobResult(null);
  };

  const updateFileName = (id: string, newName: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, customName: newName } : f));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setJobResult(null);
    setUploadPct(0);

    try {
      toast.success('Processing images...');
      
      const pFiles: File[] = [];

      setStatusMsg('Preparing images...');
      for (const f of files) {
        try {
          const bmp = await createImageBitmap(f.file);
          let w = bmp.width; let h = bmp.height;
          if (Math.max(w, h) > 1024) {
            const ratio = 1024 / Math.max(w, h);
            w = Math.round(w * ratio); h = Math.round(h * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d')?.drawImage(bmp, 0, 0, w, h);
          const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.9));
          
          if (blob) {
            pFiles.push(new File([blob], f.customName, { type: 'image/jpeg' }));
          } else {
            pFiles.push(new File([f.file], f.customName, { type: f.file.type }));
          }
        } catch {
          pFiles.push(new File([f.file], f.customName, { type: f.file.type }));
        }
      }

      setStatusMsg('Uploading to server...');
      setUploadPct(10);
      const res = await uploadApi.batch(pFiles, { width: targetWidth, height: targetHeight, sizeKb: targetSizeKb }, (pct) => setUploadPct(10 + Math.round(pct * 0.4)));
      
      const { jobId } = res.data;

      setStatusMsg('AI processing on server...');
      let isDone = false;
      while (!isDone) {
        await new Promise(r => setTimeout(r, 2000));
        const stRes = await uploadApi.jobStatus(jobId);
        const st = stRes.data;
        
        setUploadPct(50 + Math.round(st.progress / 2));
        
        if (st.files) {
          setFiles(prev => prev.map(f => {
            const serverFile = st.files.find((sf: any) => sf.originalName === f.file.name);
            if (serverFile) {
              if (serverFile.status === 'completed') {
                const baseUrl = '';
                return { 
                  ...f, 
                  status: 'done',
                  processedPreview: serverFile.processedUrl ? baseUrl + serverFile.processedUrl : f.processedPreview 
                };
              }
              if (serverFile.status === 'failed') return { ...f, status: 'error' };
            }
            return f;
          }));
        }
        
        if (st.status === 'completed' || st.status === 'partial') {
          setJobResult({
            jobId,
            status: st.status,
            totalFiles: st.totalFiles,
            processedFiles: st.processedFiles,
            failedFiles: st.failedFiles,
            progress: 100,
            downloadUrl: st.downloadUrl || null,
          });
          toast.success(`✅ Server finished processing ${st.processedFiles} photos!`);
          isDone = true;
          refreshUser();
          loadJobs(); // refresh the active jobs list
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Processing failed. Please try again.';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job and its files?')) return;
    try {
      await uploadApi.deleteJob(jobId);
      toast.success('Job deleted.');
      setJobs(prev => prev.filter(j => j.id !== jobId));
    } catch (err) {
      toast.error('Failed to delete job.');
    }
  };

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

  const totalSizeMB = (files.reduce((acc, f) => acc + f.file.size, 0) / 1024 / 1024).toFixed(1);

  return (
    <div>
      {/* Header & Simple Quota */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 4 }}>
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p style={{ color: '#64748B' }}>Upload photos below to remove their background.</p>
        </div>
        <div style={{ background: '#141B2D', padding: '12px 20px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ color: '#94A3B8', fontSize: '0.85rem', display: 'block', marginBottom: 2 }}>Monthly Quota</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#F1F5F9' }}>
            {user?.imagesProcessed} <span style={{ color: '#64748B', fontWeight: 500 }}>/ {user?.quotaLimit}</span>
          </span>
        </div>
      </div>

      {/* Processing Settings */}
      <div className="card" style={{ padding: 24, marginBottom: 32 }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={18} color="#818CF8" /> Output Settings
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 8, color: '#94A3B8', fontSize: '0.85rem' }}>Dimensions (W x H)</label>
            <div style={{ display: 'flex', gap: 8 }}>
               <input type="number" value={targetWidth} onChange={(e) => setTargetWidth(Number(e.target.value))} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#F1F5F9', textAlign: 'center' }} placeholder="W" />
               <span style={{ color: '#64748B', alignSelf: 'center' }}>x</span>
               <input type="number" value={targetHeight} onChange={(e) => setTargetHeight(Number(e.target.value))} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#F1F5F9', textAlign: 'center' }} placeholder="H" />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 8, color: '#94A3B8', fontSize: '0.85rem' }}>Max File Size (KB)</label>
            <input type="number" value={targetSizeKb} onChange={(e) => setTargetSizeKb(Number(e.target.value))} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#F1F5F9', textAlign: 'center' }} placeholder="Custom KB" />
          </div>
        </div>
      </div>

      {/* Drop Zone */}
      {files.length === 0 && (
        <div
          {...getRootProps()}
          style={{
            border: `2px dashed ${isDragActive ? 'rgba(79,70,229,0.8)' : 'rgba(79,70,229,0.3)'}`,
            borderRadius: 20,
            padding: '48px 32px',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragActive ? 'rgba(79,70,229,0.08)' : 'rgba(79,70,229,0.03)',
            transition: 'all 250ms',
            marginBottom: 32,
          }}
        >
          <input {...getInputProps()} id="file-upload-input" />
          <motion.div animate={{ y: isDragActive ? -8 : 0 }} transition={{ duration: 0.2 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 18,
              background: isDragActive ? 'linear-gradient(135deg, #4F46E5, #7C3AED)' : 'rgba(79,70,229,0.12)',
              border: '1px solid rgba(79,70,229,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              transition: 'all 250ms',
            }}>
              <Upload size={30} color={isDragActive ? 'white' : '#818CF8'} />
            </div>
            <h3 style={{ marginBottom: 8, color: isDragActive ? '#F1F5F9' : '#94A3B8', fontSize: '1.05rem' }}>
              {isDragActive ? 'Drop your photos here!' : 'Drag & drop photos here'}
            </h3>
            <p style={{ color: '#475569', fontSize: '0.875rem', marginBottom: 16 }}>
              or click to select files
            </p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#141B2D', borderRadius: 8, padding: '6px 14px' }}>
              <FileImage size={13} color="#64748B" />
              <span style={{ color: '#64748B', fontSize: '0.78rem' }}>JPG, PNG, WEBP, BMP · Max 20MB each</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* File Grid */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ color: '#94A3B8', fontSize: '0.875rem' }}>
                <strong style={{ color: '#F1F5F9' }}>{files.length}</strong> file{files.length !== 1 ? 's' : ''} selected · {totalSizeMB} MB total
              </p>
              <button onClick={clearAll} className="btn btn-ghost btn-sm" style={{ gap: 6 }}>
                <Trash2 size={14} /> Clear All
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 16,
              marginBottom: 28,
              maxHeight: 400,
              overflowY: 'auto',
              padding: 4,
            }}>
              {files.map((f) => (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: '#141B2D', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div style={{ aspectRatio: '3/4', position: 'relative' }}>
                    <img
                      src={f.processedPreview || f.preview}
                      alt={f.file.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    
                    {f.status === 'processing' && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Loader2 className="animate-spin text-white" size={24} />
                      </div>
                    )}
                    {f.status === 'done' && (
                      <div style={{ position: 'absolute', top: 4, left: 4, background: '#10B981', borderRadius: '50%', padding: 2 }}>
                        <CheckCircle size={14} color="white" />
                      </div>
                    )}
                    {f.status === 'error' && (
                      <div style={{ position: 'absolute', top: 4, left: 4, background: '#EF4444', borderRadius: '50%', padding: 2 }}>
                        <AlertCircle size={14} color="white" />
                      </div>
                    )}

                    {!f.processedPreview && (
                      <button
                        onClick={() => removeFile(f.id)}
                        style={{
                          position: 'absolute', top: 4, right: 4,
                          background: 'rgba(0,0,0,0.7)', border: 'none',
                          borderRadius: '50%', width: 22, height: 22,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', color: 'white',
                        }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  
                  <div style={{ padding: '8px', background: '#0D1322' }}>
                    <input 
                      type="text" 
                      value={f.customName} 
                      onChange={(e) => updateFileName(f.id, e.target.value)}
                      style={{ 
                        width: '100%', padding: '4px 6px', borderRadius: 4, 
                        border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', 
                        color: '#F1F5F9', fontSize: '0.75rem', marginBottom: 6 
                      }}
                    />
                  </div>
                </motion.div>
              ))}

              {!uploading && !jobResult && (
                <div
                  {...getRootProps()}
                  style={{
                    borderRadius: 10,
                    border: '2px dashed rgba(79,70,229,0.4)',
                    background: isDragActive ? 'rgba(79,70,229,0.1)' : 'rgba(79,70,229,0.03)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    minHeight: 180,
                    transition: 'all 200ms'
                  }}
                >
                  <input {...getInputProps()} id="file-upload-add-more" />
                  <Upload size={24} color="#818CF8" style={{ marginBottom: 8 }} />
                  <span style={{ color: '#818CF8', fontSize: '0.8rem', fontWeight: 600 }}>Add More</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload/Process button */}
      {files.length > 0 && !jobResult && (
        <motion.button
          className="btn btn-primary btn-lg btn-full"
          onClick={handleUpload}
          disabled={uploading}
          whileHover={{ scale: uploading ? 1 : 1.01 }}
          style={{ marginBottom: 24 }}
        >
          {uploading ? (
            <><Loader2 size={18} className="animate-spin" /> {statusMsg} ({uploadPct}%)</>
          ) : (
            <><ImageIcon2 size={18} /> Process Photos</>
          )}
        </motion.button>
      )}

      {/* Upload Progress Bar */}
      {uploading && uploadPct < 100 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#64748B', fontSize: '0.85rem' }}>
              {statusMsg}
            </span>
            <span style={{ color: '#818CF8', fontSize: '0.85rem', fontWeight: 600 }}>{uploadPct}%</span>
          </div>
          <div className="progress-track" style={{ height: 8 }}>
            <div className="progress-fill" style={{ width: `${uploadPct}%`, transition: 'width 0.3s ease' }} />
          </div>
        </div>
      )}

    </div>
  );
}
