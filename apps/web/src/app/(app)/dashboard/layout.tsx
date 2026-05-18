import { AuthGate } from '@/components/providers/auth-gate';
import { DashboardChrome } from '@/components/dashboard/dashboard-chrome';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate requireStudio>
      <DashboardChrome>{children}</DashboardChrome>
    </AuthGate>
  );
}
