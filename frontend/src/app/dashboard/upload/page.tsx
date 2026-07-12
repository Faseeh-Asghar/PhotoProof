'use client';
import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, X, CheckCircle, AlertCircle, Download, FileImage, Trash2, Zap, Loader2, ImageIcon, Image as ImageIcon2
} from 'lucide-react';
import { uploadApi } from '@/lib/api';
import { processImageLocally } from '@/lib/imageProcessor';
import toast from 'react-hot-toast';

interface FileItem {
  id: string;
  file: File;
  preview: string;
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

export default function UploadPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [statusMsg, setStatusMsg] = useState('Processing...');
  const [job, setJob] = useState<JobResult | null>(null);

  const [targetWidth, setTargetWidth] = useState(600);
  const [targetHeight, setTargetHeight] = useState(800);
  const [targetSizeKb, setTargetSizeKb] = useState(20);

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
      setJob(null);
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
    setJob(null);
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setJob(null);
    setUploadPct(0);

    try {
      toast.success('Processing images...');
      
      const pFiles: File[] = [];
      let successCount = 0;
      let failCount = 0;

      // 1. Process files locally and update UI
      const updatedFiles = [...files];
      for (let i = 0; i < updatedFiles.length; i++) {
        setUploadPct(Math.round(((i) / updatedFiles.length) * 50)); 
        updatedFiles[i].status = 'processing';
        setFiles([...updatedFiles]);

        try {
          const pf = await processImageLocally(
            updatedFiles[i].file,
            { width: targetWidth, height: targetHeight, maxSizeKb: targetSizeKb },
            (status, pct) => {
              setStatusMsg(`Photo ${i + 1}/${updatedFiles.length}: ${status}`);
            }
          );
          pFiles.push(pf);
          updatedFiles[i].processedFile = pf;
          updatedFiles[i].processedPreview = URL.createObjectURL(pf);
          updatedFiles[i].status = 'done';
          successCount++;
        } catch (e) {
          console.error('Failed to process', updatedFiles[i].file.name, e);
          updatedFiles[i].status = 'error';
          failCount++;
        }
        setFiles([...updatedFiles]);
      }

      if (pFiles.length === 0) {
        throw new Error('All files failed local processing.');
      }

      // 2. Upload processed files (50% to 100%)
      setStatusMsg('Uploading to server for job tracking & ZIP creation...');
      setUploadPct(50);
      const res = await uploadApi.batch(pFiles, (pct) => setUploadPct(50 + Math.round(pct / 2)));
      
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

      toast.success(`✅ All ${successCount} photos processed!`);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Processing failed. Please try again.';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const downloadAllJpegs = () => {
    files.forEach(f => {
      if (f.status === 'done' && f.processedPreview && f.processedFile) {
        const a = document.createElement('a');
        a.href = f.processedPreview;
        a.download = f.processedFile.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    });
  };

  const totalSizeMB = (files.reduce((acc, f) => acc + f.file.size, 0) / 1024 / 1024).toFixed(1);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 8 }}>Upload Student Photos</h1>
        <p style={{ color: '#64748B' }}>
          Drop up to 100 photos at once. Adjust the processing settings below to change output size and quality.
        </p>
      </div>

      {/* Processing Settings */}
      <div className="card" style={{ padding: 24, marginBottom: 32 }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={18} color="#818CF8" /> Processing Settings
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 32 }}>
          {/* Resolution Width */}
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: '#94A3B8', fontSize: '0.85rem' }}>
              <span>Width (px)</span>
              <span style={{ color: '#F1F5F9', fontWeight: 600 }}>{targetWidth} px</span>
            </label>
            <input type="range" min="100" max="2000" step="10" value={targetWidth} onChange={(e) => setTargetWidth(Number(e.target.value))} style={{ width: '100%', accentColor: '#4F46E5' }} />
          </div>

          {/* Resolution Height */}
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: '#94A3B8', fontSize: '0.85rem' }}>
              <span>Height (px)</span>
              <span style={{ color: '#F1F5F9', fontWeight: 600 }}>{targetHeight} px</span>
            </label>
            <input type="range" min="100" max="2000" step="10" value={targetHeight} onChange={(e) => setTargetHeight(Number(e.target.value))} style={{ width: '100%', accentColor: '#4F46E5' }} />
          </div>

          {/* Max Size */}
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: '#94A3B8', fontSize: '0.85rem' }}>
              <span>Max File Size (KB)</span>
              <span style={{ color: '#F1F5F9', fontWeight: 600 }}>{targetSizeKb} KB</span>
            </label>
            <input type="range" min="10" max="1000" step="5" value={targetSizeKb} onChange={(e) => setTargetSizeKb(Number(e.target.value))} style={{ width: '100%', accentColor: '#4F46E5' }} />
          </div>
        </div>
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
                    
                    {/* Status Overlays */}
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
                  
                  {/* Info Footer */}
                  <div style={{ padding: '8px', background: '#0D1322' }}>
                    <p style={{ color: '#F1F5F9', fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                      {f.file.name}
                    </p>
                    {f.processedFile ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#10B981', fontSize: '0.7rem', fontWeight: 600 }}>
                          {(f.processedFile.size / 1024).toFixed(1)} KB
                        </span>
                        <span style={{ color: '#94A3B8', fontSize: '0.7rem' }}>
                          {targetWidth}x{targetHeight}
                        </span>
                        <a href={f.processedPreview} download={f.processedFile.name} title="Download individual JPEG">
                          <Download size={14} color="#818CF8" style={{ cursor: 'pointer' }} />
                        </a>
                      </div>
                    ) : (
                      <span style={{ color: '#64748B', fontSize: '0.7rem' }}>
                        Original: {(f.file.size / 1024).toFixed(1)} KB
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload/Process button */}
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
            <><ImageIcon2 size={18} /> Process & Generate Previews</>
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

      {/* Job Status & Downloads */}
      <AnimatePresence>
        {job && (
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h4 style={{ marginBottom: 4 }}>Processing Complete!</h4>
                <p style={{ color: '#64748B', fontSize: '0.82rem' }}>
                  Your photos are ready. You can download them individually from the previews above, or in a batch below.
                </p>
              </div>
              <CheckCircle size={28} color="#10B981" />
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={downloadAllJpegs} className="btn btn-primary" style={{ flex: 1, minWidth: 200, gap: 8 }}>
                <ImageIcon2 size={18} />
                Download Direct JPEGs
              </button>
              
              {job.downloadUrl && (
                <a href={uploadApi.downloadUrl(job.jobId)} download style={{ flex: 1, minWidth: 200, display: 'block', textDecoration: 'none' }}>
                  <button className="btn btn-ghost btn-full" style={{ gap: 8, height: '100%' }}>
                    <Download size={18} />
                    Download ZIP Archive
                  </button>
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
