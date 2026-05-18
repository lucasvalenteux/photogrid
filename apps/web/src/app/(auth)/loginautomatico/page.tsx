import type { Metadata } from 'next';

import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = {
  title: 'Entrar automaticamente',
  description: 'Acesse sua conta Photogrid.',
};

export default function AutoLoginPage() {
  return <LoginForm />;
}

