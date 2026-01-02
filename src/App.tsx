import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import MenuPublico from "@/pages/MenuPublico";
import Auth from "@/pages/Auth";
import MiCuenta from "@/pages/MiCuenta";
import MisOrdenes from "@/pages/MisOrdenes";
import AdminIndex from "@/pages/admin/AdminIndex";
import Categorias from "@/pages/admin/Categorias";
import Productos from "@/pages/admin/Productos";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<MenuPublico />} />
            <Route path="/auth" element={<Auth />} />
            
            {/* User routes - protected */}
            <Route path="/mi-cuenta" element={
              <ProtectedRoute>
                <MiCuenta />
              </ProtectedRoute>
            } />
            <Route path="/mis-ordenes" element={
              <ProtectedRoute>
                <MisOrdenes />
              </ProtectedRoute>
            } />
            
            {/* Admin routes - protected and require admin role */}
            <Route path="/admin" element={
              <ProtectedRoute requireAdmin>
                <AdminIndex />
              </ProtectedRoute>
            } />
            <Route path="/admin/categorias" element={
              <ProtectedRoute requireAdmin>
                <Categorias />
              </ProtectedRoute>
            } />
            <Route path="/admin/productos" element={
              <ProtectedRoute requireAdmin>
                <Productos />
              </ProtectedRoute>
            } />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;