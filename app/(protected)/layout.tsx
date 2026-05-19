import React from 'react';
import AppShell from '../../components/app-shell/AppShell';

const ProtectedLayout = async ({ children }: Readonly<{ children: React.ReactNode }>) => {
  return (
    <AppShell>{children}</AppShell>
  );
};

export default ProtectedLayout;
