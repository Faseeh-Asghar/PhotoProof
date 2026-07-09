'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Upload, Zap, Shield, Users, ChevronRight, Check,
  ImageIcon, Download, Star, ArrowRight, Layers
} from 'lucide-react';

const features = [
  { icon: Upload, title: 'Bulk Upload', desc: 'Drop hundreds of photos at once. Our system handles them all simultaneously.' },
  { icon: Zap, title: 'Instant Processing', desc: 'AI-powered background removal + resize in seconds. Not minutes.' },
  { icon: ImageIcon, title: 'Perfect Specs', desc: 'Auto white background, exact 600×800 px, 10–20 KB. Every. Single. Time.' },
  { icon: Download, title: 'ZIP Download', desc: 'All processed photos packaged in one ZIP. Ready in seconds.' },
  { icon: Shield, title: 'Secure Access', desc: 'Manual approval system. You control who gets in.' },
  { icon: Layers, title: 'Scalable', desc: 'Built for 1 school or 1,000. The architecture scales with you.' },
];

const plans = [
  { name: 'Starter', price: '2,000', unit: 'PKR/month', quota: '500 images/month', features: ['Bulk upload', 'ZIP download', 'White background', 'Priority support'], popular: false },
  { name: 'School', price: '5,000', unit: 'PKR/month', quota: '2,000 images/month', features: ['Everything in Starter', 'Higher quota', 'Faster processing', 'Email notifications'], popular: true },
  { name: 'District', price: '12,000', unit: 'PKR/month', quota: '10,000 images/month', features: ['Everything in School', 'Unlimited quota', 'Dedicated support', 'Custom branding'], popular: false },
];

const steps = [
  { num: '01', title: 'Register & Pay', desc: 'Create an account, pay via JazzCash or EasyPaisa. Admin activates within 24 hours.' },
  { num: '02', title: 'Upload Photos', desc: 'Drag and drop student photos. Upload up to 100 at once.' },
  { num: '03', title: 'Auto Process', desc: 'Our system removes backgrounds, resizes to 600×800, and compresses to 10–20 KB.' },
  { num: '04', title: 'Download ZIP', desc: 'All processed photos in one ZIP file, ready for use.' },
];

function Navbar() {
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      padding: '0 24px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(7,11,20,0.85)',
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
          <Link href="/login">
            <button className="btn btn-ghost btn-sm">Login</button>
          </Link>
          <Link href="/register">
            <button className="btn btn-primary btn-sm">Get Started →</button>
          </Link>
        </div>
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '120px 24px 80px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow orbs */}
      <div style={{
        position: 'absolute', top: '20%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(79,70,229,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: '70%', left: '20%',
        width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,58,237,0.10) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(79,70,229,0.3)',
          borderRadius: 999, padding: '6px 16px', marginBottom: 32,
        }}>
          <Star size={13} color="#818CF8" fill="#818CF8" />
          <span style={{ color: '#818CF8', fontSize: 13, fontWeight: 600 }}>Built for Schools in Pakistan</span>
        </div>

        {/* Heading */}
        <h1 style={{ marginBottom: 24, maxWidth: 800, margin: '0 auto 24px' }}>
          Professional Student Photos{' '}
          <span className="gradient-text">Processed in Seconds</span>
        </h1>

        <p style={{ fontSize: '1.15rem', maxWidth: 560, margin: '0 auto 40px', lineHeight: 1.7, color: '#94A3B8' }}>
          Upload hundreds of student photos. Get perfect white background,
          600×800 resolution, 10–20 KB size — automatically. Every time.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/register">
            <motion.button
              className="btn btn-primary btn-lg"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              style={{ fontSize: '1rem' }}
            >
              Start Free Trial <ArrowRight size={18} />
            </motion.button>
          </Link>
          <a href="#how-it-works">
            <button className="btn btn-ghost btn-lg" style={{ fontSize: '1rem' }}>
              See How It Works
            </button>
          </a>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 48, justifyContent: 'center', marginTop: 64, flexWrap: 'wrap' }}>
          {[
            { value: '600×800', label: 'Perfect Resolution' },
            { value: '10–20 KB', label: 'Target File Size' },
            { value: '100+', label: 'Photos Per Batch' },
            { value: '24hrs', label: 'Activation Time' },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.75rem', color: '#F1F5F9' }}>{s.value}</div>
              <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="section">
      <div className="page-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }}
          style={{ textAlign: 'center', marginBottom: 64 }}
        >
          <h2>Everything You Need</h2>
          <p style={{ marginTop: 16, maxWidth: 500, margin: '16px auto 0' }}>
            A complete photo processing system built specifically for school administrators and photographers.
          </p>
        </motion.div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 24,
        }}>
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              className="card card-hover"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'rgba(79,70,229,0.12)',
                border: '1px solid rgba(79,70,229,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16,
              }}>
                <f.icon size={22} color="#818CF8" />
              </div>
              <h4 style={{ marginBottom: 8, color: '#F1F5F9' }}>{f.title}</h4>
              <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="section" style={{ background: 'rgba(13,19,34,0.5)' }}>
      <div className="page-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 64 }}
        >
          <h2>How It Works</h2>
          <p style={{ marginTop: 16 }}>Simple 4-step process</p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 32 }}>
          {steps.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              style={{ textAlign: 'center' }}
            >
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(79,70,229,0.2), rgba(124,58,237,0.2))',
                border: '2px solid rgba(79,70,229,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
                fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.2rem',
                color: '#818CF8',
              }}>
                {s.num}
              </div>
              <h4 style={{ marginBottom: 10, color: '#F1F5F9' }}>{s.title}</h4>
              <p style={{ fontSize: '0.9rem', lineHeight: 1.7 }}>{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="pricing" className="section">
      <div className="page-container">
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} style={{ textAlign: 'center', marginBottom: 64 }}
        >
          <h2>Simple Pricing</h2>
          <p style={{ marginTop: 16 }}>Pay via JazzCash or EasyPaisa. Activate within 24 hours.</p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, maxWidth: 960, margin: '0 auto' }}>
          {plans.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              style={{
                background: p.popular ? 'linear-gradient(135deg, rgba(79,70,229,0.15), rgba(124,58,237,0.10))' : '#1A2338',
                border: p.popular ? '2px solid rgba(79,70,229,0.5)' : '1px solid rgba(255,255,255,0.06)',
                borderRadius: 20,
                padding: 32,
                position: 'relative',
              }}
            >
              {p.popular && (
                <div style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                  color: 'white', padding: '4px 16px', borderRadius: 999,
                  fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                }}>
                  Most Popular
                </div>
              )}

              <div style={{ marginBottom: 8, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1.1rem', color: '#F1F5F9' }}>{p.name}</div>
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '2rem', color: '#F1F5F9' }}>PKR {p.price}</span>
                <span style={{ color: '#64748B', fontSize: '0.85rem' }}> /{p.unit.split('/')[1]}</span>
              </div>
              <div style={{ color: '#818CF8', fontSize: '0.85rem', marginBottom: 24 }}>{p.quota}</div>

              <ul style={{ listStyle: 'none', marginBottom: 28 }}>
                {p.features.map((feat) => (
                  <li key={feat} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, fontSize: '0.9rem', color: '#94A3B8' }}>
                    <Check size={15} color="#10B981" /> {feat}
                  </li>
                ))}
              </ul>

              <Link href="/register">
                <button className={`btn btn-full ${p.popular ? 'btn-primary' : 'btn-ghost'}`}>
                  Get Started
                </button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="section">
      <div className="page-container">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          style={{
            background: 'linear-gradient(135deg, rgba(79,70,229,0.15), rgba(124,58,237,0.10))',
            border: '1px solid rgba(79,70,229,0.3)',
            borderRadius: 24,
            padding: '64px 48px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute', top: '-50%', left: '50%', transform: 'translateX(-50%)',
            width: 400, height: 400, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(79,70,229,0.2) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <h2 style={{ marginBottom: 16 }}>Ready to Process Your Photos?</h2>
          <p style={{ maxWidth: 480, margin: '0 auto 40px', lineHeight: 1.7 }}>
            Join schools and photographers already using PhotoProof to process thousands of student photos every month.
          </p>
          <Link href="/register">
            <motion.button
              className="btn btn-primary btn-lg"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              Register Now — It's Free to Start <ChevronRight size={18} />
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid rgba(255,255,255,0.06)',
      padding: '40px 24px',
      textAlign: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ImageIcon size={14} color="white" />
        </div>
        <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#F1F5F9' }}>PhotoProof</span>
      </div>
      <p style={{ color: '#475569', fontSize: '0.85rem' }}>
        © {new Date().getFullYear()} PhotoProof. All rights reserved.{' '}
        <Link href="/login" style={{ color: '#64748B' }}>Login</Link>
        {' · '}
        <Link href="/register" style={{ color: '#64748B' }}>Register</Link>
      </p>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <PricingSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
