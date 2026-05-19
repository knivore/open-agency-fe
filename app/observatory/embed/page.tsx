import type { Metadata } from 'next';

import ObservatoryRuntimeSurface from '@/modules/observatory/app/ObservatoryRuntimeSurface';

import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Observatory Embed',
  robots: {
    follow: false,
    index: false,
  },
};

export default function ObservatoryEmbedPage() {
  return (
    <main className={styles.page} aria-label="Observatory embedded runtime visualization">
      <ObservatoryRuntimeSurface compact mode="embed" readOnly />
    </main>
  );
}
