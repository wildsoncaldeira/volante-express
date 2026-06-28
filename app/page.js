'use client';

import { useEffect, useState, Suspense } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Car, MapPin, Calendar, ChevronRight, Loader2, ListTodo, Wallet, User, Clock, Lock, LogOut, Camera, Package, Trophy } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// --- COMPONENTE INTERNO (Lógica Principal) ---
function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Agora o useSearchParams está seguro dentro do Suspense
  const isPreviewMode = searchParams.get('mode') === 'preview';

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState('agenda');

  // Metas
  const [monthlyGoal, setMonthlyGoal] = useState(0);
  const [completedInRegion, setCompletedInRegion] = useState(0);
  const [goalPercentage, setGoalPercentage] = useState(0);
  const [motivationalMessage, setMotivationalMessage] = useState('');

  useEffect(() => {
    const tabPref = searchParams.get('activeTab');
    if (tabPref) setActiveTab(tabPref);
    checkUser();
  }, [searchParams]);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push('/login');
      return;
    }

    const currentUser = session.user;
    setUser(currentUser);

    const email = currentUser.email;
    const isAdmin = email.includes('wildson') || email === 'admin@volantepro.app';

    // REGRA DE REDIRECIONAMENTO COM EXCEÇÃO (ESPIÃO)
    if (isAdmin && !isPreviewMode) {
      router.push('/admin');
      return;
    }

    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    setProfile(profileData);

    fetchData(currentUser.id);
    if (profileData?.region_id) {
      fetchMonthlyGoalAndProgress(profileData.region_id);
    }
    setupRealtime(currentUser.id, profileData?.region_id);
  }

  async function fetchMonthlyGoalAndProgress(regionId) {
    if (!regionId) return;

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    // 1. Fetch current month goal
    let { data: goalData } = await supabase
      .from('regional_goals')
      .select('goal_amount')
      .eq('region_id', regionId)
      .eq('month', currentMonth)
      .maybeSingle();

    let goal = goalData?.goal_amount;

    if (goal === undefined || goal === null) {
      // Fallback: get the most recent goal
      const { data: prevGoal } = await supabase
        .from('regional_goals')
        .select('goal_amount')
        .eq('region_id', regionId)
        .lt('month', currentMonth)
        .order('month', { ascending: false })
        .limit(1);
      if (prevGoal && prevGoal.length > 0) {
        goal = prevGoal[0].goal_amount;
      } else {
        goal = 0; // No goal defined at all
      }
    }

    const goalNum = Number(goal);
    setMonthlyGoal(goalNum);

    // 2. Fetch completed appointments in region for current month
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).toISOString();

    const { count } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('region_id', regionId)
      .eq('status', 'concluido')
      .gte('completed_at', startOfMonth)
      .lte('completed_at', endOfMonth);

    const completed = count || 0;
    setCompletedInRegion(completed);

    let currentPercentage = 0;
    if (goalNum > 0) {
      currentPercentage = (completed / goalNum) * 100;
      setGoalPercentage(currentPercentage);
    } else {
      setGoalPercentage(0);
    }

    // 3. Set random motivational message based on percentage
    let messages = [];
    if (currentPercentage <= 25) {
      messages = [
        "Bora acelerar! O mês apenas começou, vamos buscar o primeiro volante!",
        "Excelente trabalho! Cada volante instalado nos deixa mais perto da meta."
      ];
    } else if (currentPercentage <= 50) {
      messages = [
        "Bom ritmo! Já estamos nos aproximando da metade, mantenha o foco!",
        "Foco total! O sucesso é a soma de pequenos esforços diários."
      ];
    } else if (currentPercentage <= 75) {
      messages = [
        "Já passamos da metade! Continue firme para garantir o resultado!",
        "Mais um cliente satisfeito, mais um passo rumo à vitória!"
      ];
    } else if (currentPercentage < 100) {
      messages = [
        "Falta muito pouco! Estamos na reta final para bater a meta!",
        "A determinação de hoje é o resultado de amanhã. Vamos com tudo!"
      ];
    } else {
      messages = [
        "Sensacional! Meta batida com sucesso! Vamos continuar acelerando!",
        "Trabalho em equipe faz o sonho funcionar. Parabéns pela meta alcançada!"
      ];
    }
    const randomIndex = Math.floor(Math.random() * messages.length);
    setMotivationalMessage(messages[randomIndex]);
  }

  async function fetchData(userId) {
    const { data: apps } = await supabase
      .from('appointments')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'concluido')
      .neq('status', 'cancelado')
      .order('appointment_at', { ascending: true });

    setAppointments(apps || []);
    setLoading(false);
  }

  function setupRealtime(userId, regionId) {
    const channel = supabase
      .channel('installer-view')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments', filter: `user_id=eq.${userId}` },
        () => {
          fetchData(userId);
          if (regionId) {
            fetchMonthlyGoalAndProgress(regionId);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }

  function formatDate(dateString) {
    if (!dateString) return 'Data a definir';
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const dDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dTomorrow = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());

    let prefix = "";
    if (dDate.getTime() === dToday.getTime()) {
      prefix = "Hoje";
    } else if (dDate.getTime() === dTomorrow.getTime()) {
      prefix = "Amanhã";
    } else {
      const days = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
      prefix = days[date.getDay()];
    }

    const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `${prefix}, ${formattedDate} às ${time}`;
  }

  const handleNewService = async () => {
    const model = prompt("Qual o modelo do veículo?");
    if (!model) return;
    setCreating(true);
    const { data, error } = await supabase.from('appointments').insert([{
      user_id: user.id, vehicle_model: model, customer_name: 'Cliente Avulso',
      status: 'agendado', appointment_at: new Date().toISOString(),
      region_id: profile?.region_id || 'divinopolis'
    }]).select().single();
    if (error) toast.error('Erro: ' + error.message);
    else router.push(`/atendimento/${data.id}`);
    setCreating(false);
  };

  const openWhatsApp = (e, phone) => {
    e.stopPropagation();
    if (!phone) return toast.error('Cliente sem número de telefone cadastrado.');
    let num = phone.replace(/\D/g, '');
    if (num.length === 10 || num.length === 11) num = '55' + num;
    window.open(`https://wa.me/${num}`, '_blank');
  };

  async function handleLogout() { await supabase.auth.signOut(); router.push('/login'); }

  async function handleUpdatePassword() {
    const newPass = prompt("Digite a nova senha (mínimo 6 dígitos):");
    if (!newPass) return;
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) toast.error('Erro: ' + error.message); else toast.success('Senha alterada com sucesso!');
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-32 font-sans">
      <div className="bg-slate-900 py-4 px-6 rounded-b-[24px] shadow-2xl border-b border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-600/10 blur-[80px] rounded-full pointer-events-none"></div>
        <div className="flex items-center justify-between w-full relative z-10">
          <div className="flex flex-col items-start gap-1">
            <img src="/icon-horizontal.png" alt="Volante Express" className="h-10 object-contain drop-shadow-md" />
          </div>
          <div className="text-right flex flex-col items-end">
            <span className="text-slate-400 text-xs font-medium">Bem-vindo,</span>
            <span className="text-blue-400 font-extrabold text-sm leading-tight mt-0.5">
              {profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0]}
            </span>
          </div>
        </div>
      </div>

      <main className="p-6 space-y-6">
        <AnimatePresence mode="wait">
        {activeTab === 'perfil' && (
          <motion.div key="perfil" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="text-center">
            <h1 className="text-lg text-slate-400 font-anton-italic-bold">
              Perfil
            </h1>
          </motion.div>
        )}
        {activeTab === 'agenda' && (
          <motion.div key="agenda" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-6">
            {/* CARD DE METAS */}
            {monthlyGoal > 0 && (
              <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 relative overflow-hidden shadow-lg">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Trophy size={12} className="text-yellow-500" /> META DO MÊS</h4>
                    <p className="text-lg font-bold text-white mt-1">{completedInRegion} de {monthlyGoal} Volantes</p>
                  </div>
                  <span className="text-lg font-extrabold text-blue-500 bg-blue-950/40 px-3 py-1 rounded-xl border border-blue-900/30">
                    {Math.round(goalPercentage)}%
                  </span>
                </div>
                <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(goalPercentage, 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-slate-400 italic mt-3 flex items-center gap-1.5">
                  ✨ {motivationalMessage}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between"><h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2"><Calendar size={14} /> Serviços Pendentes</h3><span className="text-xs bg-slate-800 text-slate-500 px-2 py-1 rounded-lg">{appointments.length} itens</span></div>
             <div className="space-y-3">
              {appointments.length === 0 && (<div className="text-center py-12 border border-dashed border-slate-800 rounded-3xl bg-slate-900/30"><Car size={40} className="mx-auto text-slate-700 mb-3" /><p className="text-slate-500 text-sm font-medium">Tudo limpo por aqui.</p><p className="text-slate-600 text-xs mt-1">Aguarde novos agendamentos.</p></div>)}
              {(() => {
                let lastDate = null;
                return appointments.map(app => {
                  const appDate = app.appointment_at ? new Date(app.appointment_at).toDateString() : 'no-date';
                  const showDivider = appDate !== lastDate;
                  if (showDivider) {
                    lastDate = appDate;
                  }

                  let dividerLabel = "Data a definir";
                  if (app.appointment_at) {
                    const date = new Date(app.appointment_at);
                    const today = new Date();
                    const tomorrow = new Date();
                    tomorrow.setDate(today.getDate() + 1);

                    const dDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                    const dToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    const dTomorrow = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());

                    let prefix = "";
                    if (dDate.getTime() === dToday.getTime()) prefix = "Hoje";
                    else if (dDate.getTime() === dTomorrow.getTime()) prefix = "Amanhã";
                    else {
                      const days = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
                      prefix = days[date.getDay()];
                    }
                    dividerLabel = `${prefix}, ${date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}`;
                  }

                  return (
                    <motion.div key={app.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }} className="space-y-3">
                      {showDivider && (
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-6 mb-2 border-l-2 border-blue-500 pl-2 text-left">
                          {dividerLabel}
                        </div>
                      )}
                      <div onClick={() => router.push(`/atendimento/${app.id}`)} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 relative overflow-hidden active:scale-95 transition-transform cursor-pointer hover:border-blue-500/30 shadow-md">
                        <div className="absolute top-0 right-0 bg-slate-800 pl-3 pr-2 py-1 rounded-bl-xl border-b border-l border-slate-700 flex items-center gap-1"><MapPin size={10} className="text-blue-400" /><span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide truncate max-w-[100px]">{app.calendar_name || app.region_id || 'Regional'}</span></div>
                        <div className="flex items-start gap-4 mt-2">
                          <div className="flex-1">
                            <h4 className="font-bold text-white text-lg leading-tight">{app.vehicle_model}</h4>
                            <p className="text-xs text-slate-500 mb-2">{app.customer_name}</p>
                            <div className="inline-flex items-center gap-1.5 bg-slate-950/50 px-2 py-1 rounded-lg border border-slate-800/50">
                              <Clock size={12} className="text-blue-500" />
                              <span className="text-xs font-medium text-slate-300 whitespace-nowrap">{formatDate(app.appointment_at)}</span>
                            </div>
                          </div>
                          <div className="self-center flex items-center gap-2">
                            {app.customer_phone && (
                              <button
                                onClick={(e) => openWhatsApp(e, app.customer_phone)}
                                className="bg-[#25D366]/10 hover:bg-[#25D366]/20 p-2.5 rounded-full border border-[#25D366]/20 transition-all shadow-[0_0_10px_rgba(37,211,102,0.1)] hover:shadow-[0_0_15px_rgba(37,211,102,0.3)] hover:scale-105 active:scale-95 flex items-center justify-center"
                                title="Chamar no WhatsApp"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#25D366" className="drop-shadow-sm">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" /></svg>
                              </button>
                            )}
                            <ChevronRight className="text-slate-600" size={16} />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                });
              })()}
            </div>
          </motion.div>
        )}
        {activeTab === 'perfil' && (
          <motion.div key="perfil-content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="space-y-6">
            {/* Perfil Info Card */}
            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 text-center relative overflow-hidden shadow-lg">
              <div className="w-24 h-24 bg-slate-800 rounded-full mx-auto mb-4 border-4 border-slate-700 flex items-center justify-center relative shadow-inner">
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover rounded-full" /> : <User size={40} className="text-slate-500" />}
                <button className="absolute bottom-0 right-0 bg-blue-600 p-2 rounded-full text-white hover:bg-blue-500 shadow-md transition-transform active:scale-90">
                  <Camera size={14} />
                </button>
              </div>
              <h2 className="text-xl font-bold text-white">{profile?.full_name || 'Instalador'}</h2>
              <p className="text-slate-400 text-sm mt-1">{user?.email}</p>
              <span className="inline-block mt-3 px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-300 font-bold uppercase tracking-wider border border-slate-700/50">
                {profile?.region_id || 'Sem Regional'}
              </span>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button onClick={handleUpdatePassword} className="w-full bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center justify-between group hover:border-blue-500/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="bg-slate-800 p-2 rounded-xl text-slate-400 group-hover:text-blue-400"><Lock size={20} /></div>
                  <div className="text-left">
                    <h4 className="text-slate-200 font-bold">Alterar Senha</h4>
                    <p className="text-xs text-slate-500">Atualize sua segurança</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-600" />
              </button>
              <button onClick={handleLogout} className="w-full bg-red-950/20 p-4 rounded-2xl border border-red-900/30 flex items-center justify-between group hover:bg-red-950/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="bg-red-900/20 p-2 rounded-xl text-red-500"><LogOut size={20} /></div>
                  <div className="text-left">
                    <h4 className="text-red-400 font-bold">Sair da Conta</h4>
                    <p className="text-xs text-red-500/60">Encerrar sessão</p>
                  </div>
                </div>
              </button>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </main>

      {activeTab === 'agenda' && (<button onClick={handleNewService} disabled={creating} className="fixed bottom-24 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-500 rounded-2xl shadow-lg shadow-blue-600/30 flex items-center justify-center text-white transition-transform active:scale-90 z-30">{creating ? <Loader2 className="animate-spin" /> : <Plus size={28} />}</button>)}

      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 pb-6 pt-2 px-6 z-40">
        <div className="flex justify-around items-center">
          <button onClick={() => setActiveTab('agenda')} className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeTab === 'agenda' ? 'text-blue-500' : 'text-slate-500'}`}><ListTodo size={24} strokeWidth={activeTab === 'agenda' ? 2.5 : 2} /><span className="text-[10px] font-bold">Agenda</span></button>
          <button onClick={() => router.push('/estoque')} className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-slate-300 transition-colors"><Package size={24} /><span className="text-[10px] font-medium">Estoque</span></button>
          <button onClick={() => router.push('/extrato')} className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-slate-300 transition-colors"><Wallet size={24} /><span className="text-[10px] font-medium">Comissões</span></button>
          <button onClick={() => setActiveTab('perfil')} className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeTab === 'perfil' ? 'text-blue-500' : 'text-slate-500'}`}><User size={24} strokeWidth={activeTab === 'perfil' ? 2.5 : 2} /><span className="text-[10px] font-bold">Perfil</span></button>
        </div>
      </div>
    </div>
  );
}

// --- COMPONENTE EXPORTADO (A Proteção) ---
export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>}>
      <HomeContent />
    </Suspense>
  );
}