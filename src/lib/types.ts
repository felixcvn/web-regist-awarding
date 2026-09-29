export type RoleType = 'Mahasiswa' | 'Dosen' | 'Tenaga Pendidik' | 'Tamu Undangan';

export type CategoryType =
  | 'BPM'
  | 'BEM'
  | 'HIMASIF'
  | 'HIMATIF'
  | 'HMIF'
  | 'UKM LAOS'
  | 'UKM-O MACO'
  | 'UKM-P BALWANA'
  | 'UKM-K ETALASE'
  | 'UKM-P BINARY'
  | 'UKM-KI AL AZHAR'
  | 'UKM ASTANAWIDYA'
  | 'Perwakilan Angkatan'
  | 'Mahasiswa Fasilkom';

export type BatchType = '2023' | '2024' | '2025' | '2026' | '-';

export const CATEGORY_OPTIONS: CategoryType[] = [
  'BPM',
  'BEM',
  'HIMASIF',
  'HIMATIF',
  'HMIF',
  'UKM LAOS',
  'UKM-O MACO',
  'UKM-P BALWANA',
  'UKM-K ETALASE',
  'UKM-P BINARY',
  'UKM-KI AL AZHAR',
  'UKM ASTANAWIDYA',
  'Perwakilan Angkatan',
  'Mahasiswa Fasilkom',
];

export const BATCH_OPTIONS: BatchType[] = ['2023', '2024', '2025', '2026'];

export interface Participant {
  id: string;
  nimNip: string;
  name: string;
  role: RoleType;
  category: CategoryType;
  batch: BatchType;
  prodi: string;
  email: string;
  phone: string;
  qrToken: string;
  isCheckedIn: boolean;
  checkedInAt?: string | null;
  createdAt: string;
}

export interface RegistrationInput {
  nimNip: string;
  name: string;
  role: RoleType;
  category: CategoryType;
  batch: BatchType;
  prodi: string;
  email: string;
  phone: string;
}
