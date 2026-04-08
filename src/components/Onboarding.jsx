import React, { useState, useEffect } from 'react';
import { Card, Button } from './UI';
import { X, ChevronRight, Zap, Users, Wallet, CheckCircle2, Star } from 'lucide-react';

const steps = [
  {
    title: "¡Bienvenido a SplitPay!",
    description: "Cuentas claras, amistades largas. Estás a punto de simplificar tu vida financiera con amigos y familia.",
    icon: Star,
    color: "bg-emerald-500",
  },
  {
    title: "Dashboard Inteligente",
    description: "Aquí verás el resumen de tus deudas, gastos totales y actividades recientes en tiempo real.",
    icon: Wallet,
    color: "bg-blue-500",
  },
  {
    title: "Colaboración Real",
    description: "Crea eventos e invita a tus amigos por email. Ellos podrán ver y añadir gastos al instante.",
    icon: Users,
    color: "bg-indigo-500",
  },
  {
    title: "Perfiles Premium",
    description: "Personaliza tu perfil con avatares, seguridad reforzada y temas oscuro/claro.",
    icon: Zap,
    color: "bg-rose-500",
  }
];

export default function Onboarding({ onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      finish();
    }
  };

  const finish = () => {
    if (dontShowAgain) {
      localStorage.setItem('splitpay_onboarding_seen', 'true');
    }
    onClose();
  };

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-500">
      <Card className="max-w-md w-full p-8 border-none shadow-2xl relative overflow-hidden bg-white dark:bg-gray-950" hover={false}>
        
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 flex gap-1">
          {steps.map((_, i) => (
            <div 
              key={i} 
              className={`flex-1 transition-all duration-500 ${i <= currentStep ? 'bg-emerald-500' : 'bg-slate-100 dark:bg-gray-800'}`}
            />
          ))}
        </div>

        <button 
          onClick={finish} 
          className="absolute top-6 right-6 text-slate-400 hover:text-rose-500 transition-colors"
        >
          <X size={24} />
        </button>

        <div className="flex flex-col items-center text-center mt-6">
          <div className={`w-20 h-20 rounded-[2rem] ${step.color} flex items-center justify-center text-white mb-8 shadow-2xl shadow-${step.color.split('-')[1]}-500/30 animate-in zoom-in-95 duration-500`}>
             <step.icon size={40} strokeWidth={2.5} />
          </div>
          
          <h2 className="text-3xl font-black dark:text-white tracking-tighter uppercase mb-4 leading-none">
            {step.title}
          </h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm font-medium leading-relaxed mb-10 max-w-[280px]">
            {step.description}
          </p>
        </div>

        <div className="flex flex-col gap-6">
           <Button 
              onClick={handleNext} 
              className="w-full py-4 h-auto rounded-2xl font-black shadow-xl shadow-emerald-500/20 active:scale-95 transition-all text-sm uppercase tracking-widest"
           >
              {currentStep === steps.length - 1 ? 'Empezar ahora' : 'Siguiente'}
              <ChevronRight size={18} />
           </Button>

           <div className="flex items-center justify-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer group">
                 <div className="relative">
                    <input 
                      type="checkbox" 
                      className="peer sr-only" 
                      checked={dontShowAgain}
                      onChange={(e) => setDontShowAgain(e.target.checked)}
                    />
                    <div className="w-5 h-5 border-2 border-slate-200 dark:border-gray-700 rounded-md peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-all"></div>
                    <CheckCircle2 size={12} className="absolute inset-0 m-auto text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-600 dark:group-hover:text-gray-200 transition-colors">
                    No volver a mostrar
                 </span>
              </label>
           </div>
        </div>
      </Card>
    </div>
  );
}
