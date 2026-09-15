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
  const [isMobile, setIsMobile] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  useEffect(() => {
    setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768);
  }, []);

  // Mobile: download each processed photo individually (goes to Downloads/Gallery)
  const downloadAllMobile = async () => {
    const done = files.filter(f => f.status === 'done' && f.processedPreview);
    if (!done.length) { toast.error('No processed photos to download'); return; }
    setDownloadingAll(true);
    toast.success(`Downloading ${done.length} photos…`);
    for (let i = 0; i < done.length; i++) {
      try {
        const res  = await fetch(done[i].processedPreview!);
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = done[i].customName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        // Small delay so the browser doesn't block multiple downloads
        await new Promise(r => setTimeout(r, 900));
      } catch { /* skip failed */ }
    }
    setDownloadingAll(false);
    toast.success('All photos downloaded!');
  };

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
    if (!user) return;
    
    // Quota check early
    const remaining = user.quotaLimit - user.imagesProcessed;
    if (remaining < files.length) {
      toast.error(`Quota exceeded! You can only process ${Math.max(0, remaining)} more images.`);
      return;
    }

    setUploading(true);
    setJobResult(null);
    setUploadPct(0);

    try {
      toast.success('Starting local AI processing...');
      
      const processedFilesList: File[] = [];
      let successCount = 0;
      let failCount = 0;

      // 1. Process all files locally in the browser
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setFiles(prev => prev.map(item => item.id === f.id ? { ...item, status: 'processing' } : item));
        setUploadPct(Math.round(((i) / files.length) * 70)); // 0-70% for processing phase
        
        try {
          // Dynamic import to avoid SSR issues with canvas/wasm
          const { processImageLocally } = await import('@/lib/processImage');
          const finalBlob = await processImageLocally(f.file, targetWidth, targetHeight, targetSizeKb, (msg) => {
            setStatusMsg(`[${i + 1}/${files.length}] ${msg}`);
          });

          const previewUrl = URL.createObjectURL(finalBlob);
          const customName = f.customName.endsWith('.jpg') || f.customName.endsWith('.jpeg') ? f.customName : `${f.customName.split('.')[0]}.jpeg`;
          const finalFile = new File([finalBlob], customName, { type: 'image/jpeg' });
          
          processedFilesList.push(finalFile);
          
          setFiles(prev => prev.map(item => item.id === f.id ? { 
            ...item, 
            status: 'done',
            processedPreview: previewUrl
          } : item));
          successCount++;

        } catch (err: any) {
          console.error(`Failed to process ${f.customName}:`, err);
          setFiles(prev => prev.map(item => item.id === f.id ? { ...item, status: 'error' } : item));
          failCount++;
        }
      }

      if (successCount === 0) {
        throw new Error('All images failed to process. Please try uploading clearer photos.');
      }

      // 2. Upload the processed JPEGs to the backend to get a ZIP and update Job History
      setStatusMsg('Uploading finished images to server...');
      setUploadPct(80);

      const res = await uploadApi.batchProcessed(processedFilesList, (pct) => setUploadPct(80 + Math.round(pct * 0.2)));
      
      const { jobId, downloadUrl } = res.data;

      setJobResult({
        jobId,
        status: 'completed',
        totalFiles: files.length,
        processedFiles: successCount,
        failedFiles: failCount,
        progress: 100,
        downloadUrl: downloadUrl || null,
      });

      toast.success(`✅ Successfully processed ${successCount} photos!`);
      refreshUser();
      loadJobs();

    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Processing failed. Please try again.';
      toast.error(msg);
    } finally {
      setUploading(false);
      setUploadPct(100);
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
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-xl md:text-3xl font-bold mb-1">
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm md:text-base text-slate-500">Upload photos below to remove their background.</p>
        </div>
        <div className="bg-slate-900 px-4 py-2 md:px-5 md:py-3 rounded-xl border border-white/5 flex flex-row md:flex-col items-center md:items-start justify-between">
          <span className="text-slate-400 text-xs md:text-sm block">Monthly Quota</span>
          <span className="text-lg md:text-xl font-bold text-slate-100">
            {user?.imagesProcessed} <span className="text-slate-500 font-medium">/ {user?.quotaLimit}</span>
          </span>
        </div>
      </div>

      {/* Processing Settings */}
      <div className="card" style={{ padding: 24, marginBottom: 32 }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={18} color="#818CF8" /> Output Settings
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block mb-2 text-slate-400 text-xs sm:text-sm">Dimensions (W x H)</label>
            <div className="flex gap-2">
               <input type="number" value={targetWidth} onChange={(e) => setTargetWidth(Number(e.target.value))} className="flex-1 p-2 rounded-lg border border-white/10 bg-black/30 text-slate-100 text-center min-w-[60px]" placeholder="W" />
               <span className="text-slate-500 self-center">x</span>
               <input type="number" value={targetHeight} onChange={(e) => setTargetHeight(Number(e.target.value))} className="flex-1 p-2 rounded-lg border border-white/10 bg-black/30 text-slate-100 text-center min-w-[60px]" placeholder="H" />
            </div>
          </div>
          <div>
            <label className="block mb-2 text-slate-400 text-xs sm:text-sm">Max File Size (KB)</label>
            <input type="number" value={targetSizeKb} onChange={(e) => setTargetSizeKb(Number(e.target.value))} className="w-full p-2 rounded-lg border border-white/10 bg-black/30 text-slate-100 text-center" placeholder="KB" />
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
              gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
              gap: 12,
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
                      style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000000' }}
                    />
                    
                    {f.status === 'processing' && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Loader2 className="animate-spin text-white" size={24} />
                      </div>
                    )}
                    {f.status === 'done' && (
                      <>
                        <div style={{ position: 'absolute', top: 4, left: 4, background: '#10B981', borderRadius: '50%', padding: 2 }}>
                          <CheckCircle size={14} color="white" />
                        </div>
                        {f.processedPreview && (
                          <a
                            href={f.processedPreview}
                            download={f.customName}
                            target="_blank" rel="noreferrer"
                            style={{
                              position: 'absolute', top: 4, right: 4,
                              background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.2)',
                              borderRadius: '50%', width: 24, height: 24,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', color: '#10B981', textDecoration: 'none'
                            }}
                            title="Download Photo"
                          >
                            <Download size={12} />
                          </a>
                        )}
                      </>
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

      {/* Download Result Box */}
      {jobResult && jobResult.downloadUrl && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: 32, padding: 24, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 16, textAlign: 'center' }}
        >
          <CheckCircle size={40} color="#10B981" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.25rem', color: '#F1F5F9', marginBottom: 8 }}>Processing Complete!</h3>
          <p style={{ color: '#94A3B8', marginBottom: 20 }}>
            Successfully processed {jobResult.processedFiles} of {jobResult.totalFiles} photos.
          </p>
          <a
            href={uploadApi.downloadUrl(jobResult.jobId)}
            target="_blank" rel="noreferrer"
            className="btn btn-primary btn-lg"
            style={{ display: 'inline-flex', background: '#10B981', color: '#000', border: 'none', gap: 8, fontWeight: 700 }}
          >
            <Download size={20} /> Download All as ZIP
          </a>
        </motion.div>
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
