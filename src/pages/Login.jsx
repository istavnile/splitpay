import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button, Input, Card } from '../components/UI';
import { LogIn, UserPlus, Fingerprint, Sun, Moon, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [infoModal, setInfoModal] = useState(false);

  const { login, register } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegistering) {
        if (!name) throw new Error('Ingresa tu nombre');
        await register(email, password, name);
        // Automatically login after register
      }
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Error en la operación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-950 dark:to-black transition-colors duration-500">
      <div className="absolute top-6 right-6">
        <Button variant="ghost" onClick={toggleTheme} className="rounded-full w-12 h-12 p-0">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </Button>
      </div>

      <Card className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-emerald-600/30">
            <Fingerprint size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">SplitPay</h1>
          <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">Cuentas claras, amistades largas</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {isRegistering && (
            <Input
              label="Tu Nombre"
              placeholder="Ej. Juan Pérez"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          
          <Input
            label="Correo Electrónico"
            type="email"
            placeholder="ejemplo@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Contraseña"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold p-3 rounded-xl text-center uppercase tracking-wide">
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading}>
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : isRegistering ? (
              <><UserPlus size={18} /> Crear Cuenta</>
            ) : (
              <><LogIn size={18} /> Iniciar Sesión</>
            )}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-gray-800 flex flex-col gap-4">
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-emerald-600 dark:text-emerald-400 font-bold text-sm hover:underline"
          >
            {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate gratis'}
          </button>
          
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Sistema PocketBase Online</span>
            <button onClick={() => setInfoModal(true)} className="ml-1 text-slate-400 hover:text-emerald-500 transition-colors">
              <Info size={14} />
            </button>
          </div>
        </div>
      </Card>

      {/* Info Modal */}
      {infoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="max-w-sm w-full animate-in zoom-in-95 duration-200" hover={false}>
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Info size={20} /> Información del Sistema
            </h2>
            <p className="text-sm text-slate-600 dark:text-gray-300 leading-relaxed">
              Esta aplicación utiliza un backend local **PocketBase** alojado en tu propio servidor. 
              Esto garantiza que tus datos sean privados, las conexiones sean instantáneas y el servicio nunca se pause.
            </p>
            <Button className="mt-6 w-full" onClick={() => setInfoModal(false)}>Entendido</Button>
          </Card>
        </div>
      )}
    </div>
  );
}
