import type { Metadata } from 'next';
import DevicesWorkspace from '@/components/devices/DevicesWorkspace';

export const metadata: Metadata = {
  title: 'Devices | Open Agency',
  description:
    'Shared device operations for Smart Home entities and Physical Devices canonical devices.',
};

export default function DevicesPage() {
  return <DevicesWorkspace />;
}
