import Head from 'next/head';
import { PapersPage } from '@/features/papers/papers-page';

export default function PapersRoute() {
  return <><Head><title>歷屆試題｜建築師考試</title></Head><PapersPage /></>;
}
