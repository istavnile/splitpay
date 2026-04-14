import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import pb from '../lib/pocketbase';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import { CheckCircle2, LogIn, Loader } from 'lucide-react';

export default function JoinEvent() {
  const { id } = useParams();
  const { user, isValid, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState('loading'); // loading | joining | done | already | error | unauthenticated
  const [eventName, setEventName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!isValid) {
      // Store the join URL so Login can redirect back after auth
      localStorage.setItem('sp_join_redirect', `/join/${id}`);
      setState('unauthenticated');
      return;
    }
    processJoin();
  }, [id, isValid, authLoading]);

  const processJoin = async () => {
    setState('joining');
    try {
      // Fetch the event
      const event = await pb.collection('events').getOne(id);
      setEventName(event.nombre_evento);

      // If user is the owner, just redirect
      if (event.creado_por === user.id) {
        navigate(`/event/${id}`, { replace: true });
        return;
      }

      // Check if already a member
      const existing = await pb.collection('members').getFirstListItem(
        `id_evento = "${id}" && (id_usuario = "${user.id}" || email = "${user.email}")`
      ).catch(() => null);

      if (existing) {
        // Already a member — just patch id_usuario if missing and redirect
        if (!existing.id_usuario) {
          await pb.collection('members').update(existing.id, { id_usuario: user.id }).catch(() => {});
        }
        setState('already');
        setTimeout(() => navigate(`/event/${id}`, { replace: true }), 1200);
        return;
      }

      // Create members record
      await pb.collection('members').create({
        id_evento: id,
        email: user.email,
        id_usuario: user.id,
        rol: 'editor',
      });

      // Check if already a participant
      const existingParticipant = await pb.collection('participants').getFirstListItem(
        `id_evento = "${id}" && (id_usuario = "${user.id}" || email = "${user.email}")`
      ).catch(() => null);

      if (existingParticipant) {
        // Patch id_usuario if missing
        if (!existingParticipant.id_usuario) {
          await pb.collection('participants').update(existingParticipant.id, { id_usuario: user.id }).catch(() => {});
        }
      } else {
        // Create participant record
        await pb.collection('participants').create({
          id_evento: id,
          nombre: user.name || user.email.split('@')[0],
          email: user.email,
          id_usuario: user.id,
        });
      }

      setState('done');
      setTimeout(() => navigate(`/event/${id}`, { replace: true }), 1500);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'El evento no existe o el link es inválido.');
      setState('error');
    }
  };

  const goToLogin = () => {
    navigate(`/login`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-slate-100 dark:border-gray-800 p-8 shadow-xl text-center">
          {(state === 'loading' || state === 'joining') && (
            <>
              <div className="w-16 h-16 mx-auto mb-5 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                <Loader size={28} className="text-emerald-500 animate-spin" />
              </div>
              <p className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-gray-500">
                {state === 'loading' ? 'Verificando...' : 'Uniéndote al evento...'}
              </p>
            </>
          )}

          {state === 'done' && (
            <>
              <div className="w-16 h-16 mx-auto mb-5 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                <CheckCircle2 size={28} className="text-emerald-500" />
              </div>
              <h2 className="text-xl font-black dark:text-white uppercase tracking-tight mb-2">{eventName}</h2>
              <p className="text-sm font-bold text-emerald-500 uppercase tracking-widest">Te uniste al evento</p>
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-2">Redirigiendo...</p>
            </>
          )}

          {state === 'already' && (
            <>
              <div className="w-16 h-16 mx-auto mb-5 bg-indigo-500/10 rounded-2xl flex items-center justify-center">
                <CheckCircle2 size={28} className="text-indigo-500" />
              </div>
              <h2 className="text-xl font-black dark:text-white uppercase tracking-tight mb-2">{eventName}</h2>
              <p className="text-sm font-bold text-indigo-500 uppercase tracking-widest">Ya eres participante</p>
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-2">Redirigiendo...</p>
            </>
          )}

          {state === 'unauthenticated' && (
            <>
              <div className="w-16 h-16 mx-auto mb-5 bg-slate-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center">
                <LogIn size={28} className="text-slate-400" />
              </div>
              <h2 className="text-xl font-black dark:text-white uppercase tracking-tight mb-2">Únete al evento</h2>
              <p className="text-sm text-slate-500 dark:text-gray-400 mb-6">
                Inicia sesión o regístrate para unirte a este evento compartido.
              </p>
              <button
                onClick={goToLogin}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
              >
                Iniciar Sesión
              </button>
            </>
          )}

          {state === 'error' && (
            <>
              <div className="w-16 h-16 mx-auto mb-5 bg-rose-500/10 rounded-2xl flex items-center justify-center">
                <span className="text-3xl">🔗</span>
              </div>
              <h2 className="text-xl font-black dark:text-white uppercase tracking-tight mb-2">Link inválido</h2>
              <p className="text-sm text-slate-500 dark:text-gray-400 mb-6">{errorMsg}</p>
              <button
                onClick={() => navigate('/', { replace: true })}
                className="w-full py-4 bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-gray-300 font-black uppercase tracking-widest text-xs rounded-2xl transition-all"
              >
                Volver al Inicio
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
