import { redirect } from 'next/navigation';
import { verifyAdminAuth } from '@/lib/auth';

export default async function AdminPage() {
  const isAuthed = await verifyAdminAuth();
  if (isAuthed) {
    redirect('/admin/dashboard');
  } else {
    redirect('/admin/login');
  }
}
