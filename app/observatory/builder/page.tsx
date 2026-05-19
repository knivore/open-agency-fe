import type { Metadata } from 'next';

import ObservatoryRuntimeSurface from '@/modules/observatory/app/ObservatoryRuntimeSurface';

import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Observatory Builder',
  robots: {
    follow: false,
    index: false,
  },
};

export default function ObservatoryBuilderPage() {
  return (
    <main className={styles.page} aria-label="Observatory layout builder">
      <ObservatoryRuntimeSurface mode="builder" />
    </main>
  );
}
