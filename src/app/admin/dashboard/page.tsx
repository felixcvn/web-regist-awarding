'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Participant } from '@/lib/types';
import { Users, UserCheck, UserX, Download, Search, QrCode, LogOut, RefreshCw, Sparkles, Filter, Trash2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { secureFetch } from '@/lib/csrfClient';
import GardenArtwork from '@/components/GardenArtwork';
import Dialog from '@/components/Dialog';

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

  const fetchParticipants = async () => {
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
  };

  useEffect(() => {
    fetchParticipants();
  }, []);

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

  return (
    <main className="relative min-h-screen bg-garden bg-vignette-soft text-ink p-4 sm:p-6 lg:p-8 overflow-hidden">
      <GardenArtwork asset="bush" interaction="hover" className="absolute bottom-0 right-2 sm:right-6 w-40 sm:w-52 z-0 origin-bottom opacity-50" />
      <GardenArtwork asset="butterfly" interaction="float" className="absolute top-6 left-6 w-7 z-0 opacity-60" />
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

        {/* 4 Big Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="rounded-3xl p-5 bg-gradient-to-b from-surface-card to-surface-card-2 border border-bloom-pink/25 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-bold tracking-wider text-ink/60">Total Terdaftar</span>
              <Users className="w-5 h-5 text-bloom-pink" />
            </div>
            <div className="font-cinzel text-3xl sm:text-4xl font-black text-ivory">
              {totalRegistered}
            </div>
            <span className="text-[11px] text-ink/50 block mt-1">Akumulasi seluruh civitas</span>
          </div>

          <div className="rounded-3xl p-5 bg-gradient-to-b from-surface-card to-surface-card-2 border border-bloom-pink/25 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-bold tracking-wider text-mint">Sudah Hadir</span>
              <UserCheck className="w-5 h-5 text-mint" />
            </div>
            <div className="font-cinzel text-3xl sm:text-4xl font-black text-mint">
              {totalCheckedIn}
            </div>
            <span className="text-[11px] text-mint/70 block mt-1">Telah check-in di venue</span>
          </div>

          <div className="rounded-3xl p-5 bg-gradient-to-b from-surface-card to-surface-card-2 border border-bloom-pink/25 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-bold tracking-wider text-bloom-pink">Belum Hadir</span>
              <UserX className="w-5 h-5 text-bloom-pink" />
            </div>
            <div className="font-cinzel text-3xl sm:text-4xl font-black text-bloom-pink">
              {totalRemaining}
            </div>
            <span className="text-[11px] text-bloom-pink/70 block mt-1">Menunggu kehadiran</span>
          </div>

          <div className="rounded-3xl p-5 bg-gradient-to-b from-surface-card to-surface-card-2 border border-gold/30 shadow-lg">
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
        <div className="rounded-3xl border border-bloom-pink/20 bg-surface-base overflow-hidden shadow-xl">
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
    </main>
  );
}
