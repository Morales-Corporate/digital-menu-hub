import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';
import { Utensils, Loader2 } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

const signUpSchema = loginSchema.extend({
  fullName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  businessName: z.string().optional(),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignUpFormData = z.infer<typeof signUpSchema>;

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const { user, role, signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', confirmPassword: '', fullName: '', businessName: '' },
  });

  useEffect(() => {
    if (user && role) {
      if (role === 'admin') {
        navigate('/admin');
      } else if (role === 'mesero') {
        navigate('/mesero');
      } else if (role === 'cocina') {
        navigate('/cocina');
      } else {
        navigate('/');
      }
    }
  }, [user, role, navigate]);

  const handleLogin = async (data: LoginFormData) => {
    setIsSubmitting(true);
    const { error } = await signIn(data.email, data.password);
    setIsSubmitting(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Credenciales inválidas. Verifica tu email y contraseña.');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('¡Bienvenido!');
      // useEffect handles redirect based on role
    }
  };

  const handleSignUp = async (data: SignUpFormData) => {
    setIsSubmitting(true);
    const { error } = await signUp(data.email, data.password, data.fullName, data.businessName);
    setIsSubmitting(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('Este email ya está registrado. Intenta iniciar sesión.');
      } else {
        toast.error(error.message);
      }
    } else {
      const msg = data.businessName?.trim()
        ? '¡Cuenta creada! Tu negocio tiene 30 días de prueba gratis. Revisa tu email para confirmar.'
        : 'Cuenta creada. Revisa tu email para confirmar.';
      toast.success(msg);
      setIsLogin(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 p-4">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center">
            <Utensils className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="font-display text-3xl">
            {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </CardTitle>
          <CardDescription>
            {isLogin 
              ? 'Accede al panel de administración' 
              : 'Regístrate para gestionar el menú'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showForgotPassword ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
              </p>
              <Input
                type="email"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                placeholder="tu@email.com"
              />
              <Button
                className="w-full"
                disabled={isSubmitting}
                onClick={async () => {
                  if (!forgotEmail.trim()) {
                    toast.error('Ingresa tu email');
                    return;
                  }
                  setIsSubmitting(true);
                  const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
                    redirectTo: `${window.location.origin}/reset-password`,
                  });
                  setIsSubmitting(false);
                  if (error) {
                    toast.error(error.message);
                  } else {
                    toast.success('Se envió un enlace de recuperación a tu email');
                    setShowForgotPassword(false);
                  }
                }}
              >
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</>
                ) : (
                  'Enviar enlace de recuperación'
                )}
              </Button>
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                className="text-sm text-muted-foreground hover:text-primary transition-colors w-full text-center"
              >
                Volver al login
              </button>
            </div>
          ) : isLogin ? (
            <Form key="login" {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="admin@ejemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Ingresando...
                    </>
                  ) : (
                    'Ingresar'
                  )}
                </Button>
              </form>
            </Form>
          ) : (
            <Form key="signup" {...signUpForm}>
              <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-4">
                <FormField
                  control={signUpForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Juan Pérez" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signUpForm.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del negocio <span className="text-xs text-muted-foreground">(opcional · 30 días gratis)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="Mi Restaurante" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signUpForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="tu@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signUpForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signUpForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar contraseña</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando cuenta...
                    </>
                  ) : (
                    'Crear cuenta'
                  )}
                </Button>
              </form>
            </Form>
          )}
          
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                // Reset BOTH forms to avoid stale RHF state when switching providers
                loginForm.reset({ email: '', password: '' });
                loginForm.clearErrors();
                signUpForm.reset({ email: '', password: '', confirmPassword: '', fullName: '', businessName: '' });
                signUpForm.clearErrors();
                setIsSubmitting(false);
                setIsLogin((v) => !v);
              }}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {isLogin 
                ? '¿No tienes cuenta? Regístrate' 
                : '¿Ya tienes cuenta? Inicia sesión'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}