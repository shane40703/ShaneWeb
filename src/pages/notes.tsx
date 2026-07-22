import Head from 'next/head';
import { NotesPage } from '@/features/notes/notes-page';

export default function NotesRoute() {
  return <><Head><title>使用者筆記｜建築師考試</title></Head><NotesPage /></>;
}
