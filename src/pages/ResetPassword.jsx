import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import pb from '../lib/pocketbase';
import { Button, Input, Card, StatusModal } from '../components/UI';
import { ShieldCheck, Lock, Eye, EyeOff, Save } from 'lucide-react';
import Logo from '../components/Logo';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ isOpen: false, type: 'success', title: '', message: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setStatus({
        isOpen: true,
        type: 'error',
        title: 'Token Inválido',
        message: 'El enlace de recuperación es inválido o ha expirado.'
      });
      return;
    }

    if (password !== confirmPassword) {
      setStatus({
        isOpen: true,
        type: 'error',
        title: 'Error de Coincidencia',
        message: 'Las contraseñas no coinciden.'
      });
      return;
    }

    if (password.length < 8) {
      setStatus({
        isOpen: true,
        type: 'error',
        title: 'Contraseña Corta',
        message: 'La contraseña debe tener al menos 8 caracteres.'
      });
      return;
    }

    setLoading(true);
    try {
      await pb.collection('users').confirmPasswordReset(token, password, confirmPassword);
      
      setStatus({
        isOpen: true,
        type: 'success',
        title: '¡Todo listo!',
        message: 'Tu contraseña ha sido actualizada. Ahora puedes iniciar sesión con tu cuenta.'
      });

      // Redirect to login after a short delay
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      console.error('Reset error:', err);
      setStatus({
        isOpen: true,
        type: 'error',
        title: 'Error al actualizar',
        message: err.message || 'No pudimos actualizar tu contraseña. Es posible que el enlace haya expirado.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black selection:bg-emerald-500/30 flex items-center justify-center p-6 lg:p-12 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] -mr-40 -mt-40"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-teal-500/5 rounded-full blur-[100px] -ml-20 -mb-20"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <Logo size="lg" className="justify-center mb-8" />
          <h1 className="text-3xl font-black dark:text-white tracking-tight uppercase mb-2">Configura tu clave</h1>
          <p className="text-slate-500 dark:text-gray-400 font-bold text-xs uppercase tracking-widest pl-0.5">
            Crea una contraseña segura para acceder a SplitPay
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Nueva Contraseña"
            type={showPassword ? 'text' : 'password'}
            placeholder="Min. 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-slate-50 dark:bg-gray-900 border-none p-5 rounded-2xl font-bold dark:text-white"
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-2 text-slate-400 hover:text-emerald-500 transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            }
          />

          <Input
            label="Confirmar Contraseña"
            type={showPassword ? 'text' : 'password'}
            placeholder="Repite tu contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="bg-slate-50 dark:bg-gray-900 border-none p-5 rounded-2xl font-bold dark:text-white"
          />

          <Button 
            type="submit" 
            disabled={loading} 
            className="w-full py-5 h-auto rounded-3xl shadow-2xl shadow-emerald-500/20 active:scale-95 transition-all text-sm font-black"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <><Save size={18} /> Guardar Contraseña</>
            )}
          </Button>

          <div className="bg-slate-50 dark:bg-gray-900/50 p-6 rounded-[2rem] border border-slate-100 dark:border-gray-800 flex items-start gap-4">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">Tu Seguridad es Primero</p>
              <p className="text-xs text-slate-500 dark:text-gray-400 font-medium leading-relaxed">
                Tus datos están protegidos con cifrado de grado militar. Solo tú conoces tu contraseña.
              </p>
            </div>
          </div>
        </form>
      </div>

      <StatusModal 
        isOpen={status.isOpen}
        onClose={() => setStatus({ ...status, isOpen: false })}
        title={status.title}
        message={status.message}
        type={status.type}
      />
    </div>
  );
}
