'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, CheckCircle, XCircle, RefreshCw,
  ChevronDown, Filter, Loader2, UserCheck, UserX, Edit3
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface User {
  id: string;
  name: string;
  email: string;
  school_name: string;
  status: string;
  images_processed: number;
  quota_limit: number;
  transaction_id: string;
  payment_method: string;
  payment_note: string;
  created_at: string;
  approved_at: string;
  approved_by_name: string;
  total_jobs: number;
  role: string;
}

const STATUS_OPTIONS = ['all', 'pending_approval', 'active', 'suspended', 'pending_payment'];

export default function AdminUsersPage() {
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [quotaEdit, setQuotaEdit] = useState<{ id: string; value: number } | null>(null);
  const [passwordEdit, setPasswordEdit] = useState<{ id: string; value: string } | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 15 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (search) params.search = search;
      const res = await adminApi.users(params);
      setUsers(res.data.users);
      setTotal(res.data.pagination.total);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [page, statusFilter]);
  useEffect(() => {
    const t = setTimeout(() => { fetchUsers(); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleApprove = async (id: string, name: string) => {
    setActionLoading(id + '-approve');
    try {
      await adminApi.approveUser(id, { quotaLimit: 500, sendEmail: true });
      toast.success(`✅ ${name} has been approved and activated`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to approve user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (id: string, name: string) => {
    const reason = prompt(`Reason for suspending ${name}?`);
    if (reason === null) return;
    setActionLoading(id + '-suspend');
    try {
      await adminApi.suspendUser(id, reason || 'No reason provided');
      toast.success(`User ${name} suspended`);
      fetchUsers();
    } catch {
      toast.error('Failed to suspend user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async (id: string, name: string) => {
    setActionLoading(id + '-reactivate');
    try {
      await adminApi.reactivateUser(id);
      toast.success(`User ${name} reactivated`);
      fetchUsers();
    } catch {
      toast.error('Failed to reactivate user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleQuotaUpdate = async (id: string) => {
    if (!quotaEdit) return;
    try {
      await adminApi.updateQuota(id, quotaEdit.value);
      toast.success('Quota updated');
      setQuotaEdit(null);
      fetchUsers();
    } catch {
      toast.error('Failed to update quota');
    }
  };

  const handlePasswordUpdate = async (id: string) => {
    if (!passwordEdit || passwordEdit.value.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    try {
      await adminApi.updatePassword(id, passwordEdit.value);
      toast.success('Password updated successfully');
      setPasswordEdit(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update password');
    }
  };

  const handleRoleUpdate = async (id: string, newRole: string) => {
    try {
      await adminApi.updateRole(id, newRole);
      toast.success(`Role updated to ${newRole}`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update role');
    }
  };

  const statusBadge: any = {
    active: 'badge-active', pending_approval: 'badge-pending',
    suspended: 'badge-suspended', pending_payment: 'badge-pending',
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 8 }}>Manage Users</h1>
        <p style={{ color: '#64748B' }}>Approve, manage quotas, and control access</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={15} color="#475569" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            className="input"
            type="text"
            placeholder="Search name, email, school..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 42 }}
          />
        </div>

        <div style={{ position: 'relative' }}>
          <Filter size={14} color="#475569" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={{ paddingLeft: 36, paddingRight: 36, minWidth: 180 }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
            ))}
          </select>
        </div>

        <button onClick={fetchUsers} className="btn btn-ghost btn-sm" style={{ gap: 6 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* User count */}
      <p style={{ color: '#475569', fontSize: '0.85rem', marginBottom: 16 }}>
        {total} user{total !== 1 ? 's' : ''} found
      </p>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <Loader2 size={28} color="#4F46E5" className="animate-spin" style={{ margin: '0 auto' }} />
        </div>
      ) : (
        <div>
          {users.map((user, i) => (
            <motion.div
              key={user.id}
              className="card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              style={{ marginBottom: 12, padding: '20px 24px' }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', flexWrap: 'wrap' }}
                onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
              >
                {/* Avatar */}
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'white', fontSize: '1.1rem',
                }}>
                  {user.name?.[0]?.toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 600, color: '#F1F5F9', marginBottom: 2 }}>{user.name}</div>
                  <div style={{ fontSize: '0.82rem', color: '#64748B' }}>{user.email}</div>
                  <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: 2 }}>{user.school_name}</div>
                </div>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className={`badge ${statusBadge[user.status] || 'badge-pending'}`}>
                    {user.status?.replace(/_/g, ' ')}
                  </span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: '#94A3B8', fontWeight: 600 }}>
                      {user.images_processed}/{user.quota_limit}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#475569' }}>images</div>
                  </div>
                  <ChevronDown
                    size={16} color="#475569"
                    style={{ transform: expandedUser === user.id ? 'rotate(180deg)' : 'rotate(0)', transition: '200ms' }}
                  />
                </div>
              </div>

              {/* Expanded Details */}
              <AnimatePresence>
                {expandedUser === user.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 16, paddingTop: 16 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: 4 }}>Registered</div>
                          <div style={{ fontSize: '0.875rem', color: '#94A3B8' }}>
                            {new Date(user.created_at).toLocaleDateString('en-PK')}
                          </div>
                        </div>
                        {user.transaction_id && (
                          <div>
                            <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: 4 }}>Transaction ID</div>
                            <div style={{ fontSize: '0.875rem', color: '#94A3B8', fontFamily: 'monospace' }}>{user.transaction_id}</div>
                          </div>
                        )}
                        {user.payment_method && (
                          <div>
                            <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: 4 }}>Payment Method</div>
                            <div style={{ fontSize: '0.875rem', color: '#94A3B8' }}>{user.payment_method}</div>
                          </div>
                        )}
                        {user.payment_note && (
                          <div>
                            <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: 4 }}>Payment Note</div>
                            <div style={{ fontSize: '0.875rem', color: '#94A3B8' }}>{user.payment_note}</div>
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: '0.75rem', color: '#475569', marginBottom: 4 }}>Total Jobs</div>
                          <div style={{ fontSize: '0.875rem', color: '#94A3B8' }}>{user.total_jobs}</div>
                        </div>
                      </div>

                      {/* Quota Editor */}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.82rem', color: '#64748B' }}>Quota:</span>
                        {quotaEdit?.id === user.id ? (
                          <>
                            <input
                              type="number"
                              className="input"
                              value={quotaEdit.value}
                              onChange={(e) => setQuotaEdit({ id: user.id, value: parseInt(e.target.value) })}
                              style={{ width: 100, padding: '6px 12px', fontSize: '0.85rem' }}
                            />
                            <button className="btn btn-success btn-sm" onClick={() => handleQuotaUpdate(user.id)}>Save</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setQuotaEdit(null)}>Cancel</button>
                          </>
                        ) : (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setQuotaEdit({ id: user.id, value: user.quota_limit })}
                            style={{ gap: 6 }}
                          >
                            <Edit3 size={12} /> {user.quota_limit} images
                          </button>
                        )}
                      </div>

                      {/* Password Editor */}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.82rem', color: '#64748B' }}>Password:</span>
                        {passwordEdit?.id === user.id ? (
                          <>
                            <input
                              type="text"
                              className="input"
                              placeholder="New password (min 8)"
                              value={passwordEdit.value}
                              onChange={(e) => setPasswordEdit({ id: user.id, value: e.target.value })}
                              style={{ width: 180, padding: '6px 12px', fontSize: '0.85rem' }}
                            />
                            <button className="btn btn-success btn-sm" onClick={() => handlePasswordUpdate(user.id)}>Save</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setPasswordEdit(null)}>Cancel</button>
                          </>
                        ) : (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setPasswordEdit({ id: user.id, value: '' })}
                            style={{ gap: 6 }}
                          >
                            <Edit3 size={12} /> Reset Password
                          </button>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        {(user.status === 'pending_approval' || user.status === 'pending_payment') && (
                          <button
                            className="btn btn-success"
                            onClick={() => handleApprove(user.id, user.name)}
                            disabled={actionLoading === user.id + '-approve'}
                            style={{ gap: 8 }}
                          >
                            {actionLoading === user.id + '-approve' ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={15} />}
                            Approve & Activate
                          </button>
                        )}
                        {user.status === 'active' && (
                          <button
                            className="btn btn-danger"
                            onClick={() => handleSuspend(user.id, user.name)}
                            disabled={actionLoading === user.id + '-suspend'}
                            style={{ gap: 8 }}
                          >
                            {actionLoading === user.id + '-suspend' ? <Loader2 size={14} className="animate-spin" /> : <UserX size={15} />}
                            Suspend
                          </button>
                        )}
                        {user.status === 'suspended' && (
                          <button
                            className="btn btn-success"
                            onClick={() => handleReactivate(user.id, user.name)}
                            disabled={actionLoading === user.id + '-reactivate'}
                            style={{ gap: 8 }}
                          >
                            {actionLoading === user.id + '-reactivate' ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={15} />}
                            Reactivate
                          </button>
                        )}
                        
                        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)', margin: '0 8px' }} />

                        {user.role === 'admin' ? (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleRoleUpdate(user.id, 'user')}
                            style={{ gap: 8 }}
                          >
                            Demote to User
                          </button>
                        ) : (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleRoleUpdate(user.id, 'admin')}
                            style={{ gap: 8, color: '#818CF8', borderColor: 'rgba(129,140,248,0.3)' }}
                          >
                            Promote to Admin
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}

          {/* Pagination */}
          {total > 15 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 24 }}>
              <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
              <span style={{ color: '#64748B', fontSize: '0.875rem', alignSelf: 'center' }}>Page {page} of {Math.ceil(total / 15)}</span>
              <button className="btn btn-ghost btn-sm" disabled={page >= Math.ceil(total / 15)} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
