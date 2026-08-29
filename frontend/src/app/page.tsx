'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Upload, Loader2, X, Download, ArrowRight, Check, ImageIcon } from 'lucide-react';
import { uploadApi } from '@/lib/api';
import toast from 'react-hot-toast';

// ─── Guest Upload ──────────────────────────────────────────────────────────────
function GuestUploadWidget() {
  const [file, setFile]           = useState<File | null>(null);
  const [preview, setPreview]     = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState('result.jpg');
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) { toast.error('Select an image file'); return; }
    if (f.size > 20 * 1024 * 1024)   { toast.error('Max 20 MB');             return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResultUrl(null);
    setDownloadName(f.name.replace(/\.[^/.]+$/, '') + '_processed.jpg');
  };

  const handleProcess = async () => {
    if (!file) return;
    const uses = parseInt(localStorage.getItem('guest_uses') || '0', 10);
    if (uses >= 3) { toast.error('Free limit reached (3). Please sign up.'); return; }

    setLoading(true);
    setProgressMsg('Uploading…');
    try {
      const bmp = await createImageBitmap(file);
      let w = bmp.width, h = bmp.height;
      if (Math.max(w, h) > 1024) { const r = 1024 / Math.max(w, h); w = Math.round(w * r); h = Math.round(h * r); }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')?.drawImage(bmp, 0, 0, w, h);
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.9));
      const raw  = blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file;

      setProgressMsg('AI Processing…');
      const res = await uploadApi.guestUpload(raw);
      setResultUrl(URL.createObjectURL(res.data));
      localStorage.setItem('guest_uses', (uses + 1).toString());
      toast.success('Done!');
    } catch (err: any) {
      let msg = 'Processing failed.';
      if (err.response?.data instanceof Blob) {
        try { const j = JSON.parse(await err.response.data.text()); if (j.error) msg = j.error; } catch {}
      } else if (err.response?.data?.error) msg = err.response.data.error;
      toast.error(msg);
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  const reset = () => {
    setFile(null); setPreview(null); setResultUrl(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)',
      padding: 24,
      maxWidth: 560,
      margin: '0 auto',
    }}>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />

      {!resultUrl ? (
        <>
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => !file && inputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? 'var(--brand-primary)' : file ? 'var(--brand-success)' : 'var(--border-default)'}`,
              borderRadius: 'var(--radius-md)',
              padding: file ? 16 : '32px 20px',
              textAlign: 'center',
              cursor: file ? 'default' : 'pointer',
              background: isDragging ? 'rgba(37,99,235,0.04)' : 'var(--bg-elevated)',
              marginBottom: 16,
              transition: 'all var(--transition-fast)',
            }}
          >
            {file && preview ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <img src={preview} alt="" style={{ width: 56, height: 75, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-subtle)' }} />
                <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 2 }}>{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                <button onClick={e => { e.stopPropagation(); reset(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <Upload size={28} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 4 }}>Drop photo here or click to browse</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>JPG, PNG, WEBP · Max 20 MB</p>
              </>
            )}
          </div>

          <button
            className="btn btn-primary btn-full"
            onClick={handleProcess}
            disabled={!file || loading}
          >
            {loading
              ? <><Loader2 size={15} className="animate-spin" /> {progressMsg}</>
              : 'Process Photo (Free)'
            }
          </button>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 10 }}>
            3 free tries · No signup required
          </p>
        </>
      ) : (
        <>
          {/* Result */}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: 6 }}>Original</p>
              <img src={preview!} alt="Original" style={{ width: 100, height: 133, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-subtle)' }} />
            </div>
            <ArrowRight size={20} color="var(--text-muted)" style={{ alignSelf: 'center' }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--brand-success)', fontSize: '0.72rem', marginBottom: 6 }}>✓ Processed</p>
              <img src={resultUrl} alt="Processed" style={{ width: 100, height: 133, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border-subtle)', background: '#fff' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <a href={resultUrl} download={downloadName} style={{ flex: 1 }}>
              <button className="btn btn-success btn-full"><Download size={14} /> Download</button>
            </a>
            <button className="btn btn-ghost" onClick={reset} style={{ flex: 1 }}>Try Another</button>
          </div>

          <div style={{
            marginTop: 16, padding: '14px 16px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
          }}>
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem', marginBottom: 6 }}>Need bulk processing?</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 12 }}>
              50 photos — 100 Rs &nbsp;|&nbsp; 100 photos — 200 Rs
            </p>
            <Link href="/register">
              <button className="btn btn-primary btn-sm">Register Now</button>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Navbar */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 20px',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ImageIcon size={20} color="var(--brand-primary)" />
            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>PhotoProof</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/login"><button className="btn btn-ghost btn-sm">Login</button></Link>
            <Link href="/register"><button className="btn btn-primary btn-sm">Register</button></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main style={{ flex: 1, padding: '48px 20px 64px', maxWidth: 900, margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1 style={{ marginBottom: 10 }}>Student Photo Processing</h1>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', maxWidth: 440, margin: '0 auto 8px' }}>
            Upload student photos — get white background, 600×800 px, ready to submit.
          </p>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Try one photo free below, no account needed.
          </p>
        </div>

        {/* Guest Upload */}
        <GuestUploadWidget />

        {/* How it works — minimal */}
        <div style={{ marginTop: 56, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, textAlign: 'center' }}>
          {[
            { num: '1', text: 'Try one photo free' },
            { num: '2', text: 'Register & pay via JazzCash' },
            { num: '3', text: 'Upload up to 100 photos' },
            { num: '4', text: 'Download ZIP' },
          ].map(s => (
            <div key={s.num} style={{ padding: '16px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--brand-primary)', color: '#fff', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>{s.num}</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0 }}>{s.text}</p>
            </div>
          ))}
        </div>

        {/* Pricing */}
        <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {[
            { price: '100 Rs', photos: '50 photos' },
            { price: '200 Rs', photos: '100 photos' },
          ].map(p => (
            <div key={p.price} style={{ padding: 20, background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
              <p style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>{p.price}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 14 }}>{p.photos}</p>
              {[
                'White background, 600×800 px',
                'Bulk upload',
                'ZIP download',
              ].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, justifyContent: 'center' }}>
                  <Check size={13} color="var(--brand-success)" />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{f}</span>
                </div>
              ))}
              <Link href="/register">
                <button className="btn btn-primary btn-sm" style={{ marginTop: 12, width: '100%' }}>Get Started</button>
              </Link>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div style={{ marginTop: 32, padding: '16px 20px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
            💳 JazzCash: <strong style={{ color: 'var(--text-primary)' }}>0303 0934664</strong>
            &nbsp;&nbsp;|&nbsp;&nbsp;
            💬 WhatsApp: <strong style={{ color: 'var(--text-primary)' }}>0306 9136380</strong>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px 20px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>
          © {new Date().getFullYear()} PhotoProof &nbsp;·&nbsp;
          <Link href="/login" style={{ color: 'var(--text-muted)' }}>Login</Link>
          &nbsp;·&nbsp;
          <Link href="/register" style={{ color: 'var(--text-muted)' }}>Register</Link>
          &nbsp;·&nbsp;
          <a href="mailto:faseehasghar167@gmail.com" style={{ color: 'var(--text-muted)' }}>Contact</a>
        </p>
      </footer>
    </div>
  );
}
