import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useModulosActivos } from '@/hooks/useModulosActivos';
import { useCurrentBusiness } from '@/hooks/useCurrentBusiness';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import SubscriptionBanner from '@/components/SubscriptionBanner';
import {
  LayoutGrid,
  UtensilsCrossed,
  Eye,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ClipboardList,
  Gift,
  Wallet,
  QrCode,
  BarChart3,
  Users,
  Settings,
  ShieldCheck,
  Package,
  TrendingUp,
  Sparkles
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutGrid },
  { href: '/admin/ordenes', label: 'Pedidos', icon: ClipboardList },
  { href: '/admin/estadisticas', label: 'Estadísticas', icon: BarChart3 },
  { href: '/admin/caja', label: 'Caja', icon: Wallet },
  { href: '/admin/meseros', label: 'Meseros', icon: Users },
  { href: '/admin/mesas', label: 'Mesas QR', icon: QrCode },
  { href: '/admin/categorias', label: 'Categorías', icon: UtensilsCrossed },
  { href: '/admin/menus', label: 'Menús/Combos', icon: UtensilsCrossed },
  { href: '/admin/productos', label: 'Productos', icon: UtensilsCrossed },
  { href: '/admin/insumos', label: 'Insumos', icon: Package },
  { href: '/admin/reportes', label: 'Reportes', icon: TrendingUp },
  { href: '/admin/recompensas', label: 'Recompensas', icon: Gift },
  { href: '/admin/roles', label: 'Usuarios / Roles', icon: ShieldCheck },
  { href: '/admin/configuracion', label: 'Configuración', icon: Settings },
  { href: '/', label: 'Ver Menú', icon: Eye, external: true, controllable: true },
  { href: '/mesero', label: 'Modo Mesero', icon: Users, external: true, controllable: true },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { isModuloActivo, isLoading } = useModulosActivos();
  const { business, isTrial, trialDaysLeft } = useCurrentBusiness();
  const { isSuperAdmin } = useSuperAdmin();

  const filteredNavItems = navItems.filter((item) => {
    if (isLoading && !item.external) return false;
    if (item.external && !item.controllable) return true;
    return isModuloActivo(item.href);
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-sidebar-foreground p-2"
        >
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
        <span className="font-display text-lg text-sidebar-foreground">Panel Admin</span>
        <div className="w-10" />
      </header>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-64 bg-sidebar transform transition-transform duration-200 ease-in-out z-40",
        "lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full pt-16 lg:pt-0">
          {/* Logo + business */}
          <div className="h-auto py-4 flex flex-col items-start px-6 border-b border-sidebar-border gap-2">
            <div className="flex items-center w-full">
              <UtensilsCrossed className="h-8 w-8 text-sidebar-primary mr-3" />
              <span className="font-display text-xl text-sidebar-foreground truncate">{business?.name ?? 'Menú Digital'}</span>
            </div>
            {isTrial && trialDaysLeft !== null && (
              <Badge variant={trialDaysLeft <= 3 ? 'destructive' : 'secondary'} className="text-[10px] gap-1">
                <Sparkles className="h-3 w-3" /> Trial · {trialDaysLeft}d
              </Badge>
            )}
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1">
            <nav className="p-4 space-y-1">
              {filteredNavItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    target={item.external ? '_blank' : undefined}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                      isActive 
                        ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                        : "text-sidebar-foreground hover:bg-sidebar-accent"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="flex-1">{item.label}</span>
                    {item.external && <ChevronRight className="h-4 w-4 opacity-50" />}
                  </Link>
                );
              })}
              {isSuperAdmin && (
                <Link
                  to="/super-admin"
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mt-4 border border-sidebar-border/50",
                    location.pathname === '/super-admin'
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <ShieldCheck className="h-5 w-5" />
                  <span className="flex-1">Super Admin</span>
                </Link>
              )}
            </nav>
          </ScrollArea>

          {/* User section */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="text-sm text-sidebar-foreground/70 mb-3 truncate px-4">
              {user?.email}
            </div>
            <Button 
              variant="ghost" 
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={handleSignOut}
            >
              <LogOut className="h-5 w-5 mr-3" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="lg:pl-64 pt-16 lg:pt-0 min-h-screen">
        <SubscriptionBanner />
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}