'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search, Filter, ChevronLeft, ChevronRight, Loader2, Users } from 'lucide-react';
import GardenFrame from '@/components/GardenFrame';
import { secureFetch } from '@/lib/csrfClient';
import type { UnregisteredStudent } from '@/lib/types';

const PAGE_SIZE = 25;
const BATCH_FILTERS = ['2023', '2024', '2025', '2026'];

export default function UnregisteredStudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<UnregisteredStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [batchFilter, setBatchFilter] = useState('all');
  const [prodiFilter, setProdiFilter] = useState('all');
  const [page, setPage] = useState(1);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await secureFetch('/api/admin/student-master/unregistered');
      if (res.status === 401) {
        router.push('/admin/login');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Gagal mengambil data mahasiswa.');
      }
      const data = await res.json();
      setStudents(data.students);
    } catch (err) {
      setError((err as Error).message || 'Gagal mengambil data mahasiswa.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchStudents();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchStudents]);

  const prodiOptions = useMemo(
    () => Array.from(new Set(students.map((s) => s.prodi))).sort(),
    [students]
  );

  // Counts ignore the angkatan filter so each card shows how many students
  // that year would add under the current search/prodi.
  const scoped = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return students.filter((s) => {
      if (prodiFilter !== 'all' && s.prodi !== prodiFilter) return false;
      if (q && !s.nim.toLowerCase().includes(q) && !s.nama.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [students, searchTerm, prodiFilter]);

  const batchCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of BATCH_FILTERS) counts[b] = 0;
    for (const s of scoped) counts[s.batchYear] = (counts[s.batchYear] || 0) + 1;
    return counts;
  }, [scoped]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return students.filter((s) => {
      if (batchFilter !== 'all' && s.batchYear !== batchFilter) return false;
      if (prodiFilter !== 'all' && s.prodi !== prodiFilter) return false;
      if (q && !s.nim.toLowerCase().includes(q) && !s.nama.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [students, searchTerm, batchFilter, prodiFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const batchCards = [
    { key: 'all', label: 'Semua Angkatan', count: scoped.length },
    ...BATCH_FILTERS.map((b) => ({ key: b, label: `Angkatan ${b}`, count: batchCounts[b] })),
  ];

  return (
    <main className="relative min-h-screen bg-transparent text-ink px-4 pb-8 pt-8 sm:px-6 sm:pt-10 lg:px-8 lg:pt-12 overflow-hidden">
      <GardenFrame variant="subtle" />
      <div className="relative z-10 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-bloom-pink/20 gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-bloom-pink block mb-1">
              Rekapitulasi Panitia
            </span>
            <h1 className="font-cinzel text-2xl sm:text-3xl font-bold text-ivory">
              Mahasiswa Belum Registrasi
            </h1>
          </div>

          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-card border border-bloom-pink/30 text-xs font-semibold text-bloom-pink hover:bg-surface-card transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Dashboard
          </Link>
        </div>

        {/* Count cards per angkatan filter */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
          {batchCards.map((card) => {
            const active = batchFilter === card.key;
            return (
              <button
                key={card.key}
                onClick={() => { setBatchFilter(card.key); setPage(1); }}
                className={`rounded-2xl p-4 text-left border transition-colors cursor-pointer ${
                  active
                    ? 'bg-bloom-pink/15 border-bloom-pink/60'
                    : 'bg-gradient-to-b from-surface-card to-surface-card-2 border-bloom-pink/25 hover:border-bloom-pink/50'
                }`}
              >
                <span className={`block text-[10px] uppercase font-bold tracking-wider ${active ? 'text-bloom-pink' : 'text-ink/60'}`}>
                  {card.label}
                </span>
                <span className="font-cinzel text-2xl sm:text-3xl font-black text-ivory block mt-1">
                  {card.count}
                </span>
                <span className="text-[10px] text-ink/50 block">belum registrasi</span>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="p-4 rounded-2xl bg-surface-card-2 border border-bloom-pink/20 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-bloom-pink" />
            <input
              type="text"
              placeholder="Cari berdasarkan Nama atau NIM..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-field border border-bloom-pink/20 text-xs text-ivory placeholder-ink/40 outline-hidden focus:border-bloom-pink"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-bloom-pink" />
              <select
                value={batchFilter}
                onChange={(e) => { setBatchFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 rounded-xl bg-field border border-bloom-pink/20 text-xs text-ivory outline-hidden focus:border-bloom-pink cursor-pointer"
              >
                <option value="all">Semua Angkatan</option>
                {BATCH_FILTERS.map((b) => (
                  <option key={b} value={b}>Angkatan {b}</option>
                ))}
              </select>
            </div>

            <select
              value={prodiFilter}
              onChange={(e) => { setProdiFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-xl bg-field border border-bloom-pink/20 text-xs text-ivory outline-hidden focus:border-bloom-pink cursor-pointer"
            >
              <option value="all">Semua Prodi</option>
              {prodiOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-card border border-bloom-pink/20 text-xs text-ink/70">
              <Users className="w-3.5 h-3.5 text-bloom-pink" />
              {filtered.length} mahasiswa
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-3xl p-4 sm:p-6 bg-gradient-to-b from-surface-card to-surface-card-2 border border-bloom-pink/25 shadow-[0_0_30px_rgba(183,156,232,0.15)]">
          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3 text-ink/50 text-xs">
              <Loader2 className="w-5 h-5 animate-spin text-bloom-pink" />
              Memuat data mahasiswa...
            </div>
          ) : error ? (
            <div className="py-16 text-center text-xs text-red-300">
              {error}
              <button
                onClick={fetchStudents}
                className="block mx-auto mt-3 px-4 py-2 rounded-xl bg-bloom-pink text-on-accent font-bold text-xs"
              >
                Coba Lagi
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-xs text-ink/50">
              {students.length === 0
                ? 'Tidak ada mahasiswa yang belum registrasi.'
                : 'Tidak ada mahasiswa yang cocok dengan filter.'}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-card text-gold uppercase tracking-wider font-semibold border-b border-bloom-pink/20">
                    <tr>
                      <th className="py-3 px-4">NIM</th>
                      <th className="py-3 px-4">Nama</th>
                      <th className="py-3 px-4">Prodi</th>
                      <th className="py-3 px-4">Angkatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {visible.map((s) => (
                      <tr key={s.nim} className="hover:bg-surface-card/60 transition-colors">
                        <td className="py-3 px-4 font-mono text-ink/80">{s.nim}</td>
                        <td className="py-3 px-4 font-medium text-ivory">{s.nama}</td>
                        <td className="py-3 px-4 text-ink/70">{s.prodi}</td>
                        <td className="py-3 px-4 font-mono text-bloom-pink">{s.batchYear}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-2 border-t border-bloom-pink/20">
                <span className="text-[11px] text-ink/50">
                  Halaman {safePage} dari {totalPages} · {filtered.length} mahasiswa
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-card border border-bloom-pink/30 text-[11px] font-semibold text-bloom-pink disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Sebelumnya
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-card border border-bloom-pink/30 text-[11px] font-semibold text-bloom-pink disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Berikutnya
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </main>
  );
}
