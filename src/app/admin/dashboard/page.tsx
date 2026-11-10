'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Participant } from '@/lib/types';
import { Users, UserCheck, UserX, Download, Search, QrCode, LogOut, RefreshCw, Sparkles, Filter, Trash2, Loader2, Upload, Plus, Edit3, Image, Copy, CheckCircle2, AlertCircle, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { secureFetch } from '@/lib/csrfClient';
import GardenFrame from '@/components/GardenFrame';
import Dialog from '@/components/Dialog';
import OrderingSettingsPanel from '@/components/OrderingSettingsPanel';

interface NominasiTeam {
  id: string;
  namaTeam: string;
  qrToken: string;
  isCheckedIn: boolean;
  checkedInAt: string | null;
  createdAt: string;
  members: NominasiTeamMember[];
}

interface NominasiTeamMember {
  id: string;
  nimNip: string;
  nama: string;
  isCheckedIn: boolean;
  checkedInAt: string | null;
}

interface StudentImportPreview {
  batchId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateNims: number;
  emptyNames: number;
  invalidNims: number;
  errors: string[];
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [target, setTarget] = useState<Participant | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmRollback, setConfirmRollback] = useState(false);

  // Student import state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [previewData, setPreviewData] = useState<StudentImportPreview | null>(null);
  const [commitLoading, setCommitLoading] = useState(false);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [activeBatch, setActiveBatch] = useState<{
    batchId: string;
    createdAt: string;
    count: number;
    canRollback: boolean;
  } | null>(null);

  // Nominasi team state
  const [nominasiTeams, setNominasiTeams] = useState<NominasiTeam[]>([]);
  const [nominasiLoading, setNominasiLoading] = useState(false);
  const [showNominasiDialog, setShowNominasiDialog] = useState(false);
  const [nominasiDialogMode, setNominasiDialogMode] = useState<'create' | 'edit'>('create');
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [teamNama, setTeamNama] = useState('');
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [checkinResult, setCheckinResult] = useState<{
    status: 'idle' | 'success' | 'warning' | 'error';
    message: string;
    team?: NominasiTeam;
  }>({ status: 'idle', message: '' });

  const fetchParticipants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/participants');
      if (res.status === 401) {
        router.push('/admin/login');
        return;
      }
      const data = await res.json();
      if (data.participants) {
        setParticipants(data.participants);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  const fetchNominasiTeams = useCallback(async () => {
    setNominasiLoading(true);
    try {
      const res = await secureFetch('/api/admin/nominasi/teams');
      if (res.status === 401) {
        router.push('/admin/login');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setNotice(data.error || 'Gagal mengambil daftar tim nominasi.');
        return;
      }
      const data = await res.json();
      setNominasiTeams(data.teams || []);
    } catch (err) {
      console.error(err);
      setNotice('Koneksi gagal saat memuat tim nominasi.');
    } finally {
      setNominasiLoading(false);
    }
  }, [router]);

  const fetchActiveBatch = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/student-imports/active');
      if (res.status === 401) return;
      const data = await res.json();
      if (!res.ok) {
        setNotice(data.error || 'Gagal mengambil informasi batch aktif.');
        return;
      }
      if (data.active) {
        setActiveBatch({
          batchId: data.batchId,
          createdAt: data.createdAt,
          count: data.count,
          canRollback: data.canRollback,
        });
      } else {
        setActiveBatch(null);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchParticipants();
      void fetchActiveBatch();
      void fetchNominasiTeams();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchParticipants, fetchActiveBatch, fetchNominasiTeams]);

  const totalRegistered = participants.length;
  const totalCheckedIn = participants.filter((p) => p.isCheckedIn).length;
  const totalRemaining = totalRegistered - totalCheckedIn;
  const attendanceRate = totalRegistered > 0 ? Math.round((totalCheckedIn / totalRegistered) * 100) : 0;

  const filteredList = participants.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.nimNip.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'ALL' || p.role === roleFilter;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'CHECKED_IN' && p.isCheckedIn) ||
      (statusFilter === 'NOT_CHECKED_IN' && !p.isCheckedIn);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleLogout = async () => {
    await secureFetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  const handleDelete = async (participant: Participant) => {
    setDeletingId(participant.id);
    try {
      const res = await secureFetch(`/api/admin/participants/${participant.id}`, { method: 'DELETE' });
      if (res.status === 401) {
        router.push('/admin/login');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setNotice(data.error || 'Gagal menghapus peserta.');
        return;
      }
      setTarget(null);
      await fetchParticipants();
    } catch {
      setNotice('Koneksi gagal saat menghapus peserta.');
    } finally {
      setDeletingId(null);
    }
  };

  const handlePreviewImport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setImportLoading(true);
    setPreviewData(null);

    const formData = new FormData(e.currentTarget);
    const sistemInformasi = formData.get('sistemInformasi');
    const informatika = formData.get('informatika');
    const teknologiInformasi = formData.get('teknologiInformasi');
    if (!(sistemInformasi instanceof File) || !(informatika instanceof File) || !(teknologiInformasi instanceof File)) {
      setImportLoading(false);
      setNotice('Pilih ketiga file Excel terlebih dahulu.');
      return;
    }

    try {
      const res = await secureFetch('/api/admin/student-imports/preview', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Gagal memproses file');
      }

      const data = await res.json();
      setPreviewData(data);
    } catch (err) {
      setNotice((err as Error).message || 'Gagal memproses file');
    } finally {
      setImportLoading(false);
    }
  };

  const handleCommitImport = async () => {
    if (!previewData || previewData.invalidRows > 0 || previewData.validRows === 0 || previewData.errors.length > 0) return;

    setCommitLoading(true);
    try {
      const res = await secureFetch('/api/admin/student-imports/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: previewData.batchId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) setPreviewData(null);
        throw new Error(data.error || 'Gagal menyimpan data');
      }

      setShowImportDialog(false);
      setPreviewData(null);
      await fetchActiveBatch();
      setNotice('Data mahasiswa berhasil disimpan!');
    } catch (err) {
      setNotice((err as Error).message || 'Gagal menyimpan data');
    } finally {
      setCommitLoading(false);
    }
  };

  const handleRollback = async () => {
    setRollbackLoading(true);
    try {
      const res = await secureFetch('/api/admin/student-imports/rollback', {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Gagal melakukan rollback');
      }

      const data = await res.json();
      await fetchActiveBatch();
      setConfirmRollback(false);
      setNotice(`Rollback berhasil ke batch ${data.previousBatchId} (${data.count} mahasiswa)`);
    } catch (err) {
      setNotice((err as Error).message || 'Gagal melakukan rollback');
    } finally {
      setRollbackLoading(false);
    }
  };

  // --- Nominasi Team Handlers ---

  const openCreateTeamDialog = () => {
    setNominasiDialogMode('create');
    setEditingTeamId(null);
    setTeamNama('');
    setTeamMembers([]);
    setShowNominasiDialog(true);
  };

  const openEditTeamDialog = (team: NominasiTeam) => {
    setNominasiDialogMode('edit');
    setEditingTeamId(team.id);
    setTeamNama(team.namaTeam);
    setTeamMembers(team.members.map((m) => m.nimNip));
    setShowNominasiDialog(true);
  };

  const handleSaveTeam = async () => {
    if (!teamNama.trim()) {
      setNotice('Nama tim harus diisi.');
      return;
    }
    if (teamMembers.length === 0) {
      setNotice('Pilih minimal satu anggota tim.');
      return;
    }

    setNominasiLoading(true);
    try {
      if (nominasiDialogMode === 'create') {
        const res = await secureFetch('/api/admin/nominasi/teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ namaTeam: teamNama.trim(), memberNims: teamMembers }),
        });
        if (res.status === 401) {
          router.push('/admin/login');
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Gagal membuat tim.');
        }
        const data = await res.json();
        setCheckinResult({ status: 'success', message: `Tim "${data.team.namaTeam}" berhasil dibuat.`, team: data.team });
      } else {
        if (!editingTeamId) throw new Error('ID tim tidak valid.');
        const res = await secureFetch(`/api/admin/nominasi/teams/${editingTeamId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ namaTeam: teamNama.trim(), memberNims: teamMembers }),
        });
        if (res.status === 401) {
          router.push('/admin/login');
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Gagal memperbarui tim.');
        }
        const data = await res.json();
        setCheckinResult({ status: 'success', message: `Tim "${data.team.namaTeam}" berhasil diperbarui.`, team: data.team });
      }
      setShowNominasiDialog(false);
      await fetchNominasiTeams();
    } catch (err) {
      setNotice((err as Error).message || 'Gagal menyimpan tim nominasi.');
    } finally {
      setNominasiLoading(false);
    }
  };

  const handleDeleteTeam = async (id: string, namaTeam: string) => {
    if (!confirm(`Hapus tim "${namaTeam}"? Semua anggota dan QR-nya akan hilang.`)) return;
    setNominasiLoading(true);
    try {
      const res = await secureFetch(`/api/admin/nominasi/teams/${id}`, { method: 'DELETE' });
      if (res.status === 401) {
        router.push('/admin/login');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Gagal menghapus tim.');
      }
      await fetchNominasiTeams();
      setNotice(`Tim "${namaTeam}" berhasil dihapus.`);
    } catch (err) {
      setNotice((err as Error).message || 'Gagal menghapus tim nominasi.');
    } finally {
      setNominasiLoading(false);
    }
  };

  const handleTeamCheckIn = async (qrToken: string, namaTeam: string) => {
    setNominasiLoading(true);
    try {
      const res = await secureFetch('/api/admin/nominasi/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken }),
      });
      if (res.status === 401) {
        router.push('/admin/login');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setCheckinResult({ status: 'success', message: data.message, team: data.team });
        await fetchNominasiTeams();
      } else {
        setCheckinResult({ status: 'warning', message: data.message, team: data.team });
      }
    } catch (err) {
      setNotice((err as Error).message || 'Gagal memproses check-in tim.');
    } finally {
      setNominasiLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-transparent text-ink p-4 sm:p-6 lg:p-8 overflow-hidden">
      <GardenFrame variant="subtle" />
      <div className="relative z-10 max-w-7xl mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-bloom-pink/20 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-bloom-pink" />
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-bloom-pink">
                Admin Rekapitulasi
              </span>
            </div>
            <h1 className="font-cinzel text-2xl sm:text-3xl font-bold text-ivory">
              Dashboard Kehadiran Acara
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchParticipants}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-card border border-bloom-pink/30 text-xs font-semibold text-bloom-pink hover:bg-surface-card transition-colors cursor-pointer"
              title="Perbarui Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download from API route */}
            <a
              href="/api/admin/participants?format=csv"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-bloom-pink text-on-accent text-xs font-bold hover:bg-bloom-pink-deep transition-colors shadow-md"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </a>

            <button
              onClick={() => setShowImportDialog(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-card border border-gold/40 text-gold text-xs font-bold hover:bg-surface-card transition-colors shadow-md"
            >
              <Upload className="w-3.5 h-3.5" />
              Unggah Data Mahasiswa
            </button>

            <Link
              href="/admin/scan"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-card border border-gold/40 text-gold text-xs font-bold hover:bg-surface-card transition-colors shadow-md"
            >
              <QrCode className="w-3.5 h-3.5" />
              Buka Scanner
            </Link>

            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 hover:bg-red-900/40 transition-colors text-xs"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <OrderingSettingsPanel />

        {/* Nominasi Team Panel */}
        <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-surface-card to-surface-card-2 border border-bloom-pink/25 shadow-[0_0_30px_rgba(183,156,232,0.15)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-cinzel text-xl font-bold text-ivory tracking-wide">
                Kehadiran Nominasi Tim
              </h3>
              <p className="text-[10px] text-ink/60 font-light mt-1">
                Buat tim nominasi dengan satu QR. Saat QR dipindai, semua anggota tim tercatat hadir.
              </p>
            </div>
            <button
              onClick={openCreateTeamDialog}
              disabled={nominasiLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-bloom-pink hover:bg-bloom-pink-deep text-on-accent font-bold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              Buat Tim
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-card text-gold uppercase tracking-wider font-semibold border-b border-bloom-pink/20">
                <tr>
                  <th className="py-3 px-4">Nama Tim</th>
                  <th className="py-3 px-4">Jumlah Anggota</th>
                  <th className="py-3 px-4">QR Code</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {nominasiLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-ink/50">
                      Memuat data tim nominasi...
                    </td>
                  </tr>
                ) : nominasiTeams.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-ink/50">
                      Belum ada tim nominasi. Klik &quot;Buat Tim&quot; untuk memulai.
                    </td>
                  </tr>
                ) : (
                  nominasiTeams.map((team) => (
                    <tr key={team.id} className="hover:bg-surface-card/60 transition-colors">
                      <td className="py-3 px-4 font-medium text-ivory">
                        {team.namaTeam}
                        <span className="block text-[10px] font-mono text-ink/50">{team.id}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-bloom-pink">
                        {team.members.length}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <img
                            src={`/api/qr/${team.qrToken}`}
                            alt={`QR ${team.namaTeam}`}
                            className="w-10 h-10 rounded-lg border border-bloom-pink/30"
                            loading="lazy"
                          />
                          <span className="text-[10px] font-mono text-ink/60 truncate max-w-xs" title={team.qrToken}>
                            {team.qrToken}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {team.isCheckedIn ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-surface-card text-mint border border-mint/40">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Sudah Hadir
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-ink/60 border border-white/10">
                            Belum Hadir
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleTeamCheckIn(team.qrToken, team.namaTeam)}
                            disabled={team.isCheckedIn || nominasiLoading}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gold/40 bg-surface-card text-gold text-[10px] font-bold hover:bg-surface-card transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Scan QR untuk check-in tim"
                          >
                            <Image className="w-3 h-3 mr-1" />
                            {team.isCheckedIn ? 'Sudah' : 'Scan'}
                          </button>
                          <button
                            onClick={() => openEditTeamDialog(team)}
                            className="px-2.5 py-1.5 rounded-lg bg-surface-card border border-bloom-pink/30 text-xs font-bold text-ink hover:bg-surface-card transition-colors"
                            title="Edit tim"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteTeam(team.id, team.namaTeam)}
                            className="px-2.5 py-1.5 rounded-lg bg-red-950/50 border border-red-500/40 text-red-300 text-[10px] font-bold hover:bg-red-900/60 hover:text-red-200 transition-colors"
                            title="Hapus tim"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {checkinResult.status !== 'idle' && (
            <div
              className={`mt-4 p-4 rounded-xl text-xs ${
                checkinResult.status === 'success'
                  ? 'bg-surface-card border border-mint/40 text-mint'
                  : 'bg-red-950/30 border border-red-500/30 text-red-200'
              }`}
            >
              <div className="flex items-start gap-2">
                {checkinResult.status === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                )}
                <div>
                  <p className="font-bold">{checkinResult.message}</p>
                  {checkinResult.team && checkinResult.team.members.length > 0 && (
                    <div className="mt-1 max-h-40 overflow-y-auto">
                      <div className="text-[9px] text-ink/50 font-bold mb-1">
                        Anggota Tim:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {checkinResult.team.members.map((m) => (
                          <span
                            key={m.id}
                            className={`px-2 py-1 rounded bg-white/10 text-[9px] border ${
                              m.isCheckedIn
                                ? 'border-mint/40 text-mint'
                                : 'border-white/10 text-ink/60'
                            }`}
                          >
                            {m.nama} ({m.nimNip})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4 Big Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          <div className="rounded-3xl p-5 bg-gradient-to-b from-surface-card to-surface-card-2 border border-bloom-pink/25 shadow-[0_0_30px_rgba(183,156,232,0.15)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-bold tracking-wider text-ink/60">Total Terdaftar</span>
              <Users className="w-5 h-5 text-bloom-pink" />
            </div>
            <div className="font-cinzel text-3xl sm:text-4xl font-black text-ivory">
              {totalRegistered}
            </div>
            <span className="text-[11px] text-ink/50 block mt-1">Akumulasi seluruh civitas</span>
          </div>

          <div className="rounded-3xl p-5 bg-gradient-to-b from-surface-card to-surface-card-2 border border-bloom-pink/25 shadow-[0_0_30px_rgba(183,156,232,0.15)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-bold tracking-wider text-mint">Sudah Hadir</span>
              <UserCheck className="w-5 h-5 text-mint" />
            </div>
            <div className="font-cinzel text-3xl sm:text-4xl font-black text-mint">
              {totalCheckedIn}
            </div>
            <span className="text-[11px] text-mint/70 block mt-1">Telah check-in di venue</span>
          </div>

          <div className="rounded-3xl p-5 bg-gradient-to-b from-surface-card to-surface-card-2 border border-bloom-pink/25 shadow-[0_0_30px_rgba(183,156,232,0.15)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-bold tracking-wider text-bloom-pink">Belum Hadir</span>
              <UserX className="w-5 h-5 text-bloom-pink" />
            </div>
            <div className="font-cinzel text-3xl sm:text-4xl font-black text-bloom-pink">
              {totalRemaining}
            </div>
            <span className="text-[11px] text-bloom-pink/70 block mt-1">Menunggu kehadiran</span>
          </div>

          <div className="rounded-3xl p-5 bg-gradient-to-b from-surface-card to-surface-card-2 border border-gold/30 shadow-[0_0_30px_rgba(183,156,232,0.15)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-bold tracking-wider text-gold">Tingkat Kehadiran</span>
              <Sparkles className="w-5 h-5 text-gold" />
            </div>
            <div className="font-cinzel text-3xl sm:text-4xl font-black text-gold">
              {attendanceRate}%
            </div>
            <span className="text-[11px] text-gold/70 block mt-1">Persentase pendaftar hadir</span>
          </div>

        </div>

        {/* Filters & Search Toolbar */}
        <div className="p-4 rounded-2xl bg-surface-card-2 border border-bloom-pink/20 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-bloom-pink" />
            <input
              type="text"
              placeholder="Cari berdasarkan Nama, NIM/NIP, atau Email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-field border border-bloom-pink/20 text-xs text-ivory placeholder-ink/40 outline-hidden focus:border-bloom-pink"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-bloom-pink" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="py-2 px-3 rounded-xl bg-field border border-bloom-pink/20 text-xs text-ivory outline-hidden cursor-pointer"
              >
                <option value="ALL">Semua Peran</option>
                <option value="Mahasiswa">Mahasiswa</option>
                <option value="Dosen">Dosen</option>
                <option value="Tenaga Pendidik">Tendik</option>
                <option value="Tamu Undangan">Tamu Undangan</option>
              </select>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2 px-3 rounded-xl bg-field border border-bloom-pink/20 text-xs text-ivory outline-hidden cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              <option value="CHECKED_IN">Hadir (Checked-In)</option>
              <option value="NOT_CHECKED_IN">Belum Hadir</option>
            </select>
          </div>

        </div>

        {/* Attendee Table */}
        <div className="rounded-3xl border border-bloom-pink/20 bg-surface-base/90 overflow-hidden shadow-[0_0_30px_rgba(183,156,232,0.15)] backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-card text-gold uppercase tracking-wider font-semibold border-b border-bloom-pink/20">
                <tr>
                  <th className="py-3.5 px-4">Nama Lengkap</th>
                  <th className="py-3.5 px-4">NIM / NIP</th>
                  <th className="py-3.5 px-4">Peran & Prodi</th>
                  <th className="py-3.5 px-4">Kontak</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Waktu Check-In</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-ink/50">
                      {loading ? 'Memuat data peserta...' : 'Tidak ada data peserta yang cocok.'}
                    </td>
                  </tr>
                ) : (
                  filteredList.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-card/60 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-ivory">
                        {p.name}
                        <span className="block text-[10px] text-ink/50 font-mono">{p.id}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-bloom-pink">{p.nimNip}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-ink">{p.role}</span>
                        <span className="block text-[10px] text-ink/60">{p.prodi}</span>
                        <span className="block text-[10px] text-bloom-pink/70">
                          {p.category || '-'}{p.batch && p.batch !== '-' ? ` • ${p.batch}` : ''}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-ink/70">
                        <div>{p.email}</div>
                        <div className="text-[10px]">{p.phone}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        {p.isCheckedIn ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-surface-card text-mint border border-mint/40">
                            Hadir
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-ink/60 border border-white/10">
                            Belum Hadir
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-ink/70">
                        {p.checkedInAt ? new Date(p.checkedInAt).toLocaleTimeString('id-ID') : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/ticket/${p.qrToken}`}
                            target="_blank"
                            className="text-bloom-pink hover:text-gold underline font-semibold text-[11px]"
                          >
                            Lihat Tiket
                          </Link>
                          <button
                            onClick={() => setTarget(p)}
                            disabled={deletingId === p.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-950/50 border border-red-500/40 text-red-300 hover:bg-red-900/60 hover:text-red-200 transition-colors text-[11px] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Hapus peserta"
                          >
                            {deletingId === p.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <Dialog
        open={!!target}
        variant="danger"
        title="Hapus Peserta"
        message={
          target
            ? `Hapus permanen peserta "${target.name}" (${target.nimNip})?\nTindakan ini tidak bisa dibatalkan.`
            : ''
        }
        confirmLabel="Hapus"
        busy={deletingId === target?.id}
        onClose={() => deletingId === null && setTarget(null)}
        onConfirm={() => target && handleDelete(target)}
      />

      <Dialog
        open={!!notice}
        variant="info"
        title="Tidak Dapat Dilanjutkan"
        message={notice || ''}
        confirmLabel="Mengerti"
        onClose={() => setNotice(null)}
      />

      <Dialog
        open={confirmRollback}
        variant="danger"
        title="Pulihkan Data Sebelumnya"
        message="Daftar mahasiswa aktif akan dikembalikan ke batch impor sebelumnya. Lanjutkan?"
        confirmLabel={rollbackLoading ? 'Memulihkan...' : 'Pulihkan'}
        busy={rollbackLoading}
        onClose={() => !rollbackLoading && setConfirmRollback(false)}
        onConfirm={handleRollback}
      />

      {/* Nominasi Team Dialog */}
      <div
        className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${showNominasiDialog ? '' : 'hidden'}`}
      >
        <div
          className="absolute inset-0 bg-surface-base/80 backdrop-blur-sm"
          onClick={() => setShowNominasiDialog(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border bg-gradient-to-b from-surface-card via-surface-card-2 to-surface-base shadow-[0_0_60px_rgba(0,0,0,0.85)] animate-[dialogIn_180ms_cubic-bezier(0.16,1,0.3,1)]"
          style={{ borderColor: 'rgba(183, 156, 232, 0.4)' }}
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-bloom-pink to-transparent" />

          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-cinzel text-xl font-bold text-ivory tracking-wide">
                {nominasiDialogMode === 'create' ? 'Buat Tim Nominasi' : 'Edit Tim Nominasi'}
              </h3>
              <button
                type="button"
                onClick={() => setShowNominasiDialog(false)}
                disabled={nominasiLoading}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-ink transition-colors disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveTeam(); }} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gold mb-2">Nama Tim <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={teamNama}
                  onChange={(e) => setTeamNama(e.target.value)}
                  placeholder="Contoh: Tim Inovasi Fasilkom 2026"
                  disabled={nominasiLoading}
                  className="w-full px-4 py-3 rounded-xl bg-field border border-bloom-pink/20 text-xs text-ivory placeholder-ink/40 outline-hidden focus:border-bloom-pink"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gold mb-2">Anggota Tim <span className="text-red-400">*</span></label>
                <p className="text-[10px] text-ink/50 mb-2">
                  Pilih mahasiswa yang tergabung dalam tim nominasi ini. Satu mahasiswa bisa tergabung di banyak tim.
                </p>
                <div className="max-h-48 overflow-y-auto border border-bloom-pink/20 rounded-xl p-2 bg-field">
                  {participants.length === 0 ? (
                    <p className="text-[10px] text-ink/50 text-center">Tidak ada data mahasiswa. Unggah data mahasiswa terlebih dahulu.</p>
                  ) : (
                    participants.map((p) => {
                      const isSelected = teamMembers.includes(p.nimNip);
                      return (
                        <label
                          key={p.nimNip}
                          onClick={() => {
                            if (isSelected) {
                              setTeamMembers(teamMembers.filter((n) => n !== p.nimNip));
                            } else {
                              setTeamMembers([...teamMembers, p.nimNip]);
                            }
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-bloom-pink/20 border-bloom-pink/50'
                              : 'bg-white/5 border-white/10 hover:bg-surface-card/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="w-4 h-4 text-bloom-pink border-bloom-pink rounded"
                          />
                          <div>
                            <div className="text-[10px] font-bold text-ivory">{p.name}</div>
                            <div className="text-[9px] text-ink/50 font-mono">{p.nimNip}</div>
                            <div className="text-[9px] text-ink/40">{p.prodi}</div>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="text-[10px] text-ink/50 mt-1">
                  Terpilih: <span className="font-bold text-bloom-pink">{teamMembers.length}</span> anggota
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNominasiDialog(false)}
                  disabled={nominasiLoading}
                  className="flex-1 px-4 py-3 rounded-xl bg-surface-card border border-bloom-pink/30 text-xs font-bold text-bloom-pink hover:bg-surface-card transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={nominasiLoading || !teamNama.trim() || teamMembers.length === 0}
                  className="flex-1 px-4 py-3 rounded-xl bg-gold text-ink text-xs font-bold hover:bg-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {nominasiLoading ? 'Menyimpan...' : nominasiDialogMode === 'create' ? 'Buat Tim' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Student Import Dialog */}
            {/* Student Import Dialog */}
      <div
        className={`fixed inset-0 z-[100] flex items-center justify-center p-4 ${showImportDialog ? '' : 'hidden'}`}
      >
        <div
          className="absolute inset-0 bg-surface-base/80 backdrop-blur-sm"
          onClick={() => {
            if (!importLoading && !commitLoading && !rollbackLoading) {
              setShowImportDialog(false);
            }
          }}
        />
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border bg-gradient-to-b from-surface-card via-surface-card-2 to-surface-base shadow-[0_0_60px_rgba(0,0,0,0.85)] animate-[dialogIn_180ms_cubic-bezier(0.16,1,0.3,1)]"
          style={{ borderColor: 'rgba(183, 156, 232, 0.4)' }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-bloom-pink to-transparent"
          />

          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-cinzel text-xl font-bold text-ivory tracking-wide">
                Unggah Data Mahasiswa
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (!importLoading && !commitLoading && !rollbackLoading) {
                    setShowImportDialog(false);
                  }
                }}
                disabled={importLoading || commitLoading || rollbackLoading}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-ink transition-colors disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            {!previewData ? (
              <form onSubmit={handlePreviewImport} className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gold mb-2">Sistem Informasi <span className="text-red-400">*</span></label>
                    <input
                      type="file"
                      name="sistemInformasi"
                      id="sistemInformasi"
                      accept=".xlsx"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-field border border-bloom-pink/20 text-xs text-ivory placeholder-ink/40 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-bloom-pink/10 file:text-bloom-pink file:cursor-pointer file:hover:bg-bloom-pink/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gold mb-2">Informatika <span className="text-red-400">*</span></label>
                    <input
                      type="file"
                      name="informatika"
                      id="informatika"
                      accept=".xlsx"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-field border border-bloom-pink/20 text-xs text-ivory placeholder-ink/40 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-bloom-pink/10 file:text-bloom-pink file:cursor-pointer file:hover:bg-bloom-pink/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gold mb-2">Teknologi Informasi <span className="text-red-400">*</span></label>
                    <input
                      type="file"
                      name="teknologiInformasi"
                      id="teknologiInformasi"
                      accept=".xlsx"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-field border border-bloom-pink/20 text-xs text-ivory placeholder-ink/40 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-bloom-pink/10 file:text-bloom-pink file:cursor-pointer file:hover:bg-bloom-pink/20"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={importLoading}
                  className="w-full px-4 py-3 rounded-xl bg-gold text-ink text-xs font-bold hover:bg-gold-light transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importLoading ? 'Memproses...' : 'Preview Data'}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-ink/70">
                  Preview berlaku 15 menit pada sesi ini. Simpan untuk mengaktifkan data yang telah diperiksa.
                </p>
                {/* Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl p-4 bg-surface-card-2 border border-bloom-pink/20 text-center">
                    <div className="text-2xl font-black text-gold">{previewData.totalRows}</div>
                    <div className="text-[10px] text-ink/60 uppercase font-bold">Baris Total</div>
                  </div>
                  <div className="rounded-xl p-4 bg-surface-card-2 border border-mint/40 text-center">
                    <div className="text-2xl font-black text-mint">{previewData.validRows}</div>
                    <div className="text-[10px] text-ink/60 uppercase font-bold">Data Valid</div>
                  </div>
                  <div className="rounded-xl p-4 bg-surface-card-2 border border-red-500/40 text-center">
                    <div className="text-2xl font-black text-red-300">{previewData.invalidRows}</div>
                    <div className="text-[10px] text-ink/60 uppercase font-bold">Data Invalid</div>
                  </div>
                  <div className="rounded-xl p-4 bg-surface-card-2 border border-orange-500/40 text-center">
                    <div className="text-2xl font-black text-orange-300">{previewData.duplicateNims}</div>
                    <div className="text-[10px] text-ink/60 uppercase font-bold">NIM Duplikat</div>
                  </div>
                </div>

                {/* Errors */}
                {previewData.errors.length > 0 && (
                  <div className="rounded-xl p-4 bg-red-950/30 border border-red-500/30 max-h-48 overflow-y-auto">
                    <div className="text-[10px] font-bold text-red-300 mb-2">Kesalahan Temukan:</div>
                    {previewData.errors.map((error, idx) => (
                      <div key={idx} className="text-[10px] text-red-200 mb-1">• {error}</div>
                    ))}
                  </div>
                )}

                {/* Active Batch Info */}
                {activeBatch && (
                  <div className="rounded-xl p-4 bg-surface-card-2 border border-gold/40 text-center">
                    <div className="text-sm font-bold text-gold mb-1">Batch Aktif: {activeBatch.batchId}</div>
                    <div className="text-[10px] text-ink/60">Mahasiswa: {activeBatch.count} • Dibuat: {new Date(activeBatch.createdAt).toLocaleString('id-ID')}</div>
                    {activeBatch.canRollback && (
                      <button
                        type="button"
                        onClick={() => setConfirmRollback(true)}
                        disabled={rollbackLoading}
                        className="mt-3 rounded-lg border border-red-400/40 px-3 py-1.5 text-[10px] font-bold text-red-200 hover:bg-red-950/40 disabled:opacity-50"
                      >
                        Pulihkan Batch Sebelumnya
                      </button>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewData(null);
                      setShowImportDialog(false);
                    }}
                    className="flex-1 px-4 py-3 rounded-xl bg-surface-card border border-bloom-pink/30 text-xs font-bold text-bloom-pink hover:bg-surface-card transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleCommitImport}
                    disabled={commitLoading || previewData.invalidRows > 0 || previewData.validRows === 0 || previewData.errors.length > 0}
                    className="flex-1 px-4 py-3 rounded-xl bg-gold text-ink text-xs font-bold hover:bg-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {commitLoading ? 'Menyimpan...' : 'Simpan Data Aktif'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
