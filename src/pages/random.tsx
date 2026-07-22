import Head from 'next/head';
import { RandomPage } from '@/features/random/random-page';

export default function RandomRoute() {
  return <><Head><title>隨機出題｜建築師考試</title></Head><RandomPage /></>;
}
