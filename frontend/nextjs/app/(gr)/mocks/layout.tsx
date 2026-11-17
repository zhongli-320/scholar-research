import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MockMode } from '../_components/mode';
import MockBar from './_components/MockBar';
import FixtureBoundary from './_components/FixtureBoundary';
import { archive } from './_data/archive';

export const metadata: Metadata = {
  title: 'Scholar Research - design mocks',
  robots: { index: false, follow: false },
};

export default function MocksLayout({ children }: { children: React.ReactNode }) {
  return (
    <MockMode archive={archive}>
      <FixtureBoundary>{children}</FixtureBoundary>
      <Suspense>
        <MockBar />
      </Suspense>
    </MockMode>
  );
}
