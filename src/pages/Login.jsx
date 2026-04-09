import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button, Input, Card } from '../components/UI';
import { LogIn, UserPlus, Fingerprint, Sun, Moon, Info, HelpCircle, ChevronDown, CheckCircle2, ShieldCheck, Globe, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import pb from '../lib/pocketbase';

const FAQItem = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-slate-100 dark:border-gray-800 last:border-0">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-4 flex items-center justify-between text-left group"
      >
        <span className="text-sm font-bold dark:text-gray-200 group-hover:text-emerald-500 transition-colors uppercase tracking-tight">{question}</span>
        <ChevronDown size={18} className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="pb-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-xs leading-relaxed text-slate-500 dark:text-gray-400 font-medium">{answer}</p>
        </div>
      )}
    </div>
  );
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      }
      await login(email, password);
      navigate('/');
    } catch (err) {
      console.error('Auth error:', err);
      let msg = err.message || 'Error en la operación';
      
      // Handle "Email already exists" specially (Invited users flow)
      if (msg.toLowerCase().includes('unique') || (err.data && JSON.stringify(err.data).toLowerCase().includes('unique'))) {
        try {
          await pb.collection('users').requestPasswordReset(email);
          msg = '¡Te encontramos! Ya tenías una invitación de SplitPay. Te acabamos de enviar un enlace a tu correo para que elijas tu contraseña e ingreses ahora mismo.';
        } catch (resetErr) {
          msg = 'Este correo ya está registrado. Intenta iniciar sesión o recuperar tu clave.';
        }
      } else if (msg.includes('Failed to create record')) {
        msg = 'La cuenta ya existe o los datos son inválidos. Intenta iniciar sesión.';
      }
      
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-white dark:bg-black selection:bg-emerald-500/30">
      
      {/* Left Column: Visuals & Branding */}
      <section className="hidden lg:flex lg:col-span-7 bg-slate-50 dark:bg-gray-950 relative overflow-hidden flex-col p-16 justify-between border-r border-slate-100 dark:border-gray-900">
         {/* Decorative blobs */}
         <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] -mr-40 -mt-40 animate-pulse"></div>
         <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px] -ml-20 -mb-20"></div>
         
         <div className="relative z-10">
            <Logo size="lg" />
            <div className="mt-20 max-w-xl">
               <h1 className="text-6xl font-black dark:text-white leading-[1.1] tracking-tighter mb-6">
                  GESTIONA TUS <span className="text-emerald-500">GASTOS</span><br/>COMO UN PROFESIONAL.
               </h1>
               <p className="text-lg text-slate-500 dark:text-gray-400 font-medium leading-relaxed mb-8">
                  La plataforma definitiva para dividir gastos con amigos, familia o equipos sin complicaciones. Cuentas claras, amistades largas.
               </p>
               <div className="grid grid-cols-2 gap-6">
                  {[
                    { icon: CheckCircle2, text: 'Sincronización en tiempo real' },
                    { icon: ShieldCheck, text: 'Privacidad total de tus datos' },
                    { icon: Globe, text: 'Acceso desde cualquier dispositivo' },
                    { icon: HelpCircle, text: 'Invitaciones simples por email' }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm font-bold dark:text-gray-300">
                       <item.icon size={18} className="text-emerald-500" />
                       <span className="uppercase tracking-tight opacity-80">{item.text}</span>
                    </div>
                  ))}
               </div>
            </div>
         </div>

         <div className="relative z-10 pt-10 border-t border-slate-200 dark:border-gray-800">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-6">Preguntas Frecuentes</p>
            <div className="max-w-lg space-y-2">
               <FAQItem 
                  question="¿Qué es SplitPay?" 
                  answer="Es una herramienta premium diseñada para simplificar el reparto de gastos grupales. Ya sea un viaje, una cena o gastos del hogar, SplitPay calcula quién debe a quién automáticamente." 
               />
               <FAQItem 
                  question="¿Mis datos están seguros?" 
                  answer="Absolutamente. Utilizamos PocketBase para almacenamiento privado y local. Tus transacciones son tuyas y de nadie más." 
               />
               <FAQItem 
                  question="¿Cómo invito a mis amigos?" 
                  answer="Dentro de cada evento, verás un botón de 'Invitar'. Solo introduce su email y el sistema se encargará del resto." 
               />
            </div>
         </div>
      </section>

      {/* Right Column: Auth Form */}
      <section className="lg:col-span-5 flex items-center justify-center p-8 lg:p-20 relative pt-32 lg:pt-20">
        {/* Mobile Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-8 flex justify-between lg:hidden items-center bg-white/80 dark:bg-black/80 backdrop-blur-md z-50 border-b border-slate-100 dark:border-gray-900">
           <Logo size="sm" />
           <Button variant="ghost" onClick={toggleTheme} className="rounded-2xl w-10 h-10 p-0 bg-slate-50 dark:bg-gray-900 border-none">
              {theme === 'dark' ? <Sun size={18} className="text-white" /> : <Moon size={18} />}
           </Button>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-black dark:text-white tracking-tight uppercase mb-2">
               {isRegistering ? 'Únete a nosotros' : 'Bienvenido de nuevo'}
            </h2>
            <p className="text-slate-500 dark:text-gray-400 font-bold text-xs uppercase tracking-widest pl-0.5">
               {isRegistering ? 'Empieza a dividir gastos hoy mismo' : 'Tu centro de control financiero'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {isRegistering && (
              <Input
                label="Tu Nombre Completo"
                placeholder="Ej. Cristian Bonilla"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-slate-50 dark:bg-gray-900 border-none p-5 rounded-2xl font-bold dark:text-white"
              />
            )}
            
            <Input
              label="Correo Electrónico"
              type="email"
              placeholder="nombre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-slate-50 dark:bg-gray-900 border-none p-5 rounded-2xl font-bold dark:text-white"
            />

            <Input
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
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

            {error && (
              <div className="bg-rose-500/5 border border-rose-500/10 text-rose-500 text-[10px] font-black p-4 rounded-xl text-center uppercase tracking-[0.1em] animate-in fade-in duration-300">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full py-5 h-auto rounded-2xl shadow-2xl shadow-emerald-500/20 active:scale-95 transition-all text-sm font-black">
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : isRegistering ? (
                <><UserPlus size={18} /> Crear Cuenta Gratis</>
              ) : (
                <><LogIn size={18} /> Iniciar Sesión</>
              )}
            </Button>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-100 dark:border-gray-900 text-center">
            <button
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-slate-500 dark:text-gray-400 font-bold text-xs uppercase tracking-widest hover:text-emerald-500 transition-colors"
            >
              {isRegistering ? '¿Ya eres miembro? Inicia sesión' : '¿Nuevo aquí? Crea tu cuenta'}
            </button>
          </div>
        </div>

        {/* Floating Theme Toggle (Desktop Only) */}
        <div className="absolute bottom-10 right-10 hidden lg:block">
           <Button variant="ghost" onClick={toggleTheme} className="rounded-2xl w-12 h-12 p-0 bg-slate-50 dark:bg-gray-900 border-none shadow-sm overflow-hidden">
              {theme === 'dark' ? <Sun size={20} className="text-white" /> : <Moon size={20} />}
           </Button>
        </div>
      </section>

      {/* FAQ for Mobile */}
      <section className="lg:hidden p-8 bg-slate-50 dark:bg-gray-950 border-t border-slate-100 dark:border-gray-900">
         <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-6">Preguntas Frecuentes</p>
         <div className="space-y-2">
            <FAQItem question="¿Qué es SplitPay?" answer="Es una herramienta premium diseñada para simplificar el reparto de gastos grupales." />
            <FAQItem question="¿Mis datos están seguros?" answer="Absolutamente. Utilizamos PocketBase para almacenamiento privado y local." />
         </div>
      </section>

    </div>
  );
}
