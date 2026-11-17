import type { Metadata } from 'next';
import ArchiveScreen from '../../_components/ArchiveScreen';

export const metadata: Metadata = { title: '综述历史 · Scholar Research' };

export default function Page() {
  return <ArchiveScreen />;
}
