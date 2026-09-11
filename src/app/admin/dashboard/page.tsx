'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Participant } from '@/lib/types';
import { Users, UserCheck, UserX, Download, Search, QrCode, LogOut, RefreshCw, Sparkles, Filter } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

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
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  return (
    <main className="min-h-screen bg-[#061510] text-[#EDE8DF] p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#AFF8DB]/20 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-[#AFF8DB]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#AFF8DB]">
                Admin Rekapitulasi
              </span>
            </div>
            <h1 className="font-cinzel text-2xl sm:text-3xl font-bold text-[#FAF7F0]">
              Dashboard Kehadiran Acara
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchParticipants}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0F2D23] border border-[#AFF8DB]/30 text-xs font-semibold text-[#AFF8DB] hover:bg-[#154234] transition-colors cursor-pointer"
              title="Perbarui Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <a
              href="/api/admin/participants?format=csv"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#AFF8DB] text-[#061811] text-xs font-bold hover:bg-[#8ee9c4] transition-colors shadow-md"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </a>

            <Link
              href="/admin/scan"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#184535] border border-[#FFF3B0]/40 text-[#FFF3B0] text-xs font-bold hover:bg-[#205743] transition-colors shadow-md"
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
          
          <div className="rounded-3xl p-5 bg-gradient-to-b from-[#0F2D23] to-[#0A1F18] border border-[#AFF8DB]/25 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-bold tracking-wider text-[#EDE8DF]/60">Total Terdaftar</span>
              <Users className="w-5 h-5 text-[#AFF8DB]" />
            </div>
            <div className="font-cinzel text-3xl sm:text-4xl font-black text-[#FAF7F0]">
              {totalRegistered}
            </div>
            <span className="text-[11px] text-[#EDE8DF]/50 block mt-1">Akumulasi seluruh civitas</span>
          </div>

          <div className="rounded-3xl p-5 bg-gradient-to-b from-[#0F2D23] to-[#0A1F18] border border-[#AFF8DB]/25 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-bold tracking-wider text-[#AFF8DB]">Sudah Hadir</span>
              <UserCheck className="w-5 h-5 text-[#AFF8DB]" />
            </div>
            <div className="font-cinzel text-3xl sm:text-4xl font-black text-[#AFF8DB]">
              {totalCheckedIn}
            </div>
            <span className="text-[11px] text-[#AFF8DB]/70 block mt-1">Telah check-in di venue</span>
          </div>

          <div className="rounded-3xl p-5 bg-gradient-to-b from-[#0F2D23] to-[#0A1F18] border border-[#AFF8DB]/25 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-bold tracking-wider text-[#FFB5E8]">Belum Hadir</span>
              <UserX className="w-5 h-5 text-[#FFB5E8]" />
            </div>
            <div className="font-cinzel text-3xl sm:text-4xl font-black text-[#FFB5E8]">
              {totalRemaining}
            </div>
            <span className="text-[11px] text-[#FFB5E8]/70 block mt-1">Menunggu kehadiran</span>
          </div>

          <div className="rounded-3xl p-5 bg-gradient-to-b from-[#0F2D23] to-[#0A1F18] border border-[#FFF3B0]/30 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-bold tracking-wider text-[#FFF3B0]">Tingkat Kehadiran</span>
              <Sparkles className="w-5 h-5 text-[#FFF3B0]" />
            </div>
            <div className="font-cinzel text-3xl sm:text-4xl font-black text-[#FFF3B0]">
              {attendanceRate}%
            </div>
            <span className="text-[11px] text-[#FFF3B0]/70 block mt-1">Persentase pendaftar hadir</span>
          </div>

        </div>

        {/* Filters & Search Toolbar */}
        <div className="p-4 rounded-2xl bg-[#091F18] border border-[#AFF8DB]/20 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AFF8DB]" />
            <input
              type="text"
              placeholder="Cari berdasarkan Nama, NIM/NIP, atau Email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#061811] border border-[#AFF8DB]/20 text-xs text-[#FAF7F0] placeholder-[#EDE8DF]/40 outline-hidden focus:border-[#AFF8DB]"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-[#AFF8DB]" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="py-2 px-3 rounded-xl bg-[#061811] border border-[#AFF8DB]/20 text-xs text-[#FAF7F0] outline-hidden cursor-pointer"
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
              className="py-2 px-3 rounded-xl bg-[#061811] border border-[#AFF8DB]/20 text-xs text-[#FAF7F0] outline-hidden cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              <option value="CHECKED_IN">Hadir (Checked-In)</option>
              <option value="NOT_CHECKED_IN">Belum Hadir</option>
            </select>
          </div>

        </div>

        {/* Attendee Table */}
        <div className="rounded-3xl border border-[#AFF8DB]/20 bg-[#081C15] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0D281E] text-[#FFF3B0] uppercase tracking-wider font-semibold border-b border-[#AFF8DB]/20">
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
                    <td colSpan={7} className="py-12 text-center text-[#EDE8DF]/50">
                      {loading ? 'Memuat data peserta...' : 'Tidak ada data peserta yang cocok.'}
                    </td>
                  </tr>
                ) : (
                  filteredList.map((p) => (
                    <tr key={p.id} className="hover:bg-[#0E2C21]/60 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-[#FAF7F0]">
                        {p.name}
                        <span className="block text-[10px] text-[#EDE8DF]/50 font-mono">{p.id}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#AFF8DB]">{p.nimNip}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-[#EDE8DF]">{p.role}</span>
                        <span className="block text-[10px] text-[#EDE8DF]/60">{p.prodi}</span>
                      </td>
                      <td className="py-3.5 px-4 text-[#EDE8DF]/70">
                        <div>{p.email}</div>
                        <div className="text-[10px]">{p.phone}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        {p.isCheckedIn ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#154636] text-[#AFF8DB] border border-[#AFF8DB]/40">
                            Hadir
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-[#EDE8DF]/60 border border-white/10">
                            Belum Hadir
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#EDE8DF]/70">
                        {p.checkedInAt ? new Date(p.checkedInAt).toLocaleTimeString('id-ID') : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/ticket/${p.qrToken}`}
                          target="_blank"
                          className="text-[#AFF8DB] hover:text-[#FFF3B0] underline font-semibold text-[11px]"
                        >
                          Lihat Tiket
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
  );
}
