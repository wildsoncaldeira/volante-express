'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { ArrowLeft, DollarSign, ArrowDownRight, ArrowUpRight, Plus, Loader2, ListTodo, Package, Wallet, User } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function CaixaPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [profile, setProfile] = useState(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const [filterType, setFilterType] = useState('all');
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));

  // New Expense Form
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');

  useEffect(() => { loadCaixa(); }, [filterMonth]);

  async function loadCaixa() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setProfile(prof);

      // 1. Get Categories
      const { data: cats } = await supabase.from('expense_categories').select('*').order('name');
      setCategories(cats || []);

      // 2. Get Account
      let query = supabase.from('accounts').select('*').eq('type', 'carteira');
      if (prof?.region_id) query = query.eq('region_id', prof.region_id);
      
      const { data: accs } = await query;
      let targetAcc = null;
      if (accs && accs.length > 0) {
        targetAcc = prof?.region_id ? accs.find(a => a.region_id === prof.region_id) : accs[0];
        if (!targetAcc) targetAcc = accs[0];
      }

      if (!targetAcc) {
        setLoading(false);
        return;
      }
      setAccount(targetAcc);

      // 3. Fetch History
      const txs = [];

      
      const [anoStr, mesStr] = filterMonth.split('-');
      const monthStart = new Date(anoStr, mesStr - 1, 1).toISOString();
      const monthEnd = new Date(anoStr, mesStr, 0, 23, 59, 59).toISOString();

      // Appointments
      const { data: apps } = await supabase.from('appointments')
        .select('id, customer_name, vehicle_model, net_amount, completed_at, payment_method, is_split_payment, payment_method_2, net_amount_2, account_id, account_id_2')
        .eq('status', 'concluido')
        .gte('completed_at', monthStart)
        .lte('completed_at', monthEnd)
        .order('completed_at', { ascending: false });
        
      apps?.forEach(app => {
        if (app.payment_method === 'dinheiro' && app.account_id === targetAcc.id) {
          txs.push({ id: `app-${app.id}-1`, type: 'in', title: app.vehicle_model, subtitle: app.customer_name, amount: app.net_amount, date: new Date(app.completed_at) });
        }
        if (app.is_split_payment && app.payment_method_2 === 'dinheiro' && app.account_id_2 === targetAcc.id) {
          txs.push({ id: `app-${app.id}-2`, type: 'in', title: app.vehicle_model, subtitle: app.customer_name + ' (Parte 2)', amount: app.net_amount_2, date: new Date(app.completed_at) });
        }
      });

      // Expenses
      const { data: exps } = await supabase.from('expenses').select('*').eq('account_id', targetAcc.id).gte('date', monthStart).lte('date', monthEnd).order('date', { ascending: false });
      exps?.forEach(e => {
        const isPending = e.description.startsWith('[PENDENTE:');
        let displayAmount = e.amount;
        let displayTitle = e.description;
        if (isPending) {
          const match = e.description.match(/\[PENDENTE: R\$ ([\d.]+)\]/);
          if (match) displayAmount = parseFloat(match[1]);
        }
        txs.push({ id: `exp-${e.id}`, type: 'out', title: displayTitle, subtitle: e.category || 'Despesa', amount: displayAmount, date: new Date(e.date), pending: isPending });
      });

      // Transfers
      const { data: trOut } = await supabase.from('transfers').select('*').eq('from_account_id', targetAcc.id).gte('created_at', monthStart).lte('created_at', monthEnd);
      trOut?.forEach(t => txs.push({ id: `tr-${t.id}-out`, type: 'out', title: t.description || 'Transferência', subtitle: 'Enviada', amount: t.amount, date: new Date(t.date || t.created_at) }));

      const { data: trIn } = await supabase.from('transfers').select('*').eq('to_account_id', targetAcc.id).gte('created_at', monthStart).lte('created_at', monthEnd);
      trIn?.forEach(t => txs.push({ id: `tr-${t.id}-in`, type: 'in', title: t.description || 'Transferência', subtitle: 'Recebida', amount: t.amount, date: new Date(t.date || t.created_at) }));
// Sort by date desc
      txs.sort((a, b) => b.date - a.date);
      setTransactions(txs);

    } catch (e) {
      toast.error('Erro ao carregar caixa.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddSaida(e) {
    e.preventDefault();
    if (!desc || !amount || !categoryId) return toast.error('Preencha todos os campos!');
    setSubmitting(true);

    const val = parseFloat(amount);
    const pendingDesc = `[PENDENTE: R$ ${val.toFixed(2)}] ${desc}`;
    const selectedCat = categories.find(c => c.id === categoryId);

    const expensePayload = {
      description: pendingDesc,
      amount: 0, // IMPORTANT: Doesn't change actual total until approved by admin
      category: selectedCat?.name || 'Operacional',
      category_id: categoryId,
      account_id: account.id,
      region_id: profile?.region_id || null,
      date: new Date().toISOString()
    };

    const { error } = await supabase.from('expenses').insert([expensePayload]);
    setSubmitting(false);

    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      toast.success('Saída solicitada! Aguardando aprovação do admin.');
      setShowForm(false);
      setDesc(''); setAmount(''); setCategoryId('');
      loadCaixa();
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-950 pb-20 text-slate-200">
      <div className="bg-slate-900 p-4 shadow-lg border-b border-slate-800 flex items-center gap-4 sticky top-0 z-20">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"><ArrowLeft size={22} /></button>
        <h1 className="font-bold text-lg text-white">Meu Caixa</h1>
      </div>

      <main className="max-w-md mx-auto p-5 space-y-6">
        {!account ? (
          <div className="text-center py-10 bg-slate-900 rounded-2xl border border-slate-800">
            <DollarSign className="mx-auto text-slate-600 mb-3" size={40} />
            <p className="text-slate-400">Nenhum caixa encontrado para sua regional.</p>
          </div>
        ) : (
          <>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-900 p-6 rounded-3xl border border-slate-800 text-center relative overflow-hidden shadow-lg">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-green-500/10 blur-[50px] rounded-full"></div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 relative z-10">Saldo Atual ({account.name})</p>
              <h2 className="text-4xl font-extrabold text-white tracking-tight relative z-10">
                R$ {(account.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </h2>
            </motion.div>

            <AnimatePresence>
              {showForm ? (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-slate-900 p-5 rounded-3xl border border-slate-800 overflow-hidden">
                  <h3 className="font-bold text-white mb-4 flex items-center gap-2"><ArrowUpRight className="text-red-400" size={18} /> Solicitar Saída</h3>
                  <form onSubmit={handleAddSaida} className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-slate-400 mb-1 block">Descrição</label>
                      <input type="text" required className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-blue-500" placeholder="Ex: Combustível, Almoço..." value={desc} onChange={e => setDesc(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-400 mb-1 block">Valor (R$)</label>
                      <input type="number" step="0.01" required className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-blue-500" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-400 mb-1 block">Categoria</label>
                      <select required className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-blue-500" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                        <option value="">Selecione...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors">Cancelar</button>
                      <button type="submit" disabled={submitting} className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-500 transition-colors disabled:opacity-50">{submitting ? 'Enviando...' : 'Solicitar'}</button>
                    </div>
                  </form>
                </motion.div>
              ) : (
                <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setShowForm(true)} className="w-full bg-slate-900 border border-slate-800 border-dashed hover:border-slate-600 p-4 rounded-2xl flex items-center justify-center gap-2 text-slate-400 hover:text-white transition-colors">
                  <Plus size={18} /> Adicionar Saída
                </motion.button>
              )}
            </AnimatePresence>

            
            <div className="space-y-4 pt-2">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider pl-1">Histórico</h3>
                <div className="flex items-center gap-2">
                  <select 
                    value={filterType} 
                    onChange={e => { setFilterType(e.target.value); setVisibleCount(20); }}
                    className="bg-slate-900 text-slate-400 border border-slate-800 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-500 font-bold"
                  >
                    <option value="all">Todas</option>
                    <option value="in">Receitas</option>
                    <option value="out">Despesas</option>
                  </select>
                  <input
                    type="month"
                    value={filterMonth}
                    onChange={(e) => { setFilterMonth(e.target.value); setVisibleCount(20); }}
                    className="bg-slate-900 text-slate-400 border border-slate-800 rounded-lg px-2 py-1 text-xs outline-none focus:border-blue-500 font-bold cursor-pointer"
                  />
                </div>
              </div>

              {(() => {
                const filteredTxs = transactions.filter(tx => filterType === 'all' || tx.type === filterType);
                return filteredTxs.length === 0 ? (
                  <p className="text-center text-slate-500 py-6">Nenhuma movimentação encontrada.</p>
                ) : (
                  <motion.div key={filterType + '-' + filterMonth} className="space-y-3">
                    {filteredTxs.slice(0, visibleCount).map((tx, index) => (
                      <motion.div initial={{ opacity: 0, scale: 0.9, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 24, delay: (index % 20) * 0.1 }} key={tx.id} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${tx.type === 'in' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                          {tx.type === 'in' ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-200 text-sm">{tx.title}</p>
                          <p className="text-[10px] text-slate-500">{tx.subtitle} • {tx.date.toLocaleDateString('pt-BR')} {tx.date.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${tx.type === 'in' ? 'text-green-400' : 'text-red-400'}`}>
                          {tx.type === 'in' ? '+' : '-'}R$ {(tx.amount || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                        </p>
                        {tx.pending && <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Pendente</span>}
                      </div>
                    </motion.div>
                  ))}
                  {visibleCount < filteredTxs.length && (
                    <button 
                      onClick={() => setVisibleCount(prev => prev + 20)} 
                      className="w-full mt-4 p-3 rounded-xl border border-slate-800 text-slate-400 font-bold hover:bg-slate-800 transition-colors"
                    >
                      Carregar Mais
                    </button>
                    )}
                  </motion.div>
                )
              })()}
            </div>
          </>
        )}
      </main>

      
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 pb-6 pt-2 px-6 z-40">
        <div className="flex justify-around items-center">
          <button onClick={() => router.push('/')} className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-slate-300 transition-colors"><ListTodo size={24} strokeWidth={2} /><span className="text-[10px] font-medium">Agenda</span></button>
          <button onClick={() => router.push('/estoque')} className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-slate-300 transition-colors"><Package size={24} strokeWidth={2} /><span className="text-[10px] font-medium">Estoque</span></button>
          <button onClick={() => router.push('/extrato')} className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-slate-300 transition-colors"><Wallet size={24} strokeWidth={2} /><span className="text-[10px] font-medium">Comissões</span></button>
          <button onClick={() => router.push('/caixa')} className="flex flex-col items-center gap-1 p-2 text-blue-500 transition-colors"><DollarSign size={24} strokeWidth={2.5} /><span className="text-[10px] font-bold">Caixa</span></button>
          <button onClick={() => router.push('/?activeTab=perfil')} className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-slate-300 transition-colors"><User size={24} strokeWidth={2} /><span className="text-[10px] font-medium">Perfil</span></button>
        </div>
      </div>
    </div>
  );
}
