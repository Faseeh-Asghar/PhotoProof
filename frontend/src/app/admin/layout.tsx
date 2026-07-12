'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { ImageIcon, Users, BarChart2, Briefcase, LogOut, ChevronRight, Shield, Menu, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const adminNav = [
  { href: '/admin', label: 'Overview', icon: BarChart2 },
  { href: '/admin/users', label: 'Manage Users', icon: Users },
  { href: '/admin/jobs', label: 'All Jobs', icon: Briefcase },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, hydrate, isHydrated, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { hydrate(); }, []);
  useEffect(() => {
    if (isHydrated) {
      if (!user) router.replace('/login');
      else if (user.role !== 'admin') router.replace('/dashboard');
    }
  }, [isHydrated, user]);

  if (!isHydrated || !user || user.role !== 'admin') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #4F46E5', borderTopColor: 'transparent', borderRadius: '50%' }} className="animate-spin" />
      </div>
    );
  }

  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <div style={{
      width: 260, height: '100vh', position: 'sticky', top: 0,
      background: '#070B14',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column', padding: '24px 16px',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
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
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 6, padding: '3px 10px', marginLeft: 46,
          }}>
            <Shield size={11} color="#FCA5A5" />
            <span style={{ color: '#FCA5A5', fontSize: '0.7rem', fontWeight: 700 }}>ADMIN</span>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}>
            <X size={20} />
          </button>
        )}
      </div>

      <div className="divider" style={{ marginBottom: 24 }} />

      <nav style={{ flex: 1 }}>
        {adminNav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} onClick={onClose} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 10, marginBottom: 4,
                background: active ? 'rgba(79,70,229,0.15)' : 'transparent',
                border: active ? '1px solid rgba(79,70,229,0.25)' : '1px solid transparent',
                color: active ? '#818CF8' : '#64748B',
                transition: 'all 200ms', cursor: 'pointer',
              }}>
                <item.icon size={17} />
                <span style={{ fontSize: '0.9rem', fontWeight: active ? 600 : 400 }}>{item.label}</span>
                {active && <ChevronRight size={14} style={{ marginLeft: 'auto' }} />}
              </div>
            </Link>
          );
        })}
      </nav>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 16 }}>
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <div style={{ padding: '10px 14px', color: '#64748B', fontSize: '0.85rem', marginBottom: 8 }}>
            ← User Dashboard
          </div>
        </Link>
        <button
          onClick={() => { logout(); router.push('/login'); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 10, width: '100%',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#64748B', fontSize: '0.9rem',
          }}
        >
          <LogOut size={17} /> Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div className="desktop-sidebar">
        <SidebarContent />
      </div>

      {mobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}
          onClick={() => setMobileOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="mobile-topbar" style={{
          padding: '12px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: '#070B14',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: '#F1F5F9' }}>PhotoProof Admin</span>
          <button onClick={() => setMobileOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
            <Menu size={22} />
          </button>
        </div>

        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{ padding: '32px 36px', flex: 1 }}
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
