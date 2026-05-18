import {
  Images,
  LayoutDashboard,
  Settings,
  ShoppingBag,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { ROUTES } from '@photogrid/config';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const SIDEBAR_NAV: NavItem[] = [
  { label: 'Dashboard', href: ROUTES.dashboard, icon: LayoutDashboard },
  { label: 'Galerias', href: ROUTES.galleries, icon: Images },
  { label: 'Clientes', href: ROUTES.clients, icon: Users },
  { label: 'Pedidos', href: ROUTES.orders, icon: ShoppingBag },
  { label: 'Configurações', href: ROUTES.settings, icon: Settings },
];
