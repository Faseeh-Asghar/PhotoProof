'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Zap, Shield, ChevronRight, Check,
  ImageIcon, Download, ArrowRight, Layers, X,
  Loader2, FileImage, Users
} from 'lucide-react';
import { uploadApi } from '@/lib/api';
import { processImageLocally, preloadAI } from '@/lib/imageProcessor';
import toast from 'react-hot-toast';

// ─── Data ──────────────────────────────────────────────────────────────────────
const features = [
  { icon: Upload, title: 'Bulk Upload', desc: 'Drop hundreds of photos at once. Process an entire class in seconds.' },
  { icon: Zap, title: 'Instant Processing', desc: 'Sharp-powered resize + white background. No AI delays — pure speed.' },
  { icon: ImageIcon, title: 'Perfect Specs', desc: 'Auto white background, exact 600×800 px, 10–20 KB. Every single time.' },
  { icon: Download, title: 'ZIP Download', desc: 'All processed photos in one ZIP. Ready to submit anywhere.' },
  { icon: Shield, title: 'Secure & Private', desc: 'Manual approval system. Your students\' photos never leave the server.' },
  { icon: Layers, title: 'Built to Scale', desc: 'Built for 1 school or 1,000. The architecture grows with you.' },
];

const steps = [
  { num: '01', title: 'Try Free', desc: 'Upload one photo instantly — no signup. See the result before paying.' },
  { num: '02', title: 'Register & Pay', desc: 'Select your package and pay via JazzCash. Admin activates within 24h.' },
  { num: '03', title: 'Bulk Upload', desc: 'Drag & drop up to 100 student photos at once.' },
  { num: '04', title: 'Download ZIP', desc: 'All processed photos in one ZIP — perfectly formatted.' },
];

// ─── Navbar ────────────────────────────────────────────────────────────────────
function Navbar() {
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      padding: '0 24px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(7,11,20,0.88)',
      backdropFilter: 'blur(20px)',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ImageIcon size={18} color="white" />
          </div>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1.1rem', color: '#F1F5F9' }}>
            PhotoProof
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/login"><button className="btn btn-ghost btn-sm">Login</button></Link>
          <Link href="/register"><button className="btn btn-primary btn-sm">Get Started →</button></Link>
        </div>
      </div>
    </nav>
  );
}

// ─── Guest Upload Widget ───────────────────────────────────────────────────────
function GuestUploadWidget() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (f.size > 20 * 1024 * 1024) { toast.error('Image must be under 20 MB'); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResultUrl(null);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleProcess = async () => {
    if (!file) return;
    setLoading(true);
    setProgressMsg('Initializing AI model...');
    try {
      // Compress the image first to save bandwidth
      const processedFile = await processImageLocally(
        file,
        { width: 600, height: 800, maxSizeKb: 20 },
        (msg) => setProgressMsg(msg)
      );
      
      // Send to high-speed backend AI for background removal
      setProgressMsg('Uploading and removing background (Server AI)...');
      const response = await uploadApi.guestUpload(processedFile);
      
      // response.data is a Blob containing the processed image
      const url = URL.createObjectURL(response.data);
      setResultUrl(url);
      toast.success('✅ Photo processed flawlessly in the cloud!');
    } catch (err: any) {
      console.error(err);
      toast.error('Processing failed — please try a different image.');
    } finally {
      setLoading(false);
      setProgressMsg(null);
    }
  };

  const reset = () => {
    setFile(null); setPreview(null); setResultUrl(null); setProgressMsg(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div style={{
      background: 'rgba(13,19,34,0.9)',
      border: '1px solid rgba(79,70,229,0.25)',
      borderRadius: 20,
      padding: 32,
      maxWidth: 720,
      margin: '0 auto',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: 20, padding: '4px 14px', marginBottom: 12,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
          <span style={{ color: '#10B981', fontSize: '0.78rem', fontWeight: 600 }}>FREE — No signup needed</span>
        </div>
        <h3 style={{ fontSize: '1.15rem', marginBottom: 6 }}>Try It Right Now</h3>
        <p style={{ color: '#64748B', fontSize: '0.875rem' }}>Upload one photo and see the magic instantly</p>
      </div>

      {!resultUrl ? (
        <>
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => !file && inputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? 'rgba(79,70,229,0.8)' : file ? 'rgba(16,185,129,0.4)' : 'rgba(79,70,229,0.3)'}`,
              borderRadius: 14,
              padding: file ? '16px' : '36px 24px',
              textAlign: 'center',
              cursor: file ? 'default' : 'pointer',
              background: isDragging ? 'rgba(79,70,229,0.06)' : 'transparent',
              transition: 'all 250ms',
              marginBottom: 20,
              position: 'relative',
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              id="guest-file-input"
            />

            {file && preview ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center' }}>
                <img src={preview} alt="Preview" style={{ width: 80, height: 107, objectFit: 'cover', borderRadius: 8, border: '2px solid rgba(255,255,255,0.1)' }} />
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontWeight: 600, color: '#F1F5F9', marginBottom: 4, fontSize: '0.9rem' }}>{file.name}</p>
                  <p style={{ color: '#64748B', fontSize: '0.8rem' }}>{(file.size / 1024).toFixed(0)} KB · Ready to process</p>
                </div>
                <button onClick={reset} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', marginLeft: 'auto' }}>
                  <X size={18} />
                </button>
              </div>
            ) : (
              <>
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(79,70,229,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 14px',
                }}>
                  <FileImage size={26} color="#818CF8" />
                </div>
                <p style={{ color: '#94A3B8', fontSize: '0.9rem', marginBottom: 6 }}>Drop your photo here or click to browse</p>
                <p style={{ color: '#475569', fontSize: '0.78rem' }}>JPG, PNG, WEBP · Max 20MB</p>
              </>
            )}
          </div>

          <motion.button
            className="btn btn-primary btn-full"
            onClick={handleProcess}
            disabled={!file || loading}
            whileHover={{ scale: (!file || loading) ? 1 : 1.01 }}
            style={{ gap: 8, fontSize: '0.95rem' }}
          >
            {loading
              ? <><Loader2 size={16} className="animate-spin" /> {progressMsg || 'Processing photo...'}</>
              : <><Zap size={16} /> Process Photo with AI (Free)</>
            }
          </motion.button>

          <p style={{ textAlign: 'center', color: '#334155', fontSize: '0.76rem', marginTop: 12 }}>
            5 free tries per hour · No account needed · Result: 600×800 white background JPEG
          </p>
        </>
      ) : (
        /* Result state */
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#475569', fontSize: '0.75rem', marginBottom: 8 }}>Original</p>
              <img src={preview!} alt="Original" style={{ width: 120, height: 160, objectFit: 'cover', borderRadius: 10, border: '2px solid rgba(255,255,255,0.08)' }} />
            </div>
            <ArrowRight size={24} color="#4F46E5" />
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#10B981', fontSize: '0.75rem', marginBottom: 8, fontWeight: 600 }}>✅ Processed</p>
              <img src={resultUrl} alt="Processed" style={{ width: 120, height: 160, objectFit: 'contain', borderRadius: 10, border: '2px solid rgba(16,185,129,0.3)', background: 'white' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href={resultUrl} download="photoproof_result.jpg" style={{ flex: 1 }}>
              <button className="btn btn-success btn-full" style={{ gap: 8 }}>
                <Download size={16} /> Download Result
              </button>
            </a>
            <button onClick={reset} className="btn btn-ghost" style={{ flex: 1 }}>
              Try Another
            </button>
          </div>

          <div style={{
            marginTop: 20, padding: '16px 20px',
            background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.2)',
            borderRadius: 12, textAlign: 'center',
          }}>
            <p style={{ color: '#818CF8', fontSize: '0.875rem', fontWeight: 600, marginBottom: 4 }}>
              Need to process a whole class?
            </p>
            <p style={{ color: '#64748B', fontSize: '0.8rem', marginBottom: 12 }}>
              Register and get up to 50 photos for 100 Rs, or 100 photos for 200 Rs!
            </p>
            <Link href="/register">
              <button className="btn btn-primary btn-sm">Register Now →</button>
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  useEffect(() => {
    // Silently preload the 40MB AI model in the background as soon as they land on the page
    preloadAI();
  }, []);

  return (
    <div>
      <Navbar />

      {/* ── Hero ── */}
      <section style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center',
        padding: '120px 24px 80px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Background glow */}
        <div style={{
          position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(79,70,229,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: 780, position: 'relative', zIndex: 1 }}>
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(79,70,229,0.1)', border: '1px solid rgba(79,70,229,0.2)',
              borderRadius: 20, padding: '6px 16px', marginBottom: 32,
            }}>
              <Zap size={13} color="#818CF8" />
              <span style={{ color: '#818CF8', fontSize: '0.82rem', fontWeight: 600 }}>School Photo Processing — Automated</span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }}
            style={{ fontSize: 'clamp(2.2rem, 6vw, 3.8rem)', lineHeight: 1.15, marginBottom: 24, fontFamily: 'Syne, sans-serif' }}
          >
            Student Photos,{' '}
            <span style={{
              background: 'linear-gradient(135deg, #818CF8, #A78BFA, #4F46E5)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              Perfect Every Time
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            style={{ fontSize: '1.15rem', color: '#64748B', lineHeight: 1.75, marginBottom: 40, maxWidth: 580, margin: '0 auto 40px' }}
          >
            Upload 100 student photos at once. Automatically get white background,
            600×800 px, 10–20 KB JPEG — ready for forms and admission portals.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 64 }}
          >
            <a href="#try-free">
              <button className="btn btn-primary btn-lg">
                Try It Free
              </button>
            </a>
            <Link href="/register">
              <button className="btn btn-ghost btn-lg" style={{ gap: 8 }}>
                Get Started <ArrowRight size={18} />
              </button>
            </Link>
          </motion.div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { value: '600×800', label: 'Output resolution' },
              { value: '10–20 KB', label: 'File size target' },
              { value: '100 photos', label: 'Per batch upload' },
              { value: '<10 sec', label: 'Per photo' },
            ].map((s) => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.4rem', color: '#F1F5F9' }}>{s.value}</div>
                <div style={{ color: '#475569', fontSize: '0.78rem', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Try Free Section ── */}
      <section id="try-free" style={{ padding: '80px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', marginBottom: 16 }}>
              Try Before You Pay
            </h2>
            <p style={{ color: '#64748B', maxWidth: 480, margin: '0 auto', lineHeight: 1.75 }}>
              No account. No payment. Upload one photo and see the exact result you'll get.
            </p>
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          <GuestUploadWidget />
        </motion.div>
      </section>

      {/* ── Features ── */}
      <section style={{ padding: '80px 24px', background: 'rgba(13,19,34,0.4)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <motion.h2
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', marginBottom: 16 }}
            >
              Everything You Need
            </motion.h2>
            <p style={{ color: '#64748B' }}>Built specifically for Pakistani schools</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                className="card"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                style={{ padding: '28px 24px' }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(79,70,229,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 16,
                }}>
                  <f.icon size={20} color="#818CF8" />
                </div>
                <h3 style={{ fontSize: '1rem', marginBottom: 8 }}>{f.title}</h3>
                <p style={{ color: '#64748B', fontSize: '0.875rem', lineHeight: 1.7 }}>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <motion.h2
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', marginBottom: 12 }}
            >
              How It Works
            </motion.h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 32 }}>
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                style={{ textAlign: 'center', position: 'relative' }}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                  fontFamily: 'Syne, sans-serif', fontWeight: 800, color: 'white', fontSize: '1rem',
                }}>
                  {step.num}
                </div>
                <h3 style={{ fontSize: '1rem', marginBottom: 8 }}>{step.title}</h3>
                <p style={{ color: '#64748B', fontSize: '0.875rem', lineHeight: 1.7 }}>{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" style={{ padding: '80px 24px', background: 'rgba(13,19,34,0.4)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', marginBottom: 12 }}>Simple Pricing</h2>
            <p style={{ color: '#64748B', marginBottom: 48 }}>Pay for what you need. No hidden fees.</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginBottom: 24 }}>
              {/* Plan 1 */}
              <div style={{
                background: 'rgba(26,35,56,0.8)',
                border: '2px solid rgba(79,70,229,0.3)',
                borderRadius: 20,
                padding: '40px 32px',
                position: 'relative',
              }}>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '3.5rem', color: '#F1F5F9', lineHeight: 1 }}>
                    100
                  </span>
                  <span style={{ color: '#64748B', fontSize: '1rem', marginLeft: 6 }}>PKR</span>
                </div>
                <p style={{ color: '#818CF8', fontSize: '1.1rem', fontWeight: 600, marginBottom: 24 }}>Up to 50 Photos</p>
                <div style={{ textAlign: 'left', marginBottom: 32 }}>
                  {[
                    '50 student photos',
                    'Bulk upload processing',
                    'White background, 600×800 px',
                    'ZIP or individual JPEGs download',
                  ].map((item) => (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <Check size={16} color="#10B981" />
                      <span style={{ color: '#94A3B8', fontSize: '0.875rem' }}>{item}</span>
                    </div>
                  ))}
                </div>
                <Link href="/register">
                  <button className="btn btn-primary btn-full">Register & Pay 100 Rs</button>
                </Link>
              </div>

              {/* Plan 2 */}
              <div style={{
                background: 'rgba(26,35,56,0.8)',
                border: '2px solid rgba(79,70,229,0.5)',
                borderRadius: 20,
                padding: '40px 32px',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, -50%)',
                  background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                  borderRadius: 20, padding: '4px 16px',
                }}>
                  <span style={{ color: 'white', fontSize: '0.8rem', fontWeight: 700 }}>Best Value</span>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '3.5rem', color: '#F1F5F9', lineHeight: 1 }}>
                    200
                  </span>
                  <span style={{ color: '#64748B', fontSize: '1rem', marginLeft: 6 }}>PKR</span>
                </div>
                <p style={{ color: '#818CF8', fontSize: '1.1rem', fontWeight: 600, marginBottom: 24 }}>Up to 100 Photos</p>
                <div style={{ textAlign: 'left', marginBottom: 32 }}>
                  {[
                    '100 student photos',
                    'Bulk upload processing',
                    'White background, 600×800 px',
                    'ZIP or individual JPEGs download',
                  ].map((item) => (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <Check size={16} color="#10B981" />
                      <span style={{ color: '#94A3B8', fontSize: '0.875rem' }}>{item}</span>
                    </div>
                  ))}
                </div>
                <Link href="/register">
                  <button className="btn btn-primary btn-full">Register & Pay 200 Rs</button>
                </Link>
              </div>
            </div>

            <div style={{
              marginTop: 24, padding: '24px 20px',
              background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.15)',
              borderRadius: 12,
            }}>
              <p style={{ color: '#F1F5F9', fontWeight: 600, marginBottom: 8 }}>Payment Info</p>
              <p style={{ color: '#10B981', fontSize: '0.9rem', marginBottom: 4 }}>💳 JazzCash: <strong>0303 0934664</strong></p>
              <p style={{ color: '#64748B', fontSize: '0.9rem' }}>💬 WhatsApp for queries: <strong>0306 9136380</strong></p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', marginBottom: 16 }}>
              Ready to Save Hours Every Term?
            </h2>
            <p style={{ color: '#64748B', marginBottom: 32, lineHeight: 1.75 }}>
              PhotoProof processes a full class of 40 students in under a minute.
              Try one photo free — no card, no signup.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="#try-free">
                <button className="btn btn-ghost btn-lg">Try Free First</button>
              </a>
              <Link href="/register">
                <button className="btn btn-primary btn-lg" style={{ gap: 8 }}>
                  Register Now <ArrowRight size={18} />
                </button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '32px 24px',
        textAlign: 'center',
        color: '#334155',
        fontSize: '0.82rem',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ImageIcon size={14} color="white" />
            </div>
            <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#475569' }}>PhotoProof</span>
          </div>
          <p>© {new Date().getFullYear()} PhotoProof. Built for Pakistani schools.</p>
          <div style={{ display: 'flex', gap: 16 }}>
            <Link href="/login" style={{ color: '#334155' }}>Login</Link>
            <Link href="/register" style={{ color: '#334155' }}>Register</Link>
            <a href="mailto:faseehasghar167@gmail.com" style={{ color: '#334155' }}>Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
