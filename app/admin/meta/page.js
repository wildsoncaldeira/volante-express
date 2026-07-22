'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { createBrowserClient } from '@supabase/ssr';
import {
    TrendingDown, TrendingUp, Calendar, RefreshCcw, DollarSign,
    Users, Target, ArrowLeft, Play, Pause, Activity, CheckCircle, XCircle, Edit2, Map,
    LayoutDashboard, ListTodo, Banknote, Package, Settings, Smartphone, LogOut, Eye, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

export default function MetaAdsDashboard() {
    const router = useRouter();
    const activeTab = 'meta';
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    async function handleLogout() { 
        await supabase.auth.signOut(); 
        router.push('/login'); 
    }

    const BottomNav = () => (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-50 px-6 py-2 flex justify-between items-center safe-area-bottom overflow-x-auto">
            {['dashboard', 'atendimentos', 'financeiro', 'equipe', 'estoque', 'meta', 'configuracoes'].map(tab => (
                <button key={tab} onClick={() => { if (tab === 'meta') return; router.push(`/admin?tab=${tab}`); }} className={`flex flex-col items-center gap-1 p-2 flex-shrink-0 ${activeTab === tab ? 'text-blue-500' : 'text-slate-500'}`}>
                    {tab === 'dashboard' ? <LayoutDashboard size={22} /> : tab === 'atendimentos' ? <ListTodo size={22} /> : tab === 'financeiro' ? <Banknote size={22} /> : tab === 'equipe' ? <Users size={22} /> : tab === 'estoque' ? <Package size={22} /> : tab === 'meta' ? <Target size={22} /> : <Settings size={22} />}
                </button>
            ))}
        </div>
    );

    const [loading, setLoading] = useState(true);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [dateRange, setDateRange] = useState('today'); // default hoje
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [insightsData, setInsightsData] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [rawAdSetsInsights, setRawAdSetsInsights] = useState([]);
    const [viewMode, setViewMode] = useState('cities'); // 'cities' | 'campaigns'
    const [selectedCityFilter, setSelectedCityFilter] = useState('Todas');
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [lastUpdate, setLastUpdate] = useState(null);
    
    // Função para formatar a data da última atualização
    const formatLastUpdate = (date) => {
        if (!date) return '';
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Atualizado agora mesmo';
        if (diffMins < 60) return `Atualizado há ${diffMins} min`;
        return `Atualizado às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    };
    
    // Mocks iniciais para UI - Substituiremos pela chamada real à API
    useEffect(() => {
        const fetchInsights = async () => {
            if (dateRange === 'custom' && (!customStart || !customEnd)) return; // Aguarda preencher ambas
            setLoading(true);
            try {
                let insightsUrl = `/api/meta/insights?range=${dateRange}`;
                if (dateRange === 'custom') {
                    insightsUrl += `&start=${customStart}&end=${customEnd}`;
                }

                const [insightsRes, campRes] = await Promise.all([
                    fetch(insightsUrl),
                    fetch(`/api/meta/campaigns`)
                ]);
                
                const insightsJson = await insightsRes.json();
                const campJson = await campRes.json();
                
                if (insightsJson.error) {
                    toast.error(insightsJson.error);
                } else {
                    setInsightsData(insightsJson.data || []);
                    setRawAdSetsInsights(insightsJson.rawAdSets || []);
                }

                if (campJson.error) toast.error(campJson.error);
                else setCampaigns(campJson.data || []);

                setLastUpdate(new Date());
                setLoading(false);
            } catch (error) {
                console.error(error);
                toast.error('Erro ao buscar dados do Meta Ads');
                setLoading(false);
            }
        };
        fetchInsights();
    }, [dateRange, customStart, customEnd, refreshTrigger]);

    const handleToggleStatus = async (objectId, currentStatus) => {
        const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
        toast.loading('Atualizando status...', { id: 'toggle' });
        
        try {
            const res = await fetch('/api/meta/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ objectId, action: 'status', value: newStatus })
            });
            const json = await res.json();
            
            if (json.error) {
                toast.error(json.error, { id: 'toggle' });
            } else if (json.message && json.message.includes('simulação')) {
                toast.success('Simulação: Status alterado (configure o token real)', { id: 'toggle' });
                // Atualiza UI simulada
                setCampaigns(prev => prev.map(c => ({
                    ...c, 
                    status: c.id === objectId ? newStatus : c.status,
                    adsets: c.adsets.map(a => ({
                        ...a,
                        status: a.id === objectId ? newStatus : a.status
                    }))
                })));
            } else {
                toast.success('Status atualizado!', { id: 'toggle' });
                // Recarrega campanhas
                const campRes = await fetch(`/api/meta/campaigns`);
                const campJson = await campRes.json();
                if (!campJson.error) setCampaigns(campJson.data || []);
            }
        } catch (err) {
            toast.error('Erro na requisição', { id: 'toggle' });
        }
    };

    const handleUpdateBudget = async (objectId, currentBudget) => {
        const input = window.prompt(`Digite o novo orçamento diário (R$):\n(Atual: R$ ${currentBudget.toFixed(2)})`);
        if (input === null) return;
        const newBudget = parseFloat(input.replace(',', '.'));
        if (isNaN(newBudget) || newBudget <= 0) {
            toast.error('Valor de orçamento inválido.');
            return;
        }

        toast.loading('Atualizando orçamento...', { id: 'budget' });
        try {
            const res = await fetch('/api/meta/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ objectId, action: 'budget', value: newBudget })
            });
            const json = await res.json();
            
            if (json.error) {
                toast.error(json.error, { id: 'budget' });
            } else if (json.message && json.message.includes('simulação')) {
                toast.success('Simulação: Orçamento alterado.', { id: 'budget' });
                // Atualiza UI simulada
                setCampaigns(prev => prev.map(c => ({
                    ...c, 
                    daily_budget: c.id === objectId ? newBudget : c.daily_budget,
                    adsets: c.adsets.map(a => ({
                        ...a,
                        daily_budget: a.id === objectId ? newBudget : a.daily_budget
                    }))
                })));
            } else {
                toast.success('Orçamento atualizado!', { id: 'budget' });
                const campRes = await fetch(`/api/meta/campaigns`);
                const campJson = await campRes.json();
                if (!campJson.error) setCampaigns(campJson.data || []);
            }
        } catch (err) {
            toast.error('Erro na requisição', { id: 'budget' });
        }
    };

    const renderAdSetMetrics = (adsetId) => {
        const insight = rawAdSetsInsights.find(i => i.adset_id === adsetId);
        const spend = insight ? parseFloat(insight.spend || 0) : 0;
        const impressions = insight ? parseInt(insight.impressions || 0) : 0;
        
        // Find message actions
        let msgAction = 0;
        let costPerMsg = 0;
        if (insight && insight.actions) {
            const msgTypes = ['onsite_conversion.messaging_conversation_started_7d', 'messaging_conversation_started_7d', 'lead', 'messages'];
            const actionObj = insight.actions.find(a => msgTypes.includes(a.action_type));
            if (actionObj) msgAction = parseInt(actionObj.value || 0);
        }
        if (insight && insight.cost_per_action_type) {
            const msgTypes = ['onsite_conversion.messaging_conversation_started_7d', 'messaging_conversation_started_7d', 'lead', 'messages'];
            const costObj = insight.cost_per_action_type.find(c => msgTypes.includes(c.action_type));
            if (costObj) costPerMsg = parseFloat(costObj.value || 0);
        }

        if (costPerMsg === 0 && msgAction > 0 && spend > 0) {
            costPerMsg = spend / msgAction;
        }

        let costColorClass = "text-slate-700";
        if (costPerMsg > 5) costColorClass = "text-red-600";
        else if (costPerMsg > 0 && costPerMsg < 3) costColorClass = "text-green-600";

        return (
            <div className="hidden md:flex flex-1 justify-center gap-8 px-4 border-x border-slate-100 mx-4">
                <div className="text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Resultados</p>
                    <p className="font-bold text-slate-700 text-sm">
                        {msgAction}
                    </p>
                </div>
                <div className="text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Custo/Msg</p>
                    <p className={`font-bold text-sm ${costColorClass}`}>
                        {costPerMsg > 0 ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(costPerMsg) : '-'}
                    </p>
                </div>
                <div className="text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Gasto</p>
                    <p className="font-bold text-slate-700 text-sm">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(spend)}
                    </p>
                </div>
                <div className="text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Impressões</p>
                    <p className="font-bold text-slate-700 text-sm">
                        {new Intl.NumberFormat('pt-BR').format(impressions)}
                    </p>
                </div>
            </div>
        );
    };

    const totalSpend = insightsData.reduce((acc, curr) => acc + curr.spend, 0);
    const totalLeads = insightsData.reduce((acc, curr) => acc + curr.leads, 0);
    const totalClients = insightsData.reduce((acc, curr) => acc + curr.clients, 0);
    const avgCpa = totalLeads > 0 ? totalSpend / totalLeads : 0;

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-slate-800 flex">
            <aside className={`hidden md:flex flex-col bg-slate-900 text-slate-300 h-screen fixed left-0 top-0 z-50 transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-64'}`}>
                <div className="p-6 flex justify-center border-b border-slate-800">
                    {isSidebarCollapsed ? (
                        <img src="/icon-horizontal.png" alt="Logo" className="h-8 object-contain brightness-0 invert opacity-90 object-left" style={{ objectFit: 'cover', width: '32px' }} />
                    ) : (
                        <img src="/icon-horizontal.png" alt="Logo" className="h-10 object-contain brightness-0 invert opacity-90" />
                    )}
                </div>
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto overflow-x-hidden">
                    {['dashboard', 'atendimentos', 'financeiro', 'equipe', 'estoque', 'meta', 'configuracoes'].map(tab => (
                        <button key={tab} title={tab} onClick={() => { if (tab === 'meta') return; router.push(`/admin?tab=${tab}`); }} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-xl transition-all font-medium capitalize ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800 hover:text-white'}`}>
                            {tab === 'dashboard' && <LayoutDashboard size={20} className="shrink-0" />}
                            {tab === 'atendimentos' && <ListTodo size={20} className="shrink-0" />}
                            {tab === 'financeiro' && <Banknote size={20} className="shrink-0" />}
                            {tab === 'equipe' && <Users size={20} className="shrink-0" />}
                            {tab === 'estoque' && <Package size={20} className="shrink-0" />}
                            {tab === 'meta' && <Target size={20} className="shrink-0" />}
                            {tab === 'configuracoes' && <Settings size={20} className="shrink-0" />}
                            {!isSidebarCollapsed && (
                                <span className="truncate">{tab === 'configuracoes' ? 'Configurações' : tab === 'meta' ? 'Meta Ads' : tab}</span>
                            )}
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t border-slate-800 relative">
                    <button 
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
                        className="absolute -top-4 right-4 bg-slate-900 border border-slate-700 text-slate-400 hover:text-white rounded-full p-1 cursor-pointer transition-colors z-10 hover:scale-110"
                        title={isSidebarCollapsed ? "Expandir Menu" : "Recolher Menu"}
                    >
                        {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                    <button title="Ver App" onClick={() => window.open('/?mode=preview', '_blank')} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-xl hover:bg-slate-800 text-blue-400 transition-all font-medium mb-2`}>
                        <Smartphone size={20} className="shrink-0" />
                        {!isSidebarCollapsed && <span className="truncate">Ver App</span>}
                    </button>
                    <button title="Sair" onClick={handleLogout} className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-xl hover:bg-red-900/30 text-red-400 transition-all font-medium`}>
                        <LogOut size={20} className="shrink-0" />
                        {!isSidebarCollapsed && <span className="truncate">Sair</span>}
                    </button>
                </div>
            </aside>

            <div className={`flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
                <div className="flex-1 overflow-y-auto relative bg-slate-50 text-slate-900 p-4 md:p-8 pb-24 md:pb-8">
                    {/* Header */}
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                            <Activity className="w-8 h-8 text-blue-600" />
                            Meta Ads Dashboard
                        </h1>
                        <p className="text-slate-500">Gestão de performance e campanhas por regional</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {dateRange === 'custom' && (
                        <div className="flex gap-2 items-center mr-2">
                            <input 
                                type="date" 
                                value={customStart} 
                                onChange={(e) => setCustomStart(e.target.value)} 
                                className="p-2 border border-slate-300 rounded-xl bg-white text-slate-700 text-sm outline-none"
                            />
                            <span className="text-slate-400">até</span>
                            <input 
                                type="date" 
                                value={customEnd} 
                                onChange={(e) => setCustomEnd(e.target.value)} 
                                className="p-2 border border-slate-300 rounded-xl bg-white text-slate-700 text-sm outline-none"
                            />
                        </div>
                    )}
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="p-2 border border-slate-300 rounded-xl bg-white text-slate-700 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="today">Hoje</option>
                        <option value="yesterday">Ontem</option>
                        <option value="yesterday_and_today">Ontem e Hoje</option>
                        <option value="last_7d">Últimos 7 dias</option>
                        <option value="last_30d">Últimos 30 dias</option>
                        <option value="this_month">Mês Atual</option>
                        <option value="last_month">Mês Passado</option>
                        <option value="custom">Personalizado</option>
                    </select>
                    
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 hidden sm:block">
                            {formatLastUpdate(lastUpdate)}
                        </span>
                        <button 
                            onClick={() => setRefreshTrigger(r => r + 1)}
                            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-colors flex items-center gap-2"
                        >
                            <RefreshCcw className="w-5 h-5" />
                            <span className="hidden md:inline">Atualizar</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto space-y-8">
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                ) : (
                    <>
                        {/* KPIs Globais */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-slate-500 text-sm font-medium">Gasto Total</p>
                                    <DollarSign className="w-5 h-5 text-red-500" />
                                </div>
                                <h3 className="text-3xl font-bold text-slate-800">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalSpend)}
                                </h3>
                            </motion.div>
                            
                            <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.1}} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-slate-500 text-sm font-medium">Agendamentos (Leads)</p>
                                    <Users className="w-5 h-5 text-blue-500" />
                                </div>
                                <h3 className="text-3xl font-bold text-slate-800">{totalLeads}</h3>
                            </motion.div>

                            <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.2}} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-slate-500 text-sm font-medium">Custo por Agendamento</p>
                                    <Target className="w-5 h-5 text-orange-500" />
                                </div>
                                <h3 className="text-3xl font-bold text-slate-800">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(avgCpa)}
                                </h3>
                            </motion.div>

                            <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.3}} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                <div className="flex justify-between items-start mb-2">
                                    <p className="text-slate-500 text-sm font-medium">Atendimentos Concluídos</p>
                                    <Activity className="w-5 h-5 text-green-500" />
                                </div>
                                <h3 className="text-3xl font-bold text-slate-800">{totalClients}</h3>
                            </motion.div>
                        </div>

                        {/* Gráficos */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                            <h2 className="text-xl font-bold mb-4">Desempenho por Regional</h2>
                            <div className="h-80 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={insightsData.filter(item => item.spend > 0 || item.leads > 0)} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="city" axisLine={false} tickLine={false} interval={0} tick={{ fontSize: 11, angle: -15, textAnchor: 'end' }} height={60} />
                                        <YAxis yAxisId="left" orientation="left" stroke="#ef4444" axisLine={false} tickLine={false} />
                                        <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" axisLine={false} tickLine={false} />
                                        <RechartsTooltip 
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-100">
                                                            <p className="font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2">{label}</p>
                                                            {payload.map((entry, index) => (
                                                                <div key={index} className="flex justify-between items-center gap-4 text-sm mb-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                                                                        <span className="text-slate-600 font-medium">{entry.name}:</span>
                                                                    </div>
                                                                    <span className="font-bold text-slate-800">
                                                                        {entry.name === 'Gasto (R$)' 
                                                                            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.value) 
                                                                            : entry.value}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar yAxisId="left" dataKey="spend" name="Gasto (R$)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                        <Bar yAxisId="right" dataKey="leads" name="Agendamentos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Listagem de Campanhas e Controles */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                <h2 className="text-xl font-bold">Gerenciamento de Campanhas</h2>
                                <div className="flex bg-slate-100 p-1 rounded-xl">
                                    <button 
                                        onClick={() => setViewMode('cities')} 
                                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${viewMode === 'cities' ? 'bg-white shadow text-blue-600' : 'text-slate-600 hover:text-slate-800'}`}
                                    >
                                        <Map className="w-4 h-4" /> Por Cidade
                                    </button>
                                    <button 
                                        onClick={() => setViewMode('campaigns')} 
                                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${viewMode === 'campaigns' ? 'bg-white shadow text-blue-600' : 'text-slate-600 hover:text-slate-800'}`}
                                    >
                                        <Activity className="w-4 h-4" /> Por Campanha
                                    </button>
                                </div>
                            </div>

                            {/* Filtro de Cidades (Mini Botões) */}
                            {(() => {
                                const FIXED_CITIES = [
                                    'Santo Antônio do Monte', 'Paraopeba / Caetanópolis', 'Sete Lagoas', 'Curvelo', 
                                    'Pedro Leopoldo', 'Matozinhos', 'Lagoa Santa', 'Vespasiano', 'Divinópolis', 
                                    'Itaúna', 'Pará de Minas', 'Nova Serrana', 'Bom Despacho', 'Formiga', 
                                    'Cláudio', 'Lagoa da Prata', 'Pitangui', 'Carmo do Cajuru', 'Oliveira', 'Itapecerica'
                                ];
                                
                                const allCities = Array.from(new Set([
                                    ...FIXED_CITIES,
                                    ...campaigns.flatMap(camp => (camp.adsets || []).map(a => a.city || 'Desconhecida')),
                                    ...insightsData.filter(item => item.spend > 0 || item.leads > 0).map(item => item.city)
                                ])).filter(c => c !== 'Desconhecida').sort();
                                
                                if (allCities.length === 0) return null;

                                return (
                                    <div className="flex flex-col gap-4 mb-6">
                                        <div className="flex flex-wrap gap-2">
                                            <button 
                                                onClick={() => setSelectedCityFilter('Todas')}
                                                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer ${selectedCityFilter === 'Todas' ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                            >
                                                Todas
                                            </button>
                                            {allCities.map(city => (
                                                <button 
                                                    key={city}
                                                    onClick={() => setSelectedCityFilter(city)}
                                                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer ${selectedCityFilter === city ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                                >
                                                    {city}
                                                </button>
                                            ))}
                                        </div>
                                        
                                        {selectedCityFilter !== 'Todas' && (() => {
                                            const cityData = insightsData.find(d => d.city === selectedCityFilter) || { spend: 0, leads: 0, cpa: 0, clients: 0 };
                                            return (
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl mt-2 animate-in fade-in zoom-in-95 duration-200">
                                                    <div>
                                                        <p className="text-xs text-slate-500 font-medium mb-1">Gasto em {selectedCityFilter}</p>
                                                        <p className="text-lg font-bold text-slate-900">
                                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cityData.spend)}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-500 font-medium mb-1">Agendamentos (Leads)</p>
                                                        <p className="text-lg font-bold text-blue-600">{cityData.leads}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-500 font-medium mb-1">Custo por Agendamento</p>
                                                        <p className={`text-lg font-bold ${cityData.cpa > 5 ? 'text-red-500' : cityData.cpa < 3 && cityData.cpa > 0 ? 'text-green-500' : 'text-slate-900'}`}>
                                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cityData.cpa)}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-slate-500 font-medium mb-1">Atendimentos Concluídos</p>
                                                        <p className="text-lg font-bold text-green-600">{cityData.clients}</p>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                );
                            })()}

                            <div className="space-y-4">
                                {viewMode === 'campaigns' && (() => {
                                    // Filtra campanhas que possuem pelo menos 1 adset da cidade selecionada (se não for "Todas")
                                    let filteredCamps = campaigns;
                                    if (selectedCityFilter !== 'Todas') {
                                        filteredCamps = campaigns.filter(camp => 
                                            camp.adsets?.some(adset => adset.city === selectedCityFilter)
                                        );
                                    }
                                    
                                    // Ordena Campanhas: ATIVAS primeiro
                                    filteredCamps = [...filteredCamps].sort((a, b) => {
                                        if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
                                        if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
                                        return 0;
                                    });

                                    return filteredCamps.map(camp => (
                                        <div key={camp.id} className="border border-slate-200 rounded-xl overflow-hidden">
                                            <div className="bg-slate-50 p-4 flex justify-between items-center border-b border-slate-200">
                                            <div>
                                                <h3 className="font-bold text-slate-800">{camp.name}</h3>
                                                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${camp.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                                                    {camp.status === 'ACTIVE' ? 'ATIVO' : 'PAUSADO'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right hidden sm:block">
                                                    <p className="text-xs text-slate-500">Orçamento Diário</p>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold">R$ {camp.daily_budget.toFixed(2)}</p>
                                                        <button onClick={() => handleUpdateBudget(camp.id, camp.daily_budget)} className="text-slate-400 hover:text-blue-500 cursor-pointer">
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleToggleStatus(camp.id, camp.status)}
                                                    className={`p-2 cursor-pointer rounded-full transition-colors ${camp.status === 'ACTIVE' ? 'bg-red-50 hover:bg-red-100 text-red-600' : 'bg-green-50 hover:bg-green-100 text-green-600'}`}
                                                    title={camp.status === 'ACTIVE' ? 'Pausar Campanha' : 'Ativar Campanha'}
                                                >
                                                    {camp.status === 'ACTIVE' ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-4 bg-white">
                                            <h4 className="text-sm font-semibold text-slate-500 mb-3 uppercase tracking-wider">Conjuntos de Anúncios (Ad Sets)</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {[...(camp.adsets || [])]
                                                    .filter(adset => selectedCityFilter === 'Todas' || adset.city === selectedCityFilter)
                                                    .sort((a, b) => {
                                                        if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
                                                        if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
                                                        return 0;
                                                    })
                                                    .map(adset => (
                                                    <div key={adset.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                        <div className="w-1/3">
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-medium text-slate-700 truncate">{adset.name}</p>
                                                                {adset.city !== 'Desconhecida' && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap">{adset.city}</span>}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <p className="text-xs text-slate-500">R$ {adset.daily_budget.toFixed(2)}/dia</p>
                                                                <button onClick={() => handleUpdateBudget(adset.id, adset.daily_budget)} className="text-slate-400 hover:text-blue-500 cursor-pointer">
                                                                    <Edit2 className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        
                                                        {renderAdSetMetrics(adset.id)}

                                                        <div className="w-auto text-right">
                                                            <button 
                                                                onClick={() => handleToggleStatus(adset.id, adset.status)}
                                                                className="flex items-center gap-1 text-sm font-medium cursor-pointer"
                                                            >
                                                                {adset.status === 'ACTIVE' ? (
                                                                    <span className="text-green-600 flex items-center gap-1 bg-green-50 px-2 py-1 rounded-md hover:bg-green-100 transition-colors"><CheckCircle className="w-4 h-4"/> Ativo</span>
                                                                ) : (
                                                                    <span className="text-slate-500 flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md hover:bg-slate-200 transition-colors"><XCircle className="w-4 h-4"/> Pausado</span>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    ));
                                })()}

                                {viewMode === 'cities' && (() => {
                                    // Agrupa adsets por cidade
                                    const adsetsByCity = {};
                                    campaigns.forEach(camp => {
                                        camp.adsets?.forEach(adset => {
                                            const city = adset.city || 'Desconhecida';
                                            if (!adsetsByCity[city]) adsetsByCity[city] = [];
                                            adsetsByCity[city].push({ ...adset, campName: camp.name });
                                        });
                                    });

                                    let cityEntries = Object.entries(adsetsByCity);
                                    if (selectedCityFilter !== 'Todas') {
                                        cityEntries = cityEntries.filter(([city]) => city === selectedCityFilter);
                                    }
                                    
                                    cityEntries.sort((a,b) => a[0].localeCompare(b[0]));

                                    return cityEntries.map(([city, adsets]) => {
                                        // Ordena AdSets: ATIVOS primeiro
                                        const sortedAdsets = [...adsets].sort((a, b) => {
                                            if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
                                            if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
                                            return 0;
                                        });

                                        return (
                                        <div key={city} className="border border-slate-200 rounded-xl overflow-hidden">
                                            <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center gap-2">
                                                <Map className="w-5 h-5 text-blue-500" />
                                                <h3 className="font-bold text-slate-800">{city}</h3>
                                                <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-full">{sortedAdsets.length} Ad Sets</span>
                                            </div>
                                            <div className="p-4 bg-white grid grid-cols-1 gap-3">
                                                {sortedAdsets.map(adset => (
                                                    <div key={adset.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                        <div className="w-1/3">
                                                            <p className="font-medium text-slate-700 truncate">{adset.name}</p>
                                                            <p className="text-[10px] text-slate-400 mb-1 truncate uppercase">Campanha: {adset.campName}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <p className="text-xs font-semibold text-slate-600">R$ {adset.daily_budget.toFixed(2)}/dia</p>
                                                                <button onClick={() => handleUpdateBudget(adset.id, adset.daily_budget)} className="text-slate-400 hover:text-blue-500 cursor-pointer">
                                                                    <Edit2 className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        
                                                        {renderAdSetMetrics(adset.id)}

                                                        <div className="w-auto text-right">
                                                            <button 
                                                                onClick={() => handleToggleStatus(adset.id, adset.status)}
                                                                className="flex items-center gap-1 text-sm font-medium cursor-pointer"
                                                            >
                                                                {adset.status === 'ACTIVE' ? (
                                                                    <span className="text-green-600 flex items-center gap-1 bg-green-50 px-2 py-1 rounded-md hover:bg-green-100 transition-colors"><CheckCircle className="w-4 h-4"/> Ativo</span>
                                                                ) : (
                                                                    <span className="text-slate-500 flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md hover:bg-slate-200 transition-colors"><XCircle className="w-4 h-4"/> Pausado</span>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )});
                                })()}

                                {campaigns.length === 0 && (
                                    <div className="text-center p-8 text-slate-500">Nenhuma campanha encontrada.</div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
                </div>
            </div>
            {BottomNav()}
        </div>
    );
}
