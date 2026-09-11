export type RoleType = 'Mahasiswa' | 'Dosen' | 'Tenaga Pendidik' | 'Tamu Undangan';

export interface Participant {
  id: string;
  nimNip: string;
  name: string;
  role: RoleType;
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
  prodi: string;
  email: string;
  phone: string;
}
