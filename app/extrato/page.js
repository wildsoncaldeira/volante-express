'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Wallet, Calendar, TrendingUp, ListTodo, User, Package, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ExtratoPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [totalCommission, setTotalCommission] = useState(0);
  const [viewType, setViewType] = useState('semanal'); // 'semanal' ou 'mensal'
  const [currentWeekDate, setCurrentWeekDate] = useState(new Date());
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchCommissions();
  }, [month, viewType, currentWeekDate]);

  function getWeekRange(baseDate) {
    const current = new Date(baseDate);
    const day = current.getDay();
    // Monday as first day of the week
    const diff = current.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(current.setDate(diff));
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  async function fetchCommissions() {
    setLoading(true);
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (currentUser) {
      setUser(currentUser);
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
      setProfile(profileData);

      let startRange, endRange;

      if (viewType === 'mensal') {
        const [ano, mes] = month.split('-');
        startRange = new Date(ano, mes - 1, 1).toISOString();
        endRange = new Date(ano, mes, 0, 23, 59, 59).toISOString();
      } else {
        const { start, end } = getWeekRange(currentWeekDate);
        startRange = start.toISOString();
        endRange = end.toISOString();
      }

      const { data: services, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('status', 'concluido')
        .gte('completed_at', startRange)
        .lte('completed_at', endRange)
        .order('completed_at', { ascending: false });

      if (services) {
        setTransactions(services);
        const total = services.reduce((acc, curr) => acc + (Number(curr.commission_amount) || 0), 0);
        setTotalCommission(total);
      }
    }
    setLoading(false);
  }

  const { start: weekStart, end: weekEnd } = getWeekRange(currentWeekDate);

  return (
    <div className="min-h-screen bg-slate-950 pb-32 text-slate-200 font-sans">
      <div className="bg-slate-900 py-4 px-6 rounded-b-[24px] shadow-2xl border-b border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-600/10 blur-[80px] rounded-full pointer-events-none"></div>
        <div className="flex items-center justify-between w-full relative z-10">
          <div className="flex items-center gap-3">
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

      <main className="max-w-md mx-auto p-5 space-y-6">
        <div className="text-center">
          <h1 className="text-lg text-slate-400 font-anton-italic-bold">
            Comissões
          </h1>
        </div>
        {/* Toggle Semanal / Mensal */}
        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 max-w-xs mx-auto">
          <button
            onClick={() => setViewType('semanal')}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all ${
              viewType === 'semanal' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Semanal
          </button>
          <button
            onClick={() => setViewType('mensal')}
            className={`flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all ${
              viewType === 'mensal' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Mensal
          </button>
        </div>

        {/* Date Filter Controls */}
        {viewType === 'semanal' ? (
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-2 rounded-2xl">
            <button
              onClick={() => {
                const prev = new Date(currentWeekDate);
                prev.setDate(prev.getDate() - 7);
                setCurrentWeekDate(prev);
              }}
              className="p-2 text-slate-400 hover:text-white bg-slate-950 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold text-slate-300">
              Semana: {weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a{' '}
              {weekEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </span>
            <button
              onClick={() => {
                const next = new Date(currentWeekDate);
                next.setDate(next.getDate() + 7);
                setCurrentWeekDate(next);
              }}
              className="p-2 text-slate-400 hover:text-white bg-slate-950 rounded-xl hover:bg-slate-800 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        ) : (
          <div className="flex justify-end">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="bg-slate-900 text-slate-400 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 font-bold cursor-pointer"
            />
          </div>
        )}

        {/* Commissions Card */}
        <div className="bg-gradient-to-br from-green-600 to-emerald-800 p-6 rounded-3xl shadow-xl shadow-green-900/20 text-white relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-green-100 text-sm font-medium mb-1 flex items-center gap-2">
              <Wallet size={16} />{' '}
              {viewType === 'semanal'
                ? 'Comissões da Semana'
                : `Comissões em ${month.split('-')[1]}/${month.split('-')[0]}`}
            </p>
            <h2 className="text-4xl font-bold tracking-tight">R$ {totalCommission.toFixed(2)}</h2>
            <p className="text-green-200 text-xs mt-2 opacity-80">{transactions.length} serviços realizados</p>
          </div>
          <TrendingUp className="absolute right-4 bottom-4 text-green-400 opacity-20" size={80} />
        </div>

        {/* Transactions List */}
        <div className="space-y-4">
          <h3 className="font-bold text-slate-400 text-sm uppercase ml-1">
            {viewType === 'semanal' ? 'Histórico da Semana' : 'Histórico do Mês'}
          </h3>

          {loading ? (
            <div className="text-center py-10 text-slate-600 font-bold">Carregando...</div>
          ) : (
            <div className="space-y-3">
              {transactions.length === 0 && (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-3xl bg-slate-900/20">
                  <p className="text-slate-500 text-sm">Nenhum serviço finalizado neste período.</p>
                </div>
              )}

              {transactions.map((t) => (
                <div key={t.id} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex justify-between items-center shadow-md hover:border-slate-700 transition-colors">
                  <div>
                    <p className="font-bold text-white text-sm">{t.vehicle_model}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                      <Calendar size={10} /> {new Date(t.completed_at).toLocaleDateString()} •{' '}
                      {new Date(t.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="block font-bold text-green-400">+ R$ {Number(t.commission_amount).toFixed(2)}</span>
                    <span className="text-[10px] text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full uppercase mt-1 inline-block font-bold">
                      Concluído
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 pb-6 pt-2 px-6 z-40">
        <div className="flex justify-around items-center">
          <button onClick={() => router.push('/')} className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-slate-300 transition-colors">
            <ListTodo size={24} />
            <span className="text-[10px] font-medium">Agenda</span>
          </button>
          <button onClick={() => router.push('/estoque')} className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-slate-300 transition-colors">
            <Package size={24} />
            <span className="text-[10px] font-medium">Estoque</span>
          </button>
          <button onClick={() => router.push('/extrato')} className="flex flex-col items-center gap-1 p-2 text-blue-500 transition-colors">
            <Wallet size={24} strokeWidth={2.5} />
            <span className="text-[10px] font-bold">Comissões</span>
          </button>
          <button onClick={() => router.push('/?activeTab=perfil')} className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-slate-300 transition-colors">
            <User size={24} />
            <span className="text-[10px] font-medium">Perfil</span>
          </button>
        </div>
      </div>
    </div>
  );
}