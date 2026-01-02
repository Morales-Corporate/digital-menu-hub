import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import ProtectedRoute from "@/components/ProtectedRoute";
import MenuPublico from "@/pages/MenuPublico";
import Auth from "@/pages/Auth";
import MiCuenta from "@/pages/MiCuenta";
import MisOrdenes from "@/pages/MisOrdenes";
import Checkout from "@/pages/Checkout";
import AdminIndex from "@/pages/admin/AdminIndex";
import Categorias from "@/pages/admin/Categorias";
import Productos from "@/pages/admin/Productos";
import Ordenes from "@/pages/admin/Ordenes";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
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
            <Route path="/checkout" element={
              <ProtectedRoute>
                <Checkout />
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
            <Route path="/admin/ordenes" element={
              <ProtectedRoute requireAdmin>
                <Ordenes />
              </ProtectedRoute>
            } />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;