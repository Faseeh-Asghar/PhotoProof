'use client';
import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, X, CheckCircle, AlertCircle, Download, FileImage, Trash2, Zap, Loader2, ImageIcon
} from 'lucide-react';
import { uploadApi } from '@/lib/api';
import { processImageLocally } from '@/lib/imageProcessor';
import toast from 'react-hot-toast';

interface FileItem {
  id: string;
  file: File;
  preview: string;
  status: 'ready' | 'uploading' | 'done' | 'error';
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

export default function UploadPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [statusMsg, setStatusMsg] = useState('Processing...');
  const [job, setJob] = useState<JobResult | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

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
        status: 'ready',
      }));
      setFiles((prev) => [...prev, ...newFiles].slice(0, 100));
    },
  });

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const f = prev.find((x) => x.id === id);
      if (f) URL.revokeObjectURL(f.preview);
      return prev.filter((x) => x.id !== id);
    });
  };

  const clearAll = () => {
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles([]);
    setJob(null);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setJob(null);
    setUploadPct(0);

    try {
      toast.success('Preparing files for upload...');
      
      const processedFiles: File[] = [];
      let successCount = 0;
      let failCount = 0;

      // 1. Process files locally
      for (let i = 0; i < files.length; i++) {
        setUploadPct(Math.round(((i) / files.length) * 50)); // 0 to 50% for local processing
        try {
          const pf = await processImageLocally(files[i].file, (status, pct) => {
            setStatusMsg(`Photo ${i + 1}/${files.length}: ${status}`);
          });
          processedFiles.push(pf);
          successCount++;
        } catch (e) {
          console.error('Failed to process', files[i].file.name, e);
          failCount++;
        }
      }

      if (processedFiles.length === 0) {
        throw new Error('All files failed local processing.');
      }

      // 2. Upload processed files (50% to 100%)
      setStatusMsg('Uploading zipped files to server...');
      setUploadPct(50);
      const res = await uploadApi.batch(processedFiles, (pct) => setUploadPct(50 + Math.round(pct / 2)));
      
      const { jobId, downloadUrl } = res.data;

      setJob({
        jobId,
        status: 'completed',
        totalFiles: files.length,
        processedFiles: successCount,
        failedFiles: failCount,
        progress: 100,
        downloadUrl: downloadUrl || null,
      });

      toast.success(`✅ All ${successCount} photos processed & zipped!`);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Upload failed. Please try again.';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const totalSizeMB = (files.reduce((acc, f) => acc + f.file.size, 0) / 1024 / 1024).toFixed(1);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 8 }}>Upload Student Photos</h1>
        <p style={{ color: '#64748B' }}>
          Drop up to 100 photos at once. Each will be automatically resized to 600×800px with a white background.
        </p>
      </div>

      {/* Specs reminder */}
      <div style={{
        display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap',
      }}>
        {[
          { label: 'Output Size', value: '600 × 800 px' },
          { label: 'File Size', value: '10 – 20 KB' },
          { label: 'Background', value: 'Pure White' },
          { label: 'Format', value: 'JPEG' },
        ].map((s) => (
          <div key={s.label} style={{
            background: '#141B2D',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10, padding: '10px 20px',
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <Zap size={13} color="#818CF8" />
            <span style={{ color: '#64748B', fontSize: '0.8rem' }}>{s.label}:</span>
            <span style={{ color: '#F1F5F9', fontSize: '0.85rem', fontWeight: 600 }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Drop Zone */}
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
          marginBottom: 28,
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
            <span style={{ color: '#64748B', fontSize: '0.78rem' }}>JPG, PNG, WEBP, BMP · Max 20MB each · Up to 100 files</span>
          </div>
        </motion.div>
      </div>

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
              maxHeight: 320,
              overflowY: 'auto',
              padding: 4,
            }}>
              {files.map((f) => (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '3/4', background: '#141B2D' }}
                >
                  <img
                    src={f.preview}
                    alt={f.file.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
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
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                    padding: '8px 4px 4px',
                  }}>
                    <p style={{ color: 'white', fontSize: '0.65rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.file.name}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload button */}
      {files.length > 0 && !job && (
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
            <><Upload size={18} /> Process {files.length} Photo{files.length !== 1 ? 's' : ''}</>
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

      {/* Job Status */}
      <AnimatePresence>
        {job && (
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>Processing Job</h4>
                <p style={{ color: '#64748B', fontSize: '0.82rem', fontFamily: 'monospace' }}>
                  #{job.jobId?.slice(0, 12)}...
                </p>
              </div>
              <span className={`badge badge-${job.status}`}>{job.status}</span>
            </div>

            <div style={{ display: 'flex', gap: 32, marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1.6rem', color: '#10B981' }}>
                  {job.processedFiles}
                </div>
                <div style={{ color: '#64748B', fontSize: '0.8rem' }}>Processed</div>
              </div>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1.6rem', color: '#EF4444' }}>
                  {job.failedFiles}
                </div>
                <div style={{ color: '#64748B', fontSize: '0.8rem' }}>Failed</div>
              </div>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1.6rem', color: '#F1F5F9' }}>
                  {job.totalFiles}
                </div>
                <div style={{ color: '#64748B', fontSize: '0.8rem' }}>Total</div>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div className="progress-track" style={{ height: 10 }}>
                <div className="progress-fill" style={{ width: `${job.progress}%` }} />
              </div>
              <p style={{ color: '#64748B', fontSize: '0.8rem', marginTop: 8 }}>{job.progress}% complete</p>
            </div>

            {(job.status === 'completed' || job.status === 'partial') && job.downloadUrl && (
              <a href={uploadApi.downloadUrl(job.jobId)} download>
                <button className="btn btn-success btn-full" style={{ gap: 8 }}>
                  <Download size={18} />
                  Download Processed Photo{files.length === 1 ? '' : 's (ZIP)'}
                </button>
              </a>
            )}

            {job.status === 'processing' || job.status === 'queued' ? (
              <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center z-10 border border-gray-700/50">
                <Loader2 className="w-10 h-10 text-white animate-spin mb-4" />
                <p className="text-white font-medium mb-2">{statusMsg}</p>
                <div className="w-48 h-1.5 bg-gray-800 rounded-full overflow-hidden"></div>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
