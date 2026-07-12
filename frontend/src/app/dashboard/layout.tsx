'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ImageIcon, LayoutDashboard, Upload, FolderOpen,
  Settings, LogOut, Menu, X, ChevronRight, User
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/upload', label: 'Upload Photos', icon: Upload },
  { href: '/dashboard/jobs', label: 'My Jobs', icon: FolderOpen },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div style={{
      width: 260,
      height: '100vh',
      background: '#0D1322',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 16px',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ImageIcon size={18} color="white" />
          </div>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#F1F5F9', fontSize: '1.05rem' }}>
            PhotoProof
          </span>
        </Link>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}>
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1 }}>
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} onClick={onClose} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 10, marginBottom: 4,
                background: active ? 'rgba(79,70,229,0.15)' : 'transparent',
                border: active ? '1px solid rgba(79,70,229,0.25)' : '1px solid transparent',
                color: active ? '#818CF8' : '#64748B',
                transition: 'all 200ms',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { if (!active) (e.currentTarget as any).style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget as any).style.background = 'transparent'; }}
              >
                <item.icon size={17} />
                <span style={{ fontSize: '0.9rem', fontWeight: active ? 600 : 400 }}>{item.label}</span>
                {active && <ChevronRight size={14} style={{ marginLeft: 'auto' }} />}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        paddingTop: 16,
        marginTop: 16,
      }}>
        {/* Quota bar */}
        {user && (
          <div style={{ marginBottom: 16, padding: '12px 14px', background: '#141B2D', borderRadius: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Quota Used</span>
              <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 600 }}>
                {user.imagesProcessed}/{user.quotaLimit}
              </span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${Math.min(100, (user.imagesProcessed / user.quotaLimit) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', marginBottom: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <User size={15} color="white" />
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 10, width: '100%',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#64748B', fontSize: '0.9rem',
            transition: 'all 200ms',
          }}
          onMouseEnter={(e) => { (e.currentTarget as any).style.background = 'rgba(239,68,68,0.08)'; (e.currentTarget as any).style.color = '#FCA5A5'; }}
          onMouseLeave={(e) => { (e.currentTarget as any).style.background = 'transparent'; (e.currentTarget as any).style.color = '#64748B'; }}
        >
          <LogOut size={17} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, hydrate, isHydrated } = useAuthStore();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { hydrate(); }, []);
  useEffect(() => {
    if (isHydrated && !user) router.replace('/login');
  }, [isHydrated, user]);

  if (!isHydrated || !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #4F46E5', borderTopColor: 'transparent', borderRadius: '50%' }} className="animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Desktop Sidebar */}
      <div className="desktop-sidebar">
        <Sidebar />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}
          onClick={() => setMobileOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <Sidebar onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
        {/* Mobile topbar */}
        <div className="mobile-topbar" style={{
          padding: '12px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: '#0D1322',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#F1F5F9' }}>PhotoProof</span>
          <button onClick={() => setMobileOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
            <Menu size={22} />
          </button>
        </div>

        <motion.main
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{ flex: 1, padding: '32px 32px' }}
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
