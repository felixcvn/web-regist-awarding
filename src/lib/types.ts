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

export type BatchType = '2022' | '2023' | '2024' | '2025' | '2026' | '-';

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

export const BATCH_OPTIONS: BatchType[] = ['2022', '2023', '2024', '2025', '2026'];

// Award categories for nomination teams. Separate from CategoryType, which
// describes a registrant's unit of origin.
export const NOMINASI_CATEGORY_OPTIONS = [
  'Anugerah Inovasi Bisnis',
  'Anugerah Tata Kelola Unggul',
  'Anugerah Bintang Prestasi',
  'Anugerah Mahakarya Audiovisual',
  'Anugerah Ketangkasan Digital',
  'Anugerah Mahakarya Intelektual',
  'Anugerah Organisasi Terbaik',
  'Anugerah Bintang Muda',
  'Anugerah Atlet Tangguh',
  'Terlahir Viral',
  'Anugerah Karsa Gemilang',
  'Anugerah Karya Desain Antarmuka Digital',
  'Anugerah Prestasi Unggulan',
  'Anugerah Dedikasi Unggul',
  'Anugerah Pejuang Tangguh',
  'Anugerah Lentera Nada',
  'Anugerah Kesatria Arena',
  'Anugerah Lumbung Prestasi',
] as const;

export type NominasiCategoryType = typeof NOMINASI_CATEGORY_OPTIONS[number];

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

export type PublicTicket = Pick<Participant,
  'id' | 'nimNip' | 'name' | 'role' | 'category' | 'batch' | 'prodi' | 'qrToken' | 'isCheckedIn'
>;

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
