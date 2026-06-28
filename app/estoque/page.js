'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Package, Search, ListTodo, Wallet, User, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function EstoquePage() {
    const router = useRouter();
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const [loading, setLoading] = useState(true);
    const [inventory, setInventory] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [regionName, setRegionName] = useState('Sua Região');
    const [profile, setProfile] = useState(null);
    const [user, setUser] = useState(null);
    const [invSortOrder, setInvSortOrder] = useState('qty_desc'); // qty_desc, qty_asc, name_asc

    useEffect(() => {
        fetchInventory();
    }, []);

    async function fetchInventory() {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            setUser(user);
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            setProfile(profileData);

            if (profileData?.region_id) {
                setRegionName(profileData.region_id);
                const { data: invData } = await supabase
                    .from('inventory')
                    .select('*')
                    .eq('region_id', profileData.region_id);

                setInventory(invData || []);
            }
        }
        setLoading(false);
    }

    const sortedInventory = [...inventory]
        .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
            if (invSortOrder === 'qty_desc') return b.quantity - a.quantity;
            if (invSortOrder === 'qty_asc') return a.quantity - b.quantity;
            return a.name.localeCompare(b.name);
        });

    return (
        <div className="min-h-screen bg-slate-950 pb-32 text-slate-200 font-sans">
            {/* Cabeçalho Padronizado Compacto */}
            <div className="bg-slate-900 py-4 px-6 rounded-b-[24px] shadow-2xl border-b border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-600/10 blur-[80px] rounded-full pointer-events-none"></div>
                <div className="flex items-between justify-between w-full relative z-10">
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
                        Estoque
                    </h1>
                </div>
                {/* Busca e Ordenação */}
                <div className="relative flex gap-3">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={18} className="text-slate-500" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar material..."
                            className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white outline-none focus:border-blue-500 transition-colors placeholder-slate-500 text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        value={invSortOrder}
                        onChange={(e) => setInvSortOrder(e.target.value)}
                        className="px-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-blue-500 cursor-pointer"
                    >
                        <option value="qty_desc">Mais Qtd</option>
                        <option value="qty_asc">Menos Qtd</option>
                        <option value="name_asc">Nome</option>
                    </select>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-400 text-sm uppercase ml-1 flex items-center gap-2">
                            <Package size={14} /> Itens Disponíveis
                        </h3>
                        <span className="text-xs font-bold bg-slate-800 text-slate-400 px-2 py-1 rounded-lg">{sortedInventory.length}</span>
                    </div>

                    {loading ? <div className="text-center py-10 text-slate-600 font-bold">Buscando estoque...</div> : (
                        <motion.div initial="hidden" animate="show" variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.2 } } }} className="space-y-3">
                            {sortedInventory.length === 0 && (
                                <div className="text-center py-10 border border-dashed border-slate-800 rounded-2xl">
                                    <Package size={32} className="mx-auto text-slate-700 mb-2" />
                                    <p className="text-slate-500 text-sm">Nenhum item encontrado.</p>
                                </div>
                            )}

                            {sortedInventory.map(item => {
                                const isLow = item.quantity <= item.min_threshold;
                                return (
                                    <motion.div variants={{ hidden: { opacity: 0, scale: 0.9, y: 15 }, show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } } }} key={item.id} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex justify-between items-center relative overflow-hidden group">
                                        {isLow && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500"></div>}

                                        <div className={`pl-${isLow ? '2' : '0'}`}>
                                            <h4 className="font-bold text-slate-200 text-base">{item.name}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${isLow ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                                                    {isLow ? 'Baixo Estoque' : 'Normal'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="text-right flex flex-col items-end">
                                            <span className={`text-2xl font-bold tracking-tight ${item.quantity === 0 ? 'text-red-500' : 'text-white'}`}>
                                                {item.quantity}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-medium uppercase">Unidades</span>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </motion.div>
                    )}
                </div>
            </main>

            <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 pb-6 pt-2 px-6 z-40">
                <div className="flex justify-around items-center">
                    <button onClick={() => router.push('/')} className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-slate-300 transition-colors">
                        <ListTodo size={24} />
                        <span className="text-[10px] font-medium">Agenda</span>
                    </button>
                    <button onClick={() => router.push('/estoque')} className="flex flex-col items-center gap-1 p-2 text-blue-500 transition-colors">
                        <Package size={24} strokeWidth={2.5} />
                        <span className="text-[10px] font-bold">Estoque</span>
                    </button>
                    <button onClick={() => router.push('/extrato')} className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-slate-300 transition-colors">
                        <Wallet size={24} />
                        <span className="text-[10px] font-medium">Comissões</span>
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
