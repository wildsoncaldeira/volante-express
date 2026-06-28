'use client';
import { useEffect, useState, useMemo } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import {
    TrendingDown, Filter, Settings, Trash2, Banknote, Calendar,
    Star, Package, Plus, Save, Eye, X, PieChart as PieIcon,
    BarChart3, Users, LayoutDashboard, LogOut, Wallet,
    ArrowRightLeft, Pencil, TrendingUp, Smartphone, Trophy, ListTodo, Search, ChevronDown, ChevronLeft, ChevronRight,
    Maximize, Download
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie, Legend, AreaChart, Area
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ef4444', '#3b82f6'];

export default function AdminPage() {
    const router = useRouter();
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const [activeTab, setActiveTab] = useState('dashboard');
    const [atendimentosTab, setAtendimentosTab] = useState('realizados');
    const [regions, setRegions] = useState([]);
    const [selectedRegion, setSelectedRegion] = useState('all');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [loading, setLoading] = useState(true);

    // Dados
    const [appointments, setAppointments] = useState([]);
    const [futureAppointments, setFutureAppointments] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [rates, setRates] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [installers, setInstallers] = useState([]);
    const [categories, setCategories] = useState([]);

    // Filtros Atendimentos
    const [atmSearchTerm, setAtmSearchTerm] = useState('');
    const [atmFilterRegion, setAtmFilterRegion] = useState('all');
    const [atmFilterCoating, setAtmFilterCoating] = useState('all');
    const [atmFilterPayment, setAtmFilterPayment] = useState('all');

    // Filtros Financeiro (Transações)
    const [finSearchTerm, setFinSearchTerm] = useState('');
    const [finFilterType, setFinFilterType] = useState('all');
    const [finFilterCategory, setFinFilterCategory] = useState('all');
    const [finFilterAccount, setFinFilterAccount] = useState('all');
    const [finFilterRegion, setFinFilterRegion] = useState('all');

    // Visibilidade dos Filtros (Toggles)
    const [showAtmFilters, setShowAtmFilters] = useState(false);
    const [showFinFilters, setShowFinFilters] = useState(false);

    // Modais e Forms
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferData, setTransferData] = useState({ from: '', to: '', amount: '', date: new Date().toISOString().slice(0, 10) });
    const [editingItem, setEditingItem] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [modalType, setModalType] = useState('');
    const [selectedTransaction, setSelectedTransaction] = useState(null);

    // Forms de Criação
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [newAccount, setNewAccount] = useState({ name: '', type: 'banco', initial_balance: 0, region_id: 'matriz' });
    const [newExpense, setNewExpense] = useState({ description: '', amount: '', category_id: '', account_id: '', region_id: selectedRegion === 'all' ? 'matriz' : selectedRegion, date: new Date().toISOString().slice(0, 10) });
    const [newCategory, setNewCategory] = useState('');
    const [newItem, setNewItem] = useState({ name: '', quantity: 0, min_threshold: 5 });
    const [showAddForm, setShowAddForm] = useState(false);

    // Edição Rápida
    const [editingRate, setEditingRate] = useState(null);
    const [isEditingInv, setIsEditingInv] = useState(null);
    const [editInvForm, setEditInvForm] = useState({});
    const [invSortOrder, setInvSortOrder] = useState('qty_desc');

    // Toggles Configurações
    const [showAccountsSettings, setShowAccountsSettings] = useState(false);
    const [showRatesSettings, setShowRatesSettings] = useState(false);
    const [showCategoriesSettings, setShowCategoriesSettings] = useState(false);
    const [ratesRegion, setRatesRegion] = useState('global');

    // Metas
    const [goalsMonth, setGoalsMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [editingGoals, setEditingGoals] = useState({}); // { regionSlug: goalAmount }
    const [showGoalsSettings, setShowGoalsSettings] = useState(false);

    // Paginação e Filtros Expandidos
    const [atmItemsPerPage, setAtmItemsPerPage] = useState(10);
    const [atmCurrentPageRealizados, setAtmCurrentPageRealizados] = useState(1);
    const [atmCurrentPageFuturos, setAtmCurrentPageFuturos] = useState(1);
    const [atmSearchAllMonths, setAtmSearchAllMonths] = useState(false);

    const [finItemsPerPage, setFinItemsPerPage] = useState(10);
    const [finCurrentPage, setFinCurrentPage] = useState(1);

    const [equipeViewType, setEquipeViewType] = useState('mensal'); // 'semanal' ou 'mensal'
    const [equipeCurrentWeekDate, setEquipeCurrentWeekDate] = useState(new Date());

    useEffect(() => { 
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/login');
            } else {
                loadRegions();
            }
        };
        checkAuth();
    }, [router, supabase.auth]);
    useEffect(() => { fetchData(); }, [selectedRegion, activeTab, selectedMonth, atmSearchAllMonths, equipeViewType, equipeCurrentWeekDate]);



    useEffect(() => {
        if (activeTab === 'configuracoes' && regions.length > 0) {
            fetchGoalsForMonth(goalsMonth);
        }
    }, [activeTab, goalsMonth, regions]);

    async function fetchGoalsForMonth(m) {
        const { data: currentGoals } = await supabase
            .from('regional_goals')
            .select('*')
            .eq('month', m);

        const goalsMap = {};
        const activeRegions = regions.filter(r => r.slug !== 'matriz');
        activeRegions.forEach(r => {
            goalsMap[r.slug] = 0;
        });

        if (currentGoals && currentGoals.length > 0) {
            currentGoals.forEach(g => {
                goalsMap[g.region_id] = g.goal_amount;
            });
            setEditingGoals(goalsMap);
        } else {
            const fallbackMap = { ...goalsMap };
            for (const r of activeRegions) {
                const { data: prevGoal } = await supabase
                    .from('regional_goals')
                    .select('goal_amount')
                    .eq('region_id', r.slug)
                    .lt('month', m)
                    .order('month', { ascending: false })
                    .limit(1);

                if (prevGoal && prevGoal.length > 0) {
                    fallbackMap[r.slug] = prevGoal[0].goal_amount;
                }
            }
            setEditingGoals(fallbackMap);
        }
    }

    async function handleSaveGoals(e) {
        e.preventDefault();
        const upsertData = Object.entries(editingGoals).map(([region_id, goal_amount]) => ({
            region_id,
            month: goalsMonth,
            goal_amount: Number(goal_amount) || 0
        }));

        const { error } = await supabase
            .from('regional_goals')
            .upsert(upsertData, { onConflict: 'region_id,month' });

        if (error) {
            alert('Erro ao salvar metas: ' + error.message);
        } else {
            alert('Metas salvas com sucesso para o mês ' + goalsMonth + '!');
            fetchGoalsForMonth(goalsMonth);
        }
    }

    async function loadRegions() {
        const { data } = await supabase.from('regions').select('*');
        if (data?.length) {
            if (!data.find(r => r.slug === 'matriz')) data.push({ slug: 'matriz', name: 'Matriz / Global' });
            setRegions(data);
        }
    }

    async function fetchData() {
        setLoading(true);
        const [ano, mes] = selectedMonth.split('-');
        
        let startRange = new Date(Number(ano), Number(mes) - 1, 1).toISOString();
        let endRange = new Date(Number(ano), Number(mes), 0, 23, 59, 59).toISOString();

        if (activeTab === 'equipe' && equipeViewType === 'semanal') {
            const current = new Date(equipeCurrentWeekDate);
            const day = current.getDay();
            const diff = current.getDate() - day + (day === 0 ? -6 : 1);
            const startW = new Date(current.setDate(diff));
            startW.setHours(0, 0, 0, 0);
            const endW = new Date(startW);
            endW.setDate(startW.getDate() + 6);
            endW.setHours(23, 59, 59, 999);
            startRange = startW.toISOString();
            endRange = endW.toISOString();
        } else if (activeTab === 'atendimentos' && atmSearchAllMonths) {
            startRange = null;
            endRange = null;
        }

        // 1. Contas (Carregue primeiro para usar no filtro das regionais)
        const { data: accsData } = await supabase.from('accounts').select('*').order('name');
        const accs = accsData || [];
        setAccounts(accs);

        // 2. Instalações e Agendamentos Futuros
        let appQuery = supabase.from('appointments').select('*');
        if (startRange && endRange) {
            appQuery = appQuery.gte('appointment_at', startRange).lte('appointment_at', endRange);
        }
        
        let futureAppQuery = supabase.from('appointments').select('*')
            .neq('status', 'concluido')
            .neq('status', 'cancelado')
            .order('appointment_at', { ascending: true });

        const { data: appsData } = await appQuery;
        const { data: futureAppsData } = await futureAppQuery;
        let apps = appsData || [];
        let futureApps = futureAppsData || [];

        // 3. Despesas
        let expQuery = supabase.from('expenses').select('*, expense_categories(name)');
        if (startRange && endRange) {
            expQuery = expQuery.gte('date', startRange).lte('date', endRange);
        }
        const { data: expsData } = await expQuery;
        let exps = expsData || [];

        if (selectedRegion !== 'all') {
            apps = apps.filter(a => (a.region_id || 'divinopolis') === selectedRegion);
            futureApps = futureApps.filter(a => (a.region_id || 'divinopolis') === selectedRegion);
            exps = exps.filter(e => (e.region_id || 'divinopolis') === selectedRegion);
        }

        setAppointments(apps.filter(a => a.status === 'concluido'));
        setFutureAppointments(futureApps);
        setExpenses(exps);

        // 4. Estoque
        let invQuery = supabase.from('inventory').select('*').order('name');
        if (selectedRegion !== 'all') invQuery = invQuery.eq('region_id', selectedRegion);
        const { data: inv } = await invQuery;
        setInventory(inv || []);

        // 5. Outros
        const { data: profs } = await supabase.from('profiles').select('*');
        setInstallers(profs || []);
        const { data: cats } = await supabase.from('expense_categories').select('*').order('name');
        setCategories(cats || []);
        const { data: rt } = await supabase.from('payment_rates').select('*').order('installments');
        setRates(rt || []);

        setLoading(false);
    }

    // --- CRUD ---
    async function handleDelete(table, id) {
        if (!confirm('Tem certeza absoluta? Essa ação ajustará o saldo automaticamente.')) return;
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (error) alert('Erro ao excluir: ' + error.message);
        else fetchData();
    }

    function openEditModal(type, item) {
        setModalType(type);
        setEditingItem({ ...item });
        setShowEditModal(true);
    }

    async function handleSaveEdit() {
        let table = '';
        if (modalType === 'appointment') table = 'appointments';
        if (modalType === 'expense') table = 'expenses';
        if (modalType === 'installer') table = 'profiles';
        if (modalType === 'account') table = 'accounts';

        const payload = { ...editingItem };

        if (modalType === 'appointment') {
            const originalAppointment = appointments.find(a => a.id === payload.id) || {};

            // 0. Handle Inventory adjustment if coating changed on a completed appointment
            const oldId = String(originalAppointment.material_used_id || '').trim();
            const newId = String(payload.material_used_id || '').trim();
            
            if (originalAppointment.status === 'concluido' && newId !== oldId) {
                // Restore old material
                if (originalAppointment.material_used_id) {
                    const { data: oldMat } = await supabase.from('inventory').select('quantity').eq('id', originalAppointment.material_used_id).single();
                    if (oldMat) {
                        await supabase.from('inventory').update({ quantity: (oldMat.quantity || 0) + 1 }).eq('id', originalAppointment.material_used_id);
                    }
                }
                // Consume new material
                if (payload.material_used_id) {
                    const { data: newMat } = await supabase.from('inventory').select('quantity').eq('id', payload.material_used_id).single();
                    if (newMat) {
                        await supabase.from('inventory').update({ quantity: (newMat.quantity || 0) - 1 }).eq('id', payload.material_used_id);
                    }
                }
            }

            // 1. Handle Primary Payment Recalculation
            const gross1 = parseFloat(payload.gross_amount || 0);
            const currentGross1 = parseFloat(originalAppointment.gross_amount || 0);
            if (gross1 !== currentGross1) {
                let ratePercent = payload.payment_rate_snapshot || 0;
                if (ratePercent === 0 && currentGross1 > 0) ratePercent = 100 - ((parseFloat(payload.net_amount || 0) / currentGross1) * 100);
                payload.net_amount = gross1 - (gross1 * (ratePercent / 100));
            }
            if (payload._new_account_id) payload.account_id = payload._new_account_id;

            // 2. Handle Secondary Payment Recalculation
            if (payload.is_split_payment) {
                const gross2 = parseFloat(payload.gross_amount_2 || 0);
                const currentGross2 = parseFloat(originalAppointment.gross_amount_2 || 0);
                if (gross2 !== currentGross2) {
                    let ratePercent2 = payload.payment_rate_snapshot_2 || 0;
                    if (ratePercent2 === 0 && currentGross2 > 0) ratePercent2 = 100 - ((parseFloat(payload.net_amount_2 || 0) / currentGross2) * 100);
                    payload.net_amount_2 = gross2 - (gross2 * (ratePercent2 / 100));
                }
                if (payload._new_account_id_2) payload.account_id_2 = payload._new_account_id_2;
            } else {
                payload.payment_method_2 = null;
                payload.gross_amount_2 = null;
                payload.net_amount_2 = null;
                payload.account_id_2 = null;
            }
        }

        const fieldsToDelete = ['expense_categories', 'label', 'val', 'desc', 'email', 'account_name', 'account_region', 'is_primary', '_new_account_id', '_new_account_id_2'];
        if (modalType !== 'account') fieldsToDelete.push('type');
        if (table !== 'expenses') fieldsToDelete.push('date');
        if (payload.region_id === 'matriz') payload.region_id = null;
        fieldsToDelete.forEach(f => delete payload[f]);

        const { error } = await supabase.from(table).update(payload).eq('id', editingItem.id);
        if (error) alert('Erro: ' + error.message);
        else { setShowEditModal(false); fetchData(); }
    }

    // --- FINANCEIRO ---
    async function handleAddAccount(e) {
        e.preventDefault();
        const regionToSave = newAccount.region_id === 'matriz' ? null : newAccount.region_id;
        const { region_id, ...accountFields } = newAccount;
        const { error } = await supabase.from('accounts').insert([{ ...accountFields, region_id: regionToSave, balance: newAccount.initial_balance }]);
        if (!error) { setNewAccount({ name: '', type: 'banco', initial_balance: 0, region_id: 'matriz' }); fetchData(); alert('Conta criada!'); }
    }

    async function handleTransfer(e) {
        e.preventDefault();
        if (transferData.from === transferData.to) return alert('Contas iguais!');
        const amount = Number(transferData.amount);

        const { data: fromAcc } = await supabase.from('accounts').select('balance').eq('id', transferData.from).single();
        await supabase.from('accounts').update({ balance: (fromAcc?.balance || 0) - amount }).eq('id', transferData.from);
        const { data: toAcc } = await supabase.from('accounts').select('balance').eq('id', transferData.to).single();
        await supabase.from('accounts').update({ balance: (toAcc?.balance || 0) + amount }).eq('id', transferData.to);
        await supabase.from('transfers').insert([{ from_account_id: transferData.from, to_account_id: transferData.to, amount: amount, date: transferData.date, description: 'Transferência Interna' }]);

        setShowTransferModal(false); fetchData(); alert('Transferência realizada!');
    }

    async function handleAddExpense(e) {
        e.preventDefault();
        const acc = accounts.find(a => a.id === newExpense.account_id);
        const expensePayload = { ...newExpense, date: newExpense.date ? newExpense.date + 'T12:00:00Z' : new Date().toISOString() };
        if (expensePayload.region_id === 'matriz') expensePayload.region_id = null;
        const { error } = await supabase.from('expenses').insert([expensePayload]);
        if (!error) {
            if (acc) await supabase.from('accounts').update({ balance: (acc.balance || 0) - Number(newExpense.amount) }).eq('id', newExpense.account_id);
            setNewExpense({ description: '', amount: '', category_id: '', account_id: '', region_id: selectedRegion === 'all' ? 'matriz' : selectedRegion, date: new Date().toISOString().slice(0, 10) });
            fetchData();
            alert('Despesa lançada!');
        } else { alert('Erro: ' + error.message); }
    }

    async function handleAddCategory(e) { e.preventDefault(); await supabase.from('expense_categories').insert([{ name: newCategory }]); setNewCategory(''); fetchData(); }
    async function handleSetDefault(id) { await supabase.from('accounts').update({ is_default: false }).is('region_id', null); await supabase.from('accounts').update({ is_default: true }).eq('id', id); fetchData(); }
    async function handleUpdateRate(rate) {
        const { error } = await supabase.from('payment_rates').update({ rate_percent: Number(rate.rate_percent) }).eq('id', rate.id);
        if (error) {
            alert('Erro ao atualizar taxa: ' + error.message);
        } else {
            setEditingRate(null);
            fetchData();
        }
    }
    async function handleInitializeRates() {
        const defaultRates = rates.filter(r => !r.region_id);
        if (defaultRates.length === 0) {
            alert('Nenhuma taxa padrão cadastrada para copiar.');
            return;
        }
        const newRatesPayload = defaultRates.map(r => ({
            method: r.method,
            installments: r.installments,
            rate_percent: r.rate_percent,
            days_to_receive: r.days_to_receive,
            region_id: ratesRegion === 'global' ? null : ratesRegion
        }));
        const { error } = await supabase.from('payment_rates').insert(newRatesPayload);
        if (error) { alert('Erro ao inicializar taxas: ' + error.message); }
        else { alert('Taxas inicializadas com sucesso para a regional!'); fetchData(); }
    }
    async function handleAddInventory(e) { e.preventDefault(); const reg = selectedRegion === 'all' ? 'divinopolis' : selectedRegion; await supabase.from('inventory').insert([{ ...newItem, region_id: reg }]); setNewItem({ name: '', quantity: 0, min_threshold: 5 }); setShowAddForm(false); fetchData(); }
    async function handleUpdateInventory(id) { await supabase.from('inventory').update({ quantity: editInvForm.quantity, min_threshold: editInvForm.min_threshold }).eq('id', id); setIsEditingInv(null); fetchData(); }
    async function handleLogout() { await supabase.auth.signOut(); router.push('/login'); }

    // --- CÁLCULOS BI ---
    const dashboardStats = useMemo(() => {
        const [ano, mes] = selectedMonth.split('-');
        const startOfMonth = new Date(Number(ano), Number(mes) - 1, 1).toISOString();
        const endOfMonth = new Date(Number(ano), Number(mes), 0, 23, 59, 59).toISOString();
        const appsMonth = appointments.filter(a => a.appointment_at >= startOfMonth && a.appointment_at <= endOfMonth);
        const expsMonth = expenses.filter(e => e.date >= startOfMonth && e.date <= endOfMonth);
        const futureAppsMonth = futureAppointments.filter(a => a.appointment_at >= startOfMonth && a.appointment_at <= endOfMonth);

        const totalGross = appsMonth.reduce((acc, curr) => acc + (Number(curr.gross_amount) || Number(curr.amount) || 0), 0);
        const totalNet = appsMonth.reduce((acc, curr) => acc + (Number(curr.net_amount) || Number(curr.amount) || 0), 0);
        const totalExpense = expsMonth.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
        const ticketMedio = appsMonth.length > 0 ? totalGross / appsMonth.length : 0;

        const incomeByMethod = {};
        appsMonth.forEach(a => { const m = a.payment_method || 'Não Definido'; incomeByMethod[m] = (incomeByMethod[m] || 0) + (Number(a.gross_amount) || 0); });
        const pieDataIncome = Object.keys(incomeByMethod).map(k => ({ name: k, value: incomeByMethod[k] }));

        const expByCat = {};
        expsMonth.forEach(e => { const n = e.expense_categories?.name || 'Outros'; expByCat[n] = (expByCat[n] || 0) + Number(e.amount); });
        const pieDataExpenses = Object.keys(expByCat).map(k => ({ name: k, value: expByCat[k] }));

        const rankingData = installers.map(inst => {
            const myApps = appsMonth.filter(a => a.user_id === inst.id);
            const total = myApps.reduce((acc, curr) => acc + (Number(curr.gross_amount) || 0), 0);
            return { name: inst.full_name?.split(' ')[0] || 'User', total, count: myApps.length };
        }).sort((a, b) => b.total - a.total);

        const daysInMonth = new Date(Number(selectedMonth.split('-')[0]), Number(selectedMonth.split('-')[1]), 0).getDate();
        const cashFlowData = Array.from({ length: daysInMonth }, (_, i) => {
            const d = i + 1;
            const income = appsMonth.filter(a => new Date(a.completed_at).getDate() === d).reduce((acc, c) => acc + (Number(c.net_amount) || 0), 0);
            const expense = expsMonth.filter(e => new Date(e.date).getDate() === d).reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
            return { day: d, entrada: income, saida: expense };
        });

        const coatByCat = {};
        appsMonth.forEach(a => {
            const matName = inventory.find(i => i.id === a.material_used_id)?.name || 'Outro / Avulso';
            coatByCat[matName] = (coatByCat[matName] || 0) + 1;
        });
        const pieDataCoatings = Object.keys(coatByCat).map(k => ({ name: k, value: coatByCat[k] })).sort((a, b) => b.value - a.value);

        const cityByCount = {};
        appsMonth.forEach(a => {
            const cityName = a.calendar_name || 'Não informada';
            cityByCount[cityName] = (cityByCount[cityName] || 0) + 1;
        });
        const pieDataCities = Object.keys(cityByCount).map(k => ({ name: k, value: cityByCount[k] })).sort((a, b) => b.value - a.value);

        const daysOfWeekCount = { 'Segunda': 0, 'Terça': 0, 'Quarta': 0, 'Quinta': 0, 'Sexta': 0, 'Sábado': 0, 'Domingo': 0 };
        appsMonth.forEach(a => {
            if (a.completed_at) {
                const dayNum = new Date(a.completed_at).getDay();
                const daysMap = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                daysOfWeekCount[daysMap[dayNum]]++;
            }
        });
        const barDataWeekDays = Object.keys(daysOfWeekCount).map(k => ({ name: k, value: daysOfWeekCount[k] }));

        const hojeStr = new Date().toLocaleDateString();
        const ontemDate = new Date(); ontemDate.setDate(ontemDate.getDate() - 1);
        const ontemStr = ontemDate.toLocaleDateString();

        return {
            totalGross, totalNet, totalExpense, profit: totalNet - totalExpense, ticketMedio,
            pieDataIncome, pieDataExpenses, rankingData, cashFlowData, pieDataCoatings,
            pieDataCities, barDataWeekDays,
            feitosMes: appsMonth.length,
            feitosHoje: appsMonth.filter(a => new Date(a.completed_at).toLocaleDateString() === hojeStr).length,
            feitosOntem: appsMonth.filter(a => new Date(a.completed_at).toLocaleDateString() === ontemStr).length,
            agendadosFuturo: futureAppsMonth.length
        };
    }, [appointments, expenses, installers, selectedMonth, futureAppointments, inventory]);

    const commissionReport = useMemo(() => {
        return installers.map(inst => {
            const myApps = appointments.filter(a => a.user_id === inst.id);
            const total = myApps.reduce((acc, curr) => acc + (Number(curr.commission_amount) || 0), 0);
            return {
                id: inst.id, name: inst.full_name || inst.email, count: myApps.length, total: total,
                region_id: inst.region_id
            };
        });
    }, [appointments, installers]);

    const displayAccounts = useMemo(() => {
        return accounts.filter(acc => selectedRegion === 'all' || acc.type === 'banco' || acc.region_id === selectedRegion);
    }, [accounts, selectedRegion]);

    const filteredAppointments = useMemo(() => {
        return appointments.filter(a => {
            const matName = inventory.find(i => i.id === a.material_used_id)?.name || 'Nenhum / Avulso';
            const matchesSearch = (a.customer_name || '').toLowerCase().includes(atmSearchTerm.toLowerCase()) || (a.vehicle_model || '').toLowerCase().includes(atmSearchTerm.toLowerCase());
            const matchesRegion = atmFilterRegion === 'all' || a.region_id === atmFilterRegion;
            const matchesCoating = atmFilterCoating === 'all' || a.material_used_id === atmFilterCoating || (atmFilterCoating === 'none' && !a.material_used_id);
            const matchesPayment = atmFilterPayment === 'all' || a.payment_method === atmFilterPayment || a.payment_method_2 === atmFilterPayment;
            return matchesSearch && matchesRegion && matchesCoating && matchesPayment;
        });
    }, [appointments, atmSearchTerm, atmFilterRegion, atmFilterCoating, atmFilterPayment, inventory]);

    const filteredFutureAppointments = useMemo(() => {
        return futureAppointments.filter(a => {
            const matchesSearch = (a.customer_name || '').toLowerCase().includes(atmSearchTerm.toLowerCase()) || (a.vehicle_model || '').toLowerCase().includes(atmSearchTerm.toLowerCase());
            const matchesRegion = atmFilterRegion === 'all' || a.region_id === atmFilterRegion;
            return matchesSearch && matchesRegion; // Future appointments don't have coatings/payments defined yet usually
        });
    }, [futureAppointments, atmSearchTerm, atmFilterRegion]);

    const paginatedAppointments = useMemo(() => {
        const startIndex = (atmCurrentPageRealizados - 1) * atmItemsPerPage;
        return filteredAppointments.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at)).slice(startIndex, startIndex + atmItemsPerPage);
    }, [filteredAppointments, atmCurrentPageRealizados, atmItemsPerPage]);

    const paginatedFutureAppointments = useMemo(() => {
        const startIndex = (atmCurrentPageFuturos - 1) * atmItemsPerPage;
        return filteredFutureAppointments.slice(startIndex, startIndex + atmItemsPerPage);
    }, [filteredFutureAppointments, atmCurrentPageFuturos, atmItemsPerPage]);

    const filteredTransactions = useMemo(() => {
        return [
            ...appointments.flatMap(a => {
                const primaryAccount = accounts.find(acc => acc.id === a.account_id);
                const primary = {
                    ...a,
                    type: 'in',
                    date: a.completed_at,
                    val: a.gross_amount,
                    net_val: a.net_amount,
                    city: a.calendar_name,
                    label: `${a.vehicle_model} - ${a.customer_name}`,
                    account_name: primaryAccount?.name || 'Conta Removida',
                    account_region: primaryAccount?.region_id,
                    is_primary: true
                };
                if (a.is_split_payment) {
                    const secondaryAccount = accounts.find(acc => acc.id === a.account_id_2);
                    const secondary = {
                        ...a,
                        type: 'in',
                        date: a.completed_at,
                        val: a.gross_amount_2,
                        net_val: a.net_amount_2,
                        payment_method: a.payment_method_2,
                        city: a.calendar_name,
                        label: `${a.vehicle_model} - ${a.customer_name} (Pagto 2)`,
                        account_name: secondaryAccount?.name || 'Conta Removida',
                        account_region: secondaryAccount?.region_id,
                        is_primary: false
                    };
                    return [primary, secondary];
                }
                return [primary];
            }),
            ...expenses.map(e => {
                const expAccount = accounts.find(acc => acc.id === e.account_id);
                return {
                    ...e,
                    type: 'out',
                    date: e.date,
                    val: e.amount,
                    net_val: e.amount,
                    city: '',
                    label: e.description,
                    account_name: expAccount?.name || 'Conta Excluída',
                    account_region: expAccount?.region_id
                };
            })
        ].sort((a, b) => new Date(b.date) - new Date(a.date)).filter(t => {
            let matches = true;
            if (finFilterType !== 'all' && t.type !== finFilterType) matches = false;
            if (finFilterCategory !== 'all') {
                if (t.type === 'in') matches = false; // Receitas não tem categoria (por enquanto)
                else if (t.expense_categories?.name !== finFilterCategory) matches = false;
            }
            if (finFilterAccount !== 'all' && t.account_id !== finFilterAccount && t.account_id_2 !== finFilterAccount) matches = false;
            if (selectedRegion === 'all' && finFilterRegion !== 'all' && (t.account_region || t.region_id) !== finFilterRegion) matches = false;
            if (finSearchTerm) {
                const term = finSearchTerm.toLowerCase();
                const searchString = `${t.label} ${t.account_name} ${t.val}`.toLowerCase();
                if (!searchString.includes(term)) matches = false;
            }
            return matches;
        });
    }, [appointments, expenses, accounts, finFilterType, finFilterCategory, finFilterAccount, finFilterRegion, finSearchTerm, selectedRegion]);

    const paginatedTransactions = useMemo(() => {
        const startIndex = (finCurrentPage - 1) * finItemsPerPage;
        return filteredTransactions.slice(startIndex, startIndex + finItemsPerPage);
    }, [filteredTransactions, finCurrentPage, finItemsPerPage]);

    // Keyboard UX para Modais (Atendimentos e Financeiro)
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ignorar setas se o foco estiver em um input (para não atrapalhar digitação)
            if ((e.key.startsWith('Arrow')) && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT' || document.activeElement.tagName === 'TEXTAREA')) {
                return;
            }

            // --- Modal de Atendimentos (Visualização) ---
            if (selectedTransaction) {
                if (e.key === 'Escape') {
                    setSelectedTransaction(null);
                    return;
                }
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    const sorted = [...filteredAppointments].sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
                    const idx = sorted.findIndex(a => a.id === selectedTransaction.id);
                    if (idx !== -1 && idx < sorted.length - 1) setSelectedTransaction(sorted[idx + 1]);
                }
                if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    const sorted = [...filteredAppointments].sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
                    const idx = sorted.findIndex(a => a.id === selectedTransaction.id);
                    if (idx > 0) setSelectedTransaction(sorted[idx - 1]);
                }
            }

            // --- Modal de Edição (Financeiro) ---
            if (showEditModal && editingItem && activeTab === 'financeiro') {
                if (e.key === 'Escape') {
                    setShowEditModal(false);
                    return;
                }
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    const idx = paginatedTransactions.findIndex(a => a.id === editingItem.id && a.is_primary === editingItem.is_primary);
                    if (idx !== -1 && idx < paginatedTransactions.length - 1) {
                        const nextItem = paginatedTransactions[idx + 1];
                        openEditModal(nextItem.type === 'in' ? 'appointment' : 'expense', nextItem);
                    }
                }
                if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    const idx = paginatedTransactions.findIndex(a => a.id === editingItem.id && a.is_primary === editingItem.is_primary);
                    if (idx > 0) {
                        const prevItem = paginatedTransactions[idx - 1];
                        openEditModal(prevItem.type === 'in' ? 'appointment' : 'expense', prevItem);
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedTransaction, filteredAppointments, showEditModal, editingItem, activeTab, paginatedTransactions]);

    // --- COMPONENTE BOTTOM NAV (QUE FALTAVA!) ---
    const BottomNav = () => (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-50 px-6 py-2 flex justify-between items-center safe-area-bottom overflow-x-auto">
            {['dashboard', 'atendimentos', 'financeiro', 'equipe', 'estoque', 'configuracoes'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`flex flex-col items-center gap-1 p-2 flex-shrink-0 ${activeTab === tab ? 'text-blue-500' : 'text-slate-500'}`}>
                    {tab === 'dashboard' ? <LayoutDashboard size={22} /> : tab === 'atendimentos' ? <ListTodo size={22} /> : tab === 'financeiro' ? <Banknote size={22} /> : tab === 'equipe' ? <Users size={22} /> : tab === 'estoque' ? <Package size={22} /> : <Settings size={22} />}
                </button>
            ))}
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-slate-800 flex">
            <aside className="hidden md:flex w-64 flex-col bg-slate-900 text-slate-300 h-screen fixed left-0 top-0 z-50">
                <div className="p-6 flex justify-center border-b border-slate-800"><img src="/icon-horizontal.png" alt="Logo" className="h-10 object-contain brightness-0 invert opacity-90" /></div>
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {['dashboard', 'atendimentos', 'financeiro', 'equipe', 'estoque', 'configuracoes'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium capitalize ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800 hover:text-white'}`}>
                            {tab === 'dashboard' && <LayoutDashboard size={20} />}
                            {tab === 'atendimentos' && <ListTodo size={20} />}
                            {tab === 'financeiro' && <Banknote size={20} />}
                            {tab === 'equipe' && <Users size={20} />}
                            {tab === 'estoque' && <Package size={20} />}
                            {tab === 'configuracoes' && <Settings size={20} />}
                            {tab === 'configuracoes' ? 'Configurações' : tab}
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t border-slate-800">
                    <button onClick={() => window.open('/?mode=preview', '_blank')} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 text-blue-400 transition-all font-medium mb-2"><Smartphone size={20} /> Ver App</button>
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-900/30 text-red-400 transition-all font-medium"><LogOut size={20} /> Sair</button>
                </div>
            </aside>

            <div className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden">
                <div className="bg-slate-900 border-b border-slate-800 p-4 md:p-6 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm z-40 relative text-white">
                    <div className="w-full flex justify-between md:hidden items-center">
                        <img src="/icon-horizontal.png" alt="Logo" className="h-8 object-contain brightness-0 invert" />
                        <button onClick={() => window.location.href = '/?mode=preview'} className="bg-blue-600 p-2 rounded-lg text-white"><Eye size={20} /></button>
                    </div>
                    <div className="hidden md:block">
                        <h1 className="text-2xl font-bold text-white tracking-tight">Painel Administrativo</h1>
                        <p className="text-slate-400 text-sm">Visão Geral da Operação</p>
                    </div>
                    <div className="flex w-full md:w-auto gap-3">
                        <div className="flex-1 md:flex-none flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-xl border border-slate-700">
                            <Calendar size={18} className="text-slate-400" />
                            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent font-bold text-slate-200 outline-none cursor-pointer w-full filter invert-0" />
                        </div>
                        <div className="flex-1 md:flex-none flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-xl border border-slate-700">
                            <Filter size={18} className="text-slate-400" />
                            <select value={selectedRegion} onChange={e => setSelectedRegion(e.target.value)} className="bg-transparent font-bold text-slate-200 outline-none cursor-pointer w-full uppercase">
                                <option value="all" className="text-black font-bold">🌐 Visão Global</option>
                                {regions.map(r => <option key={r.slug} value={r.slug} className="text-black">{r.name}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8 bg-gray-100">
                    {loading ? <div className="h-full flex items-center justify-center text-slate-400">Carregando dados...</div> : (
                        <div className="max-w-7xl mx-auto animate-in fade-in space-y-6">

                            {activeTab === 'dashboard' && (
                                <>
                                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><TrendingUp size={20} className="text-blue-600" /> Balanço Financeiro</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-white p-5 rounded-2xl border border-gray-100 flex flex-col justify-between h-full"><p className="text-slate-500 text-[10px] sm:text-xs font-bold uppercase mb-2">Faturamento Bruto</p><h3 className="text-xl sm:text-2xl font-bold text-slate-900 truncate" title={`R$ ${dashboardStats.totalGross.toFixed(2)}`}>R$ {dashboardStats.totalGross.toFixed(2)}</h3></div>
                                        <div className="bg-white p-5 rounded-2xl border border-gray-100 flex flex-col justify-between h-full"><p className="text-slate-500 text-[10px] sm:text-xs font-bold uppercase mb-2">Ticket Médio</p><h3 className="text-xl sm:text-2xl font-bold text-blue-600 truncate" title={`R$ ${dashboardStats.ticketMedio.toFixed(2)}`}>R$ {dashboardStats.ticketMedio.toFixed(2)}</h3></div>
                                        <div className="bg-white p-5 rounded-2xl border border-gray-100 flex flex-col justify-between h-full"><p className="text-slate-500 text-[10px] sm:text-xs font-bold uppercase mb-2">Despesas</p><h3 className="text-xl sm:text-2xl font-bold text-red-600 truncate" title={`R$ ${dashboardStats.totalExpense.toFixed(2)}`}>R$ {dashboardStats.totalExpense.toFixed(2)}</h3></div>
                                        <div className="bg-slate-900 p-5 rounded-2xl shadow-lg text-white flex flex-col justify-between h-full"><p className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase mb-2">Lucro Líquido</p><h3 className="text-xl sm:text-2xl font-bold truncate" title={`R$ ${dashboardStats.profit.toFixed(2)}`}>R$ {dashboardStats.profit.toFixed(2)}</h3></div>
                                    </div>

                                    <h3 className="font-bold text-slate-800 mt-8 mb-4 flex items-center gap-2"><ListTodo size={20} className="text-blue-600" /> Resumo de Atendimentos</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                        <div className="bg-white p-4 rounded-xl border border-gray-100 flex flex-col justify-center items-center text-center"><p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Feitos no Mês</p><p className="text-2xl font-bold text-slate-800">{dashboardStats.feitosMes}</p></div>
                                        <div className="bg-white p-4 rounded-xl border border-gray-100 flex flex-col justify-center items-center text-center"><p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Feitos Ontem</p><p className="text-2xl font-bold text-slate-800">{dashboardStats.feitosOntem}</p></div>
                                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col justify-center items-center text-center"><p className="text-blue-600 text-[10px] font-bold uppercase tracking-wider mb-1">Feitos Hoje</p><p className="text-2xl font-bold text-blue-700">{dashboardStats.feitosHoje}</p></div>
                                        <div className="bg-white p-4 rounded-xl border border-gray-100 flex flex-col justify-center items-center text-center"><p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Agendados (Futuros)</p><p className="text-2xl font-bold text-slate-800">{dashboardStats.agendadosFuturo}</p></div>
                                    </div>

                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-8">
                                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Banknote size={20} className="text-blue-600" /> Saldos em Conta</h3>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                                            {displayAccounts.map(acc => (
                                                <div key={acc.id} className={`p-4 rounded-xl border ${acc.is_default ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300' : 'bg-gray-50 border-gray-200'}`}>
                                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{acc.type === 'banco' ? 'Global' : `Cx. ${acc.region_id}`}</p>
                                                    <p className="font-bold text-lg text-slate-900 truncate">{acc.name}</p>
                                                    <p className={`text-xl font-bold mt-1 ${Number(acc.balance) < 0 ? 'text-red-600' : 'text-slate-700'}`}>R$ {Number(acc.balance).toFixed(2)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2 h-80">
                                            <h4 className="font-bold text-slate-700 mb-6 flex items-center gap-2 text-xs uppercase tracking-wide"><TrendingUp size={16} /> Fluxo de Caixa (Dia a Dia)</h4>
                                            <ResponsiveContainer width="100%" height="85%">
                                                <AreaChart data={dashboardStats.cashFlowData}>
                                                    <defs>
                                                        <linearGradient id="colorEntrada" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.1} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                                                        <linearGradient id="colorSaida" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                                    <Tooltip />
                                                    <Area type="monotone" dataKey="entrada" stroke="#10b981" fillOpacity={1} fill="url(#colorEntrada)" strokeWidth={2} name="Entrada Líq." />
                                                    <Area type="monotone" dataKey="saida" stroke="#ef4444" fillOpacity={1} fill="url(#colorSaida)" strokeWidth={2} name="Saídas" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-80">
                                            <h4 className="font-bold text-slate-700 mb-6 flex items-center gap-2 text-xs uppercase tracking-wide"><TrendingDown size={16} /> Despesas por Categoria</h4>
                                            <ResponsiveContainer width="100%" height="85%">
                                                <PieChart>
                                                    <Pie data={dashboardStats.pieDataExpenses} innerRadius={48} outerRadius={64} paddingAngle={5} dataKey="value">
                                                        {dashboardStats.pieDataExpenses.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                                    </Pie>
                                                    <Tooltip formatter={(value) => `R$ ${Number(value).toFixed(2)} (${dashboardStats.totalExpense ? ((value / dashboardStats.totalExpense) * 100).toFixed(1) : 0}%)`} />
                                                    <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-80">
                                            <h4 className="font-bold text-slate-700 mb-6 flex items-center gap-2 text-xs uppercase tracking-wide"><PieIcon size={16} /> Receita por Método</h4>
                                            <ResponsiveContainer width="100%" height="85%">
                                                <PieChart>
                                                    <Pie data={dashboardStats.pieDataIncome} innerRadius={48} outerRadius={64} paddingAngle={5} dataKey="value">
                                                        {dashboardStats.pieDataIncome.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                                    </Pie>
                                                    <Tooltip formatter={(value) => `R$ ${Number(value).toFixed(2)} (${dashboardStats.totalGross ? ((value / dashboardStats.totalGross) * 100).toFixed(1) : 0}%)`} />
                                                    <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>

                                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-[600px] md:col-span-2">
                                            <h4 className="font-bold text-slate-700 mb-6 flex items-center gap-2 text-xs uppercase tracking-wide"><Package size={16} /> Comparativo de Revestimentos (Detalhado)</h4>
                                            <ResponsiveContainer width="100%" height="90%">
                                                <BarChart data={dashboardStats.pieDataCoatings} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                                                    <XAxis type="number" hide />
                                                    <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                    <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(value) => [`${value} (${dashboardStats.feitosMes ? ((value / dashboardStats.feitosMes) * 100).toFixed(1) : 0}%)`, 'Quantidade']} />
                                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                                                        {dashboardStats.pieDataCoatings.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 items-start">
                                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-[400px]">
                                            <h4 className="font-bold text-slate-700 mb-6 flex items-center gap-2 text-xs uppercase tracking-wide"><PieIcon size={16} /> Atendimentos por Cidade</h4>
                                            <ResponsiveContainer width="100%" height="90%">
                                                <BarChart data={dashboardStats.pieDataCities} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                                                    <XAxis type="number" hide />
                                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                    <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(value) => [`${value} (${dashboardStats.feitosMes ? ((value / dashboardStats.feitosMes) * 100).toFixed(1) : 0}%)`, 'Atendimentos']} />
                                                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                                                        {dashboardStats.pieDataCities.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-[400px]">
                                            <h4 className="font-bold text-slate-700 mb-6 flex items-center gap-2 text-xs uppercase tracking-wide"><BarChart3 size={16} /> Atendimentos por Dia da Semana</h4>
                                            <ResponsiveContainer width="100%" height="90%">
                                                <BarChart data={dashboardStats.barDataWeekDays} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                    <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(value) => [value, 'Atendimentos']} />
                                                    <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={32}>
                                                        {dashboardStats.barDataWeekDays.map((entry, index) => (<Cell key={`cell-${index}`} fill="#3b82f6" />))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </>
                            )}

                            {activeTab === 'atendimentos' && (
                                <div className="space-y-6">
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="font-bold text-slate-800 flex items-center gap-2"><ListTodo size={20} className="text-blue-600" /> Atendimentos</h3>
                                        </div>

                                        {/* ATENDIMENTOS TABS E FILTROS */}
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 mb-6">
                                            <div className="flex">
                                                <button className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors ${atendimentosTab === 'realizados' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`} onClick={() => setAtendimentosTab('realizados')}> Realizados ({filteredAppointments.length}) </button>
                                                <button className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors ${atendimentosTab === 'futuros' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`} onClick={() => setAtendimentosTab('futuros')}> Agendados ({filteredFutureAppointments.length}) </button>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 p-4 rounded-xl border border-gray-200 mb-6 flex flex-col gap-3">
                                            <div className="flex gap-2 w-full">
                                                <div className="relative flex-1">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                    <input type="text" placeholder="Buscar Cliente ou Veículo..." value={atmSearchTerm} onChange={(e) => setAtmSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-slate-800 outline-none focus:border-blue-500" />
                                                </div>
                                                <button onClick={() => setAtmSearchAllMonths(!atmSearchAllMonths)} className={`p-2 rounded-lg border text-sm font-bold flex items-center gap-2 transition-colors ${atmSearchAllMonths ? 'bg-blue-600 border-blue-700 text-white' : 'bg-white border-gray-200 text-slate-600 hover:bg-slate-50'}`}>
                                                    Buscar Todos os Meses
                                                </button>
                                                <button onClick={() => setShowAtmFilters(!showAtmFilters)} className={`p-2 rounded-lg border flex items-center justify-center transition-colors ${showAtmFilters ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-slate-600 hover:bg-slate-50'}`}>
                                                    <Filter size={18} />
                                                </button>
                                            </div>
                                            {showAtmFilters && (
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    <select value={atmFilterRegion} onChange={(e) => setAtmFilterRegion(e.target.value)} className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500">
                                                        <option value="all">Todas Regionais</option>
                                                        {regions.map(r => <option key={r.slug} value={r.slug}>{r.name}</option>)}
                                                    </select>
                                                    {atendimentosTab === 'realizados' && (
                                                        <>
                                                            <select value={atmFilterCoating} onChange={(e) => setAtmFilterCoating(e.target.value)} className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500">
                                                                <option value="all">Tipos de Revestimento</option>
                                                                <option value="none">Nenhum / Avulso</option>
                                                                {inventory.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                                            </select>
                                                            <select value={atmFilterPayment} onChange={(e) => setAtmFilterPayment(e.target.value)} className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500">
                                                                <option value="all">Todas Formas Pagamento</option>
                                                                <option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="debito">Débito</option><option value="credito">Crédito</option>
                                                            </select>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-8">
                                            {/* FUTUROS */}
                                            {atendimentosTab === 'futuros' && (
                                                <div>
                                                    <h4 className="text-slate-600 font-bold mb-4 uppercase text-xs tracking-wider">Agendamentos Futuros</h4>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-sm text-left hidden md:table">
                                                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-gray-100">
                                                                <tr>
                                                                    <th className="p-4">Data/Hora</th>
                                                                    <th className="p-4">Cliente / Veículo</th>
                                                                    <th className="p-4">Cidade</th>
                                                                    <th className="p-4">Serviço / Valor</th>
                                                                    <th className="p-4">Local</th>
                                                                    <th className="p-4 text-center">Ações</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100">
                                                                {filteredFutureAppointments.length === 0 ? (
                                                                    <tr><td colSpan="6" className="p-8 text-center text-slate-500">Nenhum agendamento encontrado para este filtro.</td></tr>
                                                                ) : paginatedFutureAppointments.map(a => (
                                                                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                                                                        <td className="p-4 font-medium text-slate-700">
                                                                            {new Date(a.appointment_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} <br />
                                                                            <span className="text-xs text-slate-500">{new Date(a.appointment_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                        </td>
                                                                        <td className="p-4">
                                                                            <p className="font-bold text-slate-800">{a.customer_name}</p>
                                                                            <p className="text-xs text-slate-500">{a.vehicle_model} {a.vehicle_year && `(${a.vehicle_year})`}</p>
                                                                        </td>
                                                                        <td className="p-4 text-slate-600">
                                                                            {a.calendar_name || '-'}
                                                                        </td>
                                                                        <td className="p-4">
                                                                            <p className="text-slate-700">{a.service_type || 'Instalação'}</p>
                                                                            <p className="font-bold text-emerald-600 border border-emerald-100 bg-emerald-50 px-2 py-0.5 rounded inline-block mt-1">R$ {Number(a.gross_amount).toFixed(2)}</p>
                                                                        </td>
                                                                        <td className="p-4 capitalize text-slate-600">
                                                                            {a.region_id || 'N/A'}
                                                                        </td>
                                                                        <td className="p-4 text-center">
                                                                            <div className="flex justify-center gap-2">
                                                                                <button onClick={() => openEditModal('appointment', a)} className="p-1.5 text-blue-400 hover:bg-blue-50 rounded"><Pencil size={16} /></button>
                                                                                <button onClick={() => handleDelete('appointments', a.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>

                                                        {/* Mobile Cards para Atendimentos Futuros */}
                                                        <div className="md:hidden flex flex-col gap-4 mt-2">
                                                            {filteredFutureAppointments.length === 0 ? (
                                                                <div className="p-8 text-center text-slate-500 border border-slate-100 rounded-xl bg-slate-50">Nenhum atendimento agendado encontrado.</div>
                                                            ) : paginatedFutureAppointments.map(a => (
                                                                <div key={`mob-fut-${a.id}`} className="bg-white p-3 rounded-xl shadow-md border border-slate-200 flex flex-col gap-2">
                                                                    <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                                                                        <div>
                                                                            <p className="font-bold text-slate-800 leading-tight">{a.customer_name}</p>
                                                                            <p className="text-[11px] text-slate-500 capitalize">{a.vehicle_model}{a.vehicle_year ? ` (${a.vehicle_year})` : ''}</p>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <p className="font-medium text-slate-700 text-xs">{new Date(a.appointment_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</p>
                                                                            <p className="text-[10px] text-slate-500">{new Date(a.appointment_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-xs mt-1 gap-3">
                                                                        <div className="flex-1 space-y-1 bg-slate-50 border border-slate-200 shadow-sm rounded-lg p-2">
                                                                            <div>
                                                                                <span className="text-[9px] uppercase text-slate-400 font-bold block">Cidade</span>
                                                                                <span className="text-slate-600 text-xs break-words leading-tight block">{a.calendar_name || '-'}</span>
                                                                            </div>
                                                                            <div className="flex justify-between font-medium text-slate-600 pt-1 border-t border-slate-200 mt-1">
                                                                                <span className="capitalize">Valor</span>
                                                                                <span className="text-emerald-600 font-bold">R$ {Number(a.gross_amount).toFixed(2)}</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex shrink-0 gap-1 items-center">
                                                                            <button onClick={() => openEditModal('appointment', a)} className="p-2 text-blue-500 bg-white hover:bg-blue-50 rounded-lg border border-slate-200 shadow-sm"><Pencil size={14}/></button>
                                                                            <button onClick={() => handleDelete('appointments', a.id)} className="p-2 text-red-500 bg-white hover:bg-red-50 rounded-lg border border-slate-200 shadow-sm"><Trash2 size={14}/></button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-center mt-4">
                                                        <select value={atmItemsPerPage} onChange={(e) => { setAtmItemsPerPage(Number(e.target.value)); setAtmCurrentPageFuturos(1); setAtmCurrentPageRealizados(1); }} className="p-2 border border-gray-200 rounded-lg text-sm text-slate-600 outline-none">
                                                            <option value={10}>10 por página</option>
                                                            <option value={50}>50 por página</option>
                                                            <option value={100}>100 por página</option>
                                                        </select>
                                                        <div className="flex gap-2">
                                                            <button onClick={() => setAtmCurrentPageFuturos(p => Math.max(1, p - 1))} disabled={atmCurrentPageFuturos === 1} className="px-3 py-1 bg-slate-100 text-slate-600 rounded disabled:opacity-50">Anterior</button>
                                                            <span className="px-3 py-1 text-sm text-slate-600 font-medium">Página {atmCurrentPageFuturos} de {Math.ceil(filteredFutureAppointments.length / atmItemsPerPage) || 1}</span>
                                                            <button onClick={() => setAtmCurrentPageFuturos(p => p + 1)} disabled={atmCurrentPageFuturos >= Math.ceil(filteredFutureAppointments.length / atmItemsPerPage)} className="px-3 py-1 bg-slate-100 text-slate-600 rounded disabled:opacity-50">Próxima</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* REALIZADOS */}
                                            {atendimentosTab === 'realizados' && (
                                                <div>
                                                    <h4 className="text-slate-600 font-bold mb-4 uppercase text-xs tracking-wider">Atendimentos Realizados</h4>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-sm text-left hidden md:table">
                                                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-gray-100">
                                                                <tr>
                                                                    <th className="p-4">Concluído Em</th>
                                                                    <th className="p-4">Cliente / Veículo</th>
                                                                    <th className="p-4">Cidade</th>
                                                                    <th className="p-4">Revestimento</th>
                                                                    <th className="p-4">Pagamento</th>
                                                                    <th className="p-4 text-center">Ações</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100">
                                                                {filteredAppointments.length === 0 ? (
                                                                    <tr><td colSpan="6" className="p-8 text-center text-slate-500">Nenhum atendimento realizado encontrado para este filtro.</td></tr>
                                                                ) : paginatedAppointments.map(a => (
                                                                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                                                                        <td className="p-4 font-medium text-slate-700">
                                                                            {new Date(a.completed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} <br />
                                                                            <span className="text-xs text-slate-500">{new Date(a.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                        </td>
                                                                        <td className="p-4">
                                                                            <p className="font-bold text-slate-800">{a.customer_name}</p>
                                                                            <p className="text-xs text-slate-500 capitalize">{a.vehicle_model} • {a.region_id}</p>
                                                                        </td>
                                                                        <td className="p-4 text-slate-600">
                                                                            {a.calendar_name || '-'}
                                                                        </td>
                                                                        <td className="p-4 text-slate-600">
                                                                            {inventory.find(i => i.id === a.material_used_id)?.name || '-'}
                                                                        </td>
                                                                        <td className="p-4">
                                                                            <div className="space-y-1">
                                                                                <div className="flex justify-between gap-4 text-xs bg-slate-100 p-1.5 rounded">
                                                                                    <span className="font-bold text-slate-600 capitalize">{a.payment_method}</span>
                                                                                    <span className="font-bold text-emerald-600">R$ {Number(a.gross_amount).toFixed(2)}</span>
                                                                                </div>
                                                                                {a.is_split_payment && (
                                                                                    <div className="flex justify-between gap-4 text-xs bg-slate-100 p-1.5 rounded">
                                                                                        <span className="font-bold text-slate-600 capitalize">{a.payment_method_2}</span>
                                                                                        <span className="font-bold text-emerald-600">R$ {Number(a.gross_amount_2).toFixed(2)}</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td className="p-4 text-center">
                                                                            <div className="flex justify-center gap-2">
                                                                                <button onClick={() => setSelectedTransaction(a)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Ver Detalhes/Foto"><Eye size={16} /></button>
                                                                                <button onClick={() => openEditModal('appointment', a)} className="p-1.5 text-blue-400 hover:bg-blue-50 rounded"><Pencil size={16} /></button>
                                                                                <button onClick={() => handleDelete('appointments', a.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>

                                                        {/* Mobile Cards para Atendimentos Realizados */}
                                                        <div className="md:hidden flex flex-col gap-4 mt-2">
                                                            {filteredAppointments.length === 0 ? (
                                                                <div className="p-8 text-center text-slate-500 border border-slate-100 rounded-xl bg-slate-50">Nenhum atendimento realizado encontrado para este filtro.</div>
                                                            ) : paginatedAppointments.map(a => (
                                                                <div key={`mob-${a.id}`} className="bg-white p-3 rounded-xl shadow-md border border-slate-200 flex flex-col gap-2">
                                                                    <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                                                                        <div>
                                                                            <p className="font-bold text-slate-800 leading-tight">{a.customer_name}</p>
                                                                            <p className="text-[11px] text-slate-500 capitalize">{a.vehicle_model}{a.vehicle_year ? ` (${a.vehicle_year})` : ''}</p>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <p className="font-medium text-slate-700 text-xs">{new Date(a.completed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</p>
                                                                            <p className="text-[10px] text-slate-500">{new Date(a.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <div>
                                                                            <span className="text-[9px] uppercase text-slate-400 font-bold block">Cidade</span>
                                                                            <span className="text-slate-600 text-xs break-words leading-tight block">{a.calendar_name || '-'}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[9px] uppercase text-slate-400 font-bold block">Revestimento</span>
                                                                            <span className="text-slate-600 text-xs break-words leading-tight block">{inventory.find(i => i.id === a.material_used_id)?.name || '-'}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex justify-between items-center text-xs mt-1 gap-3">
                                                                        <div className="flex-1 space-y-1 bg-slate-50 border border-slate-200 shadow-sm rounded-lg p-2">
                                                                            <div className="flex justify-between font-medium text-slate-600">
                                                                                <span className="capitalize">{a.payment_method}</span>
                                                                                <span className="text-emerald-600 font-bold">R$ {Number(a.gross_amount).toFixed(2)}</span>
                                                                            </div>
                                                                            {a.is_split_payment && (
                                                                                <div className="flex justify-between font-medium text-slate-600 border-t border-slate-200 pt-1 mt-1">
                                                                                    <span className="capitalize">{a.payment_method_2}</span>
                                                                                    <span className="text-emerald-600 font-bold">R$ {Number(a.gross_amount_2).toFixed(2)}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex shrink-0 gap-1 items-center">
                                                                            <button onClick={() => setSelectedTransaction(a)} className="p-2 text-slate-500 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 shadow-sm"><Eye size={14}/></button>
                                                                            <button onClick={() => openEditModal('appointment', a)} className="p-2 text-blue-500 bg-white hover:bg-blue-50 rounded-lg border border-slate-200 shadow-sm"><Pencil size={14}/></button>
                                                                            <button onClick={() => handleDelete('appointments', a.id)} className="p-2 text-red-500 bg-white hover:bg-red-50 rounded-lg border border-slate-200 shadow-sm"><Trash2 size={14}/></button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-center mt-4">
                                                        <select value={atmItemsPerPage} onChange={(e) => { setAtmItemsPerPage(Number(e.target.value)); setAtmCurrentPageFuturos(1); setAtmCurrentPageRealizados(1); }} className="p-2 border border-gray-200 rounded-lg text-sm text-slate-600 outline-none">
                                                            <option value={10}>10 por página</option>
                                                            <option value={50}>50 por página</option>
                                                            <option value={100}>100 por página</option>
                                                        </select>
                                                        <div className="flex gap-2">
                                                            <button onClick={() => setAtmCurrentPageRealizados(p => Math.max(1, p - 1))} disabled={atmCurrentPageRealizados === 1} className="px-3 py-1 bg-slate-100 text-slate-600 rounded disabled:opacity-50">Anterior</button>
                                                            <span className="px-3 py-1 text-sm text-slate-600 font-medium">Página {atmCurrentPageRealizados} de {Math.ceil(filteredAppointments.length / atmItemsPerPage) || 1}</span>
                                                            <button onClick={() => setAtmCurrentPageRealizados(p => p + 1)} disabled={atmCurrentPageRealizados >= Math.ceil(filteredAppointments.length / atmItemsPerPage)} className="px-3 py-1 bg-slate-100 text-slate-600 rounded disabled:opacity-50">Próxima</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'financeiro' && (
                                <div className="space-y-6">
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-bold text-slate-800 flex items-center gap-2"><TrendingDown className="text-red-500" size={20} /> Nova Despesa</h3>
                                            <button onClick={() => setShowExpenseForm(!showExpenseForm)} className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors">{showExpenseForm ? 'FECHAR' : 'ADICIONAR DESPESA'}</button>
                                        </div>
                                        {showExpenseForm && (
                                            <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end animate-in fade-in slide-in-from-top-2">
                                                <div className="md:col-span-2"><label className="text-xs font-bold text-slate-500 mb-1 block">Descrição</label><input className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" required value={newExpense.description} onChange={e => setNewExpense({ ...newExpense, description: e.target.value })} /></div>
                                                <div><label className="text-xs font-bold text-slate-500 mb-1 block">Data</label><input type="date" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" required value={newExpense.date} onChange={e => setNewExpense({ ...newExpense, date: e.target.value })} /></div>
                                                <div><label className="text-xs font-bold text-slate-500 mb-1 block">Valor (R$)</label><input className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" type="number" step="0.01" required value={newExpense.amount} onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })} /></div>
                                                <div><label className="text-xs font-bold text-slate-500 mb-1 block">Categoria</label><select className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" required value={newExpense.category_id} onChange={e => setNewExpense({ ...newExpense, category_id: e.target.value })}><option value="">...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                                                <div className="md:col-span-2"><label className="text-xs font-bold text-slate-500 mb-1 block">Região Destino</label><select className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" required value={newExpense.region_id || (selectedRegion === 'all' ? 'matriz' : selectedRegion)} onChange={e => setNewExpense({ ...newExpense, region_id: e.target.value })}><option value="matriz">Matriz / Global</option>{regions.filter(r => r.slug !== 'matriz').map(r => <option key={r.slug} value={r.slug}>{r.name}</option>)}</select></div>
                                                <div className="md:col-span-2"><label className="text-xs font-bold text-slate-500 mb-1 block">Conta de Saída</label><select className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl" required value={newExpense.account_id} onChange={e => setNewExpense({ ...newExpense, account_id: e.target.value })}><option value="">Selecione a conta...</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                                                <button className="w-full bg-red-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-red-700">Lançar</button>
                                            </form>
                                        )}
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-slate-800 flex items-center gap-2"><Banknote size={20} className="text-blue-600" /> Saldos</h3><button onClick={() => setShowTransferModal(true)} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"><ArrowRightLeft size={14} /> Transferir</button></div>
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">{displayAccounts.map(acc => (<div key={acc.id} className={`p-4 rounded-xl border ${acc.is_default ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300' : 'bg-gray-50 border-gray-200'}`}><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{acc.type === 'banco' ? 'Global' : `Cx. ${acc.region_id || 'Regional'}`}</p><p className="font-bold text-sm sm:text-lg text-slate-900 truncate" title={acc.name}>{acc.name}</p><p className={`text-sm sm:text-xl font-bold mt-1 ${Number(acc.balance) < 0 ? 'text-red-600' : 'text-slate-700'}`}>R$ {Number(acc.balance).toFixed(2)}</p></div>))}</div>
                                    </div>
                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                        <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col gap-4">
                                            <div className="flex w-full gap-2">
                                                <div className="flex-1 relative">
                                                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    <input type="text" placeholder="Buscar nas transações..." className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={finSearchTerm} onChange={e => setFinSearchTerm(e.target.value)} />
                                                </div>
                                                <button onClick={() => setShowFinFilters(!showFinFilters)} className={`p-2 rounded-xl border flex items-center justify-center transition-colors ${showFinFilters ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-slate-600 hover:bg-slate-50'}`}>
                                                    <Filter size={18} />
                                                </button>
                                            </div>
                                            {showFinFilters && (
                                                <div className="flex flex-wrap gap-2 w-full">
                                                    <select className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-slate-600 outline-none" value={finFilterType} onChange={e => setFinFilterType(e.target.value)}>
                                                        <option value="all">Todas as Movimentações</option>
                                                        <option value="in">Receitas (Entradas)</option>
                                                        <option value="out">Despesas (Saídas)</option>
                                                    </select>
                                                    <select className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-slate-600 outline-none" value={finFilterCategory} onChange={e => setFinFilterCategory(e.target.value)}>
                                                        <option value="all">Todas as Categorias</option>
                                                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                                    </select>
                                                    <select className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-slate-600 outline-none" value={finFilterAccount} onChange={e => setFinFilterAccount(e.target.value)}>
                                                        <option value="all">Todas as Contas</option>
                                                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                                    </select>
                                                    {selectedRegion === 'all' && (
                                                        <select className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-slate-600 outline-none" value={finFilterRegion} onChange={e => setFinFilterRegion(e.target.value)}>
                                                            <option value="all">Todas as Regionais</option>
                                                            {regions.map(r => <option key={r.slug} value={r.slug}>{r.name}</option>)}
                                                        </select>
                                                    )}
                                                        </div>
                                            )}
                                        </div>
                                        <div className="overflow-x-auto w-full">
                                            <table className="w-full text-sm text-left whitespace-nowrap hidden md:table">
                                                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-gray-100">
                                                    <tr>
                                                        <th className="p-4">Data</th>
                                                        <th className="p-4 w-48 max-w-xs">Descrição</th>
                                                        <th className="p-4 text-right">Valor</th>
                                                        <th className="p-4">Forma de Pagamento</th>
                                                        <th className="p-4 text-right">Valor Líquido</th>
                                                        <th className="p-4">Conta</th>
                                                        <th className="p-4">Cidade</th>
                                                        <th className="p-4 text-center">Ações</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {paginatedTransactions.map((t, i) => (
                                                        <tr key={`${t.id}-${t.is_primary ? '1' : '2'}-${i}`} className="hover:bg-slate-50 transition-colors">
                                                            <td className="p-4 text-slate-500">{new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</td>
                                                            <td className="p-4 font-bold text-slate-700 capitalize flex flex-col whitespace-normal break-words max-w-[200px]" title={t.label}>
                                                                {t.label.length > 30 ? t.label.substring(0, 30) + '...' : t.label}
                                                                {t.type === 'out' && t.expense_categories && <span className="text-[10px] text-slate-400 font-normal uppercase bg-slate-100 w-fit px-1 rounded mt-1">{t.expense_categories.name}</span>}
                                                            </td>
                                                            <td className={`p-4 text-right font-bold ${t.type === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                                {t.type === 'in' ? '+' : '-'} R$ {Number(t.val).toFixed(2)}
                                                            </td>
                                                            <td className="p-4 capitalize text-slate-600 font-medium">
                                                                {t.type === 'in' ? (t.payment_method || '-') : '-'}
                                                            </td>
                                                            <td className={`p-4 text-right font-bold ${t.type === 'in' ? 'text-blue-600' : 'text-red-600'}`}>
                                                                {t.type === 'in' ? '+' : '-'} R$ {Number(t.net_val ?? t.val).toFixed(2)}
                                                            </td>
                                                            <td className="p-4">
                                                                <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                                                    {t.account_name}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-slate-600">{t.city || '-'}</td>
                                                            <td className="p-4 text-center">
                                                                <div className="flex justify-center gap-2">
                                                                    <button onClick={() => openEditModal(t.type === 'in' ? 'appointment' : 'expense', t)} className="p-1.5 text-blue-400 hover:bg-blue-50 rounded"><Pencil size={16} /></button>
                                                                    {t.is_primary !== false && (
                                                                        <button onClick={() => handleDelete(t.type === 'in' ? 'appointments' : 'expenses', t.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {paginatedTransactions.length === 0 && (
                                                        <tr>
                                                            <td colSpan="8" className="p-8 text-center text-slate-500">Nenhuma movimentação encontrada para este filtro.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>

                                            {/* Mobile Cards para Financeiro */}
                                            <div className="md:hidden flex flex-col gap-4 mt-2 mb-2">
                                                {paginatedTransactions.length === 0 ? (
                                                    <div className="p-8 text-center text-slate-500 border border-slate-100 rounded-xl bg-slate-50">Nenhuma movimentação encontrada para este filtro.</div>
                                                ) : paginatedTransactions.map((t, i) => (
                                                    <div key={`mob-fin-${t.id}-${t.is_primary ? '1' : '2'}-${i}`} className="bg-white p-3 rounded-xl shadow-md border border-slate-200 flex flex-col gap-2">
                                                        <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                                                            <div className="pr-2">
                                                                <p className="font-bold text-slate-800 capitalize leading-tight">{t.label.length > 40 ? t.label.substring(0, 40) + '...' : t.label}</p>
                                                                <p className="text-[11px] text-slate-500 mt-1">{new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} • {t.city || '-'}</p>
                                                            </div>
                                                            <div className={`shrink-0 text-right font-bold text-lg ${t.type === 'in' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                                {t.type === 'in' ? '+' : '-'} R$ {Number(t.val).toFixed(2)}
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between items-center text-xs mt-1 gap-3">
                                                            <div className="flex-1 space-y-1 bg-slate-50 border border-slate-200 shadow-sm rounded-lg p-2">
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <div>
                                                                        <span className="text-[9px] uppercase text-slate-400 font-bold block">Conta</span>
                                                                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200 inline-block truncate max-w-full">{t.account_name}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-[9px] uppercase text-slate-400 font-bold block">Método / Categ</span>
                                                                        <span className="text-slate-600 capitalize break-words leading-tight block">{t.type === 'in' ? (t.payment_method || '-') : (t.expense_categories?.name || '-')}</span>
                                                                    </div>
                                                                </div>
                                                                {t.type === 'in' && (
                                                                    <div className="flex justify-between font-medium text-slate-600 border-t border-slate-200 pt-1 mt-1">
                                                                        <span className="capitalize text-[11px]">Valor Líquido</span>
                                                                        <span className="text-blue-600 font-bold">R$ {Number(t.net_val ?? t.val).toFixed(2)}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex shrink-0 gap-1 items-center">
                                                                <button onClick={() => openEditModal(t.type === 'in' ? 'appointment' : 'expense', t)} className="p-2 text-blue-500 bg-white hover:bg-blue-50 rounded-lg border border-slate-200 shadow-sm"><Pencil size={14}/></button>
                                                                {t.is_primary !== false && (
                                                                    <button onClick={() => handleDelete(t.type === 'in' ? 'appointments' : 'expenses', t.id)} className="p-2 text-red-500 bg-white hover:bg-red-50 rounded-lg border border-slate-200 shadow-sm"><Trash2 size={14}/></button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center p-4 border-t border-gray-100 bg-white">
                                            <select value={finItemsPerPage} onChange={(e) => { setFinItemsPerPage(Number(e.target.value)); setFinCurrentPage(1); }} className="p-2 border border-gray-200 rounded-lg text-sm text-slate-600 outline-none">
                                                <option value={10}>10 por página</option>
                                                <option value={50}>50 por página</option>
                                                <option value={100}>100 por página</option>
                                            </select>
                                            <div className="flex gap-2">
                                                <button onClick={() => setFinCurrentPage(p => Math.max(1, p - 1))} disabled={finCurrentPage === 1} className="px-3 py-1 bg-slate-100 text-slate-600 rounded disabled:opacity-50">Anterior</button>
                                                <span className="px-3 py-1 text-sm text-slate-600 font-medium">Página {finCurrentPage} de {Math.ceil(filteredTransactions.length / finItemsPerPage) || 1}</span>
                                                <button onClick={() => setFinCurrentPage(p => p + 1)} disabled={finCurrentPage >= Math.ceil(filteredTransactions.length / finItemsPerPage)} className="px-3 py-1 bg-slate-100 text-slate-600 rounded disabled:opacity-50">Próxima</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'equipe' && (
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2"><Users size={20} className="text-blue-600" /> Gestão de Equipe</h3>
                                        
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
                                                <button onClick={() => setEquipeViewType('mensal')} className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${equipeViewType === 'mensal' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Mensal</button>
                                                <button onClick={() => setEquipeViewType('semanal')} className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${equipeViewType === 'semanal' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Semanal</button>
                                            </div>
                                            
                                            {equipeViewType === 'semanal' && (
                                                <div className="flex items-center gap-3">
                                                    <button onClick={() => { const d = new Date(equipeCurrentWeekDate); d.setDate(d.getDate() - 7); setEquipeCurrentWeekDate(d); }} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-slate-600"><ChevronLeft size={18} /></button>
                                                    <span className="text-sm font-bold text-slate-700 whitespace-nowrap">Semana {(() => {
                                                        const current = new Date(equipeCurrentWeekDate);
                                                        const day = current.getDay();
                                                        const diff = current.getDate() - day + (day === 0 ? -6 : 1);
                                                        const startW = new Date(current.setDate(diff));
                                                        return startW.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                                                    })()}</span>
                                                    <button onClick={() => { const d = new Date(equipeCurrentWeekDate); d.setDate(d.getDate() + 7); setEquipeCurrentWeekDate(d); }} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-slate-600"><ChevronRight size={18} /></button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{commissionReport.map((rep, i) => (<div key={i} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 group relative"><button onClick={() => { const installer = installers.find(inst => inst.id === rep.id); if (installer) openEditModal('installer', installer); }} className="absolute top-4 right-4 text-slate-300 hover:text-blue-500"><Pencil size={16} /></button><p className="font-bold text-slate-800 text-lg">{rep.name}</p><p className="text-xs text-slate-500 font-medium mb-4">{rep.count} serviços • Regional {rep.region_id || 'N/A'}</p><div className="border-t border-slate-200 pt-4 flex justify-between items-center"><span className="text-slate-400 text-xs font-medium">A Pagar ({equipeViewType === 'semanal' ? 'Semana' : 'Mês'})</span><p className="text-2xl font-bold text-slate-900">R$ {rep.total.toFixed(2)}</p></div></div>))}</div>
                                </div>
                            )}

                            {activeTab === 'estoque' && (
                                <div className="space-y-6">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 gap-4">
                                        <div><h3 className="font-bold text-slate-700 flex items-center gap-2"><Package size={20} className="text-blue-600" /> Inventário {selectedRegion === 'all' ? 'Global' : selectedRegion}</h3></div>
                                        <div className="flex w-full md:w-auto gap-2">
                                            <select className="flex-1 md:w-auto p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none" value={invSortOrder} onChange={e => setInvSortOrder(e.target.value)}>
                                                <option value="qty_desc">Mais Quantidade</option>
                                                <option value="qty_asc">Menos Quantidade</option>
                                                <option value="alpha">Ordem Alfabética</option>
                                            </select>
                                            {selectedRegion !== 'all' && <button onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-500 whitespace-nowrap"><Plus size={18} /> Adicionar</button>}
                                        </div>
                                    </div>
                                    {showAddForm && (<form onSubmit={handleAddInventory} className="bg-slate-50 p-6 rounded-2xl grid grid-cols-4 gap-4 items-end border border-slate-200 animate-in slide-in-from-top-2"><div className="col-span-2"><label className="text-xs font-bold text-slate-500 mb-1 block">Item</label><input className="w-full p-3 border border-gray-200 rounded-xl" required value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} /></div><div><label className="text-xs font-bold text-slate-500 mb-1 block">Qtd Inicial</label><input className="w-full p-3 border border-gray-200 rounded-xl" type="number" required value={newItem.quantity} onChange={e => setNewItem({ ...newItem, quantity: e.target.value })} /></div><button className="bg-emerald-600 text-white p-3 rounded-xl font-bold hover:bg-emerald-500">Salvar</button></form>)}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {[...inventory].sort((a, b) => {
                                            if (invSortOrder === 'qty_desc') return b.quantity - a.quantity;
                                            if (invSortOrder === 'qty_asc') return a.quantity - b.quantity;
                                            return a.name.localeCompare(b.name);
                                        }).map(item => { const isReporEstoque = item.quantity <= item.min_threshold && item.min_threshold >= 0; const isNaoDisponivel = item.quantity <= 0 && item.min_threshold < 0; return (<div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center relative overflow-hidden group hover:border-blue-200 transition-colors">{isReporEstoque && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500"></div>}<div><h4 className="font-bold text-slate-800 text-lg group-hover:text-blue-700 transition-colors">{item.name}</h4><div className="mt-1 flex flex-wrap gap-2"><span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md ${(isReporEstoque || isNaoDisponivel) ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>{isReporEstoque ? 'Repor Estoque' : isNaoDisponivel ? 'Não Disponível' : 'Disponível'}</span>{selectedRegion === 'all' && <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md bg-blue-50 text-blue-600 border border-blue-100">{regions.find(r => r.slug === item.region_id)?.name || item.region_id || 'Matriz'}</span>}</div></div><div className="text-right">{isEditingInv === item.id ? (<div className="flex items-end gap-2"><div className="flex flex-col"><label className="text-[9px] text-slate-500 uppercase font-bold text-center mb-0.5">Atual</label><input className="w-14 p-1.5 border border-blue-200 bg-blue-50 rounded text-center font-bold text-blue-700 outline-none" type="number" value={editInvForm.quantity} onChange={e => setEditInvForm({ ...editInvForm, quantity: e.target.value })} /></div><div className="flex flex-col"><label className="text-[9px] text-slate-500 uppercase font-bold text-center mb-0.5">Mín</label><input className="w-14 p-1.5 border border-slate-200 bg-slate-50 rounded text-center font-bold text-slate-700 outline-none" type="number" value={editInvForm.min_threshold} onChange={e => setEditInvForm({ ...editInvForm, min_threshold: e.target.value })} /></div><button onClick={() => handleUpdateInventory(item.id)} className="bg-emerald-100 text-emerald-700 p-1.5 rounded hover:bg-emerald-200"><Save size={18} /></button></div>) : (<div className="flex flex-col items-end gap-1"><span className="text-4xl font-bold text-slate-900 tracking-tight">{item.quantity}</span><button onClick={() => { setIsEditingInv(item.id); setEditInvForm(item); }} className="text-xs text-blue-600 hover:text-blue-800 font-bold">Ajustar</button></div>)}</div></div>); })}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'configuracoes' && (
                                <div className="space-y-8">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                                <button onClick={() => setShowAccountsSettings(!showAccountsSettings)} className="w-full p-6 flex justify-between items-center bg-white hover:bg-slate-50 transition-colors">
                                                    <h4 className="font-bold text-slate-800 flex items-center gap-2"><Banknote size={18} className="text-blue-600" /> Contas & Caixas</h4>
                                                    <ChevronDown size={20} className={`text-slate-400 transition-transform ${showAccountsSettings ? 'rotate-180' : ''}`} />
                                                </button>
                                                {showAccountsSettings && (
                                                    <div className="p-6 pt-0 border-t border-gray-100">
                                                        <div className="space-y-3 mb-6">{accounts.map(acc => (<div key={acc.id} className={`flex justify-between items-center p-3 rounded-xl border transition-all ${acc.is_default ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-300'}`}><div className="flex items-center gap-3">{acc.type === 'banco' && (<button onClick={() => handleSetDefault(acc.id)} className={`p-1.5 rounded-full transition-colors ${acc.is_default ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-400 hover:text-yellow-500'}`}><Star size={16} fill={acc.is_default ? "currentColor" : "none"} /></button>)}{acc.type === 'carteira' && <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600"><Wallet size={14} /></div>}<div><p className={`font-bold text-sm ${acc.is_default ? 'text-blue-800' : 'text-slate-700'}`}>{acc.name} {acc.is_default && <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded ml-1 font-bold">PADRÃO</span>}</p><p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{acc.region_id ? `Regional ${acc.region_id}` : 'Global'}</p></div></div><div className="flex items-center"><button onClick={() => openEditModal('account', acc)} className="text-slate-300 hover:text-blue-500 p-2 transition-colors mr-1"><Pencil size={16} /></button><button onClick={() => handleDelete('accounts', acc.id)} className="text-slate-300 hover:text-red-500 p-2 transition-colors"><Trash2 size={16} /></button></div></div>))}</div>
                                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                            <h5 className="font-bold text-slate-700 text-xs uppercase tracking-wide mb-3">Nova Conta</h5>
                                                            <form onSubmit={handleAddAccount} className="space-y-3"><div><label className="text-xs font-bold text-slate-500 mb-1 block">Nome da Instituição</label><input className="w-full p-2.5 bg-white border border-gray-200 rounded-lg focus:border-blue-500 outline-none text-sm" required value={newAccount.name} onChange={e => setNewAccount({ ...newAccount, name: e.target.value })} placeholder="Ex: Nubank / Caixa Físico" /></div><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><div><label className="text-xs font-bold text-slate-500 mb-1 block">Tipo de Conta</label><select className="w-full p-2.5 bg-white border border-gray-200 rounded-lg focus:border-blue-500 outline-none text-sm" value={newAccount.type} onChange={e => setNewAccount({ ...newAccount, type: e.target.value })}><option value="banco">Banco (Cartão/PIX)</option><option value="carteira">Caixa Físico</option></select></div><div><label className="text-xs font-bold text-slate-500 mb-1 block">Região</label><select className="w-full p-2.5 bg-white border border-gray-200 rounded-lg focus:border-blue-500 outline-none text-sm" value={newAccount.region_id || 'matriz'} onChange={e => setNewAccount({ ...newAccount, region_id: e.target.value })}><option value="matriz">Global / Matriz</option>{regions.filter(r => r.slug !== 'matriz').map(r => <option key={r.slug} value={r.slug}>{r.name}</option>)}</select></div><div><label className="text-xs font-bold text-slate-500 mb-1 block">Saldo Inicial</label><input type="number" step="0.01" className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm" value={newAccount.initial_balance} onChange={e => setNewAccount({ ...newAccount, initial_balance: e.target.value })} placeholder="Saldo Inicial..." /></div></div><button className="w-full bg-slate-800 text-white font-bold py-2.5 rounded-lg text-sm hover:bg-slate-700 transition-colors">Criar Conta</button></form>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-6">
                                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                                <button onClick={() => setShowRatesSettings(!showRatesSettings)} className="w-full p-6 flex justify-between items-center bg-white hover:bg-slate-50 transition-colors">
                                                    <h4 className="font-bold text-slate-800 flex items-center gap-2"><Settings size={18} className="text-slate-400" /> Taxas da Maquininha</h4>
                                                    <ChevronDown size={20} className={`text-slate-400 transition-transform ${showRatesSettings ? 'rotate-180' : ''}`} />
                                                </button>
                                                {showRatesSettings && (() => {
                                                    const filteredRatesSetting = rates.filter(r => {
                                                        if (ratesRegion === 'global') return !r.region_id;
                                                        return r.region_id === ratesRegion;
                                                    });
                                                    return (
                                                        <div className="p-6 pt-0 border-t border-gray-100 space-y-4">
                                                            <div className="flex items-center justify-between gap-4 mt-4">
                                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filtrar por Regional:</label>
                                                                <select className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none" value={ratesRegion} onChange={e => setRatesRegion(e.target.value)}>
                                                                    <option value="global">Taxas Gerais (Padrão)</option>
                                                                    {regions.filter(r => r.slug !== 'matriz').map(r => <option key={r.slug} value={r.slug}>{r.name}</option>)}
                                                                </select>
                                                            </div>
                                                            {filteredRatesSetting.length === 0 ? (
                                                                <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                                                                    <p className="text-sm text-slate-500 mb-4">Esta regional não possui taxas de maquininha configuradas. Deseja copiar as taxas padrão global?</p>
                                                                    <button onClick={handleInitializeRates} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors">
                                                                        Copiar Taxas Padrão
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="overflow-hidden rounded-xl border border-gray-100"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 font-medium"><tr><th className="p-3 text-left">Parcelamento</th><th className="p-3 text-right">Taxa (%)</th></tr></thead><tbody className="divide-y divide-gray-100">{filteredRatesSetting.map(rate => (<tr key={rate.id} className="hover:bg-slate-50 transition-colors"><td className="p-3 font-medium text-slate-700 capitalize">{rate.method} {rate.installments > 1 && `${rate.installments}x`}</td><td className="p-3 text-right">{editingRate?.id === rate.id ? (<div className="flex justify-end gap-2"><input className="w-16 p-1 border border-blue-300 rounded text-center font-bold text-blue-600 outline-none" type="number" step="0.01" autoFocus value={editingRate.rate_percent} onChange={e => setEditingRate({ ...editingRate, rate_percent: e.target.value })} /><button onClick={() => handleUpdateRate(editingRate)} className="text-emerald-600 font-bold hover:text-emerald-700 text-xs">OK</button></div>) : (<button onClick={() => setEditingRate(rate)} className="text-slate-500 hover:text-blue-600 font-bold transition-colors border-b border-dashed border-slate-300 hover:border-blue-400">{rate.rate_percent}%</button>)}</td></tr>))}</tbody></table></div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                                <button onClick={() => setShowCategoriesSettings(!showCategoriesSettings)} className="w-full p-6 flex justify-between items-center bg-white hover:bg-slate-50 transition-colors">
                                                    <h4 className="font-bold text-slate-800 flex items-center gap-2"><PieIcon size={18} className="text-purple-500" /> Categorias de Despesa</h4>
                                                    <ChevronDown size={20} className={`text-slate-400 transition-transform ${showCategoriesSettings ? 'rotate-180' : ''}`} />
                                                </button>
                                                {showCategoriesSettings && (
                                                    <div className="p-6 pt-0 border-t border-gray-100">
                                                        <div className="flex gap-2 mb-4"><input className="flex-1 p-2 border rounded-lg text-sm bg-slate-50" placeholder="Nova Categoria..." value={newCategory} onChange={e => setNewCategory(e.target.value)} /><button onClick={handleAddCategory} className="bg-blue-600 text-white px-4 rounded-lg font-bold text-sm">Add</button></div><div className="flex flex-wrap gap-2">{categories.map(c => <span key={c.id} className="bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2">{c.name} <button onClick={() => handleDelete('expense_categories', c.id)} className="text-slate-400 hover:text-red-500 bg-white p-0.5 rounded shadow-sm"><X size={12} /></button></span>)}</div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                                <button onClick={() => setShowGoalsSettings(!showGoalsSettings)} className="w-full p-6 flex justify-between items-center bg-white hover:bg-slate-50 transition-colors">
                                                    <h4 className="font-bold text-slate-800 flex items-center gap-2"><Trophy size={18} className="text-yellow-500" /> Metas Mensais</h4>
                                                    <ChevronDown size={20} className={`text-slate-400 transition-transform ${showGoalsSettings ? 'rotate-180' : ''}`} />
                                                </button>
                                                {showGoalsSettings && (
                                                    <div className="p-6 pt-0 border-t border-gray-100 space-y-4">
                                                        <div className="flex items-center justify-between gap-4 mt-4">
                                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mês das Metas:</label>
                                                            <input 
                                                                type="month" 
                                                                className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none cursor-pointer font-bold" 
                                                                value={goalsMonth} 
                                                                onChange={e => setGoalsMonth(e.target.value)} 
                                                            />
                                                        </div>
                                                        <form onSubmit={handleSaveGoals} className="space-y-4 pt-2">
                                                            {regions.filter(r => r.slug !== 'matriz').map(r => (
                                                                <div key={r.slug} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                                    <span className="text-sm font-bold text-slate-700">{r.name}</span>
                                                                    <div className="flex items-center gap-2">
                                                                        <input 
                                                                            type="number" 
                                                                            className="w-24 p-2 bg-white border border-gray-200 rounded-lg text-sm text-right font-bold text-slate-700 outline-none focus:border-blue-500" 
                                                                            min="0"
                                                                            value={editingGoals[r.slug] ?? '0'} 
                                                                            onChange={e => setEditingGoals({ ...editingGoals, [r.slug]: e.target.value })} 
                                                                            placeholder="0"
                                                                        />
                                                                        <span className="text-xs font-medium text-slate-400">volantes</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            <button type="submit" className="w-full bg-slate-800 text-white font-bold py-2.5 rounded-lg text-sm hover:bg-slate-700 transition-colors">
                                                                Salvar Metas
                                                            </button>
                                                        </form>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div >

            {/* COMPONENTES EXTRAS (Modais e Navegação) */}
            < BottomNav />

            {showEditModal && editingItem && (<div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"><div className={`bg-white rounded-2xl w-full ${modalType === 'appointment' ? 'max-w-xl' : 'max-w-md'} p-6 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto`}><h3 className="text-xl font-bold mb-4 text-slate-900 flex items-center gap-2"><Pencil size={20} /> Editar Item</h3><div className="space-y-4">{modalType === 'appointment' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <h4 className="font-bold text-slate-600 text-[10px] tracking-wider uppercase border-b border-gray-100 pb-1 mb-2">Serviço</h4>
                        {editingItem.status === 'concluido' && (
                            <div><label className="text-[10px] font-bold uppercase text-slate-500">Data Conclusão</label><input type="datetime-local" className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg text-sm text-slate-800" value={editingItem.completed_at && !isNaN(new Date(editingItem.completed_at).getTime()) ? new Date(new Date(editingItem.completed_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} onChange={e => setEditingItem({ ...editingItem, completed_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
                        )}
                        <div><label className="text-[10px] font-bold uppercase text-slate-500">Veículo</label><input className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg text-sm text-slate-800" value={editingItem.vehicle_model || ''} onChange={e => setEditingItem({ ...editingItem, vehicle_model: e.target.value })} /></div>
                        <div><label className="text-[10px] font-bold uppercase text-slate-500">Cliente</label><input className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg text-sm text-slate-800" value={editingItem.customer_name || ''} onChange={e => setEditingItem({ ...editingItem, customer_name: e.target.value })} /></div>
                        <div>
                            <label className="text-[10px] font-bold uppercase text-slate-500">Revestimento Utilizado</label>
                            <select className="w-full p-2 border border-slate-200 bg-slate-50 rounded-lg text-sm text-slate-800" value={editingItem.material_used_id || ''} onChange={e => setEditingItem({ ...editingItem, material_used_id: e.target.value })}>
                                <option value="">Nenhum/Avulso</option>
                                {inventory.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <h4 className="font-bold text-slate-600 text-[10px] tracking-wider uppercase border-b border-gray-100 pb-1 mb-2 flex items-center justify-between">
                            Pagamento
                            <label className="flex items-center gap-1.5 cursor-pointer lowercase text-[10px] text-blue-600 font-bold bg-blue-50 px-2 rounded-full py-0.5">
                                Dividir?
                                <input type="checkbox" checked={editingItem.is_split_payment || false} onChange={e => setEditingItem({ ...editingItem, is_split_payment: e.target.checked })} className="w-3 h-3 cursor-pointer" />
                            </label>
                        </h4>

                        <div className="space-y-2 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                            <div className="flex gap-2">
                                <div className="flex-1"><label className="text-[10px] font-bold uppercase text-slate-500">Valor 1</label><input type="number" step="0.01" className="w-full p-2 border border-slate-200 rounded-lg text-sm font-bold text-emerald-700" value={editingItem.gross_amount || ''} onChange={e => setEditingItem({ ...editingItem, gross_amount: e.target.value })} /></div>
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold uppercase text-slate-500">Método 1</label>
                                    <select className="w-full p-2 border border-slate-200 rounded-lg text-sm" value={editingItem.payment_method || ''} onChange={e => setEditingItem({ ...editingItem, payment_method: e.target.value })}>
                                        <option value="">...</option><option value="dinheiro">Dinheiro</option><option value="pix">PIX</option><option value="debito">Débito</option><option value="credito">Crédito</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase text-slate-500">Conta 1</label>
                                <select className="w-full p-2 border border-slate-200 rounded-lg text-sm text-slate-700" value={editingItem._new_account_id || editingItem.account_id || ''} onChange={e => setEditingItem({ ...editingItem, _new_account_id: e.target.value })}>
                                    <option value="">Selecione...</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {editingItem.is_split_payment && (
                            <div className="space-y-2 bg-blue-50/50 p-2 rounded-xl border border-blue-100 mt-2 animate-in fade-in slide-in-from-top-2">
                                <div className="flex gap-2">
                                    <div className="flex-1"><label className="text-[10px] font-bold uppercase text-blue-600">Valor 2</label><input type="number" step="0.01" className="w-full p-2 border border-blue-200 rounded-lg text-sm font-bold text-emerald-700 bg-white" value={editingItem.gross_amount_2 || ''} onChange={e => setEditingItem({ ...editingItem, gross_amount_2: e.target.value })} /></div>
                                    <div className="flex-1">
                                        <label className="text-[10px] font-bold uppercase text-blue-600">Método 2</label>
                                        <select className="w-full p-2 border border-blue-200 rounded-lg text-sm bg-white" value={editingItem.payment_method_2 || ''} onChange={e => setEditingItem({ ...editingItem, payment_method_2: e.target.value })}>
                                            <option value="">...</option><option value="dinheiro">Dinheiro</option><option value="pix">PIX</option><option value="debito">Débito</option><option value="credito">Crédito</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-blue-600">Conta 2</label>
                                    <select className="w-full p-2 border border-blue-200 rounded-lg text-sm text-slate-700 bg-white" value={editingItem._new_account_id_2 || editingItem.account_id_2 || ''} onChange={e => setEditingItem({ ...editingItem, _new_account_id_2: e.target.value })}>
                                        <option value="">Selecione...</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}
                        <p className="text-[10px] text-slate-500 bg-slate-100 p-2 rounded-lg leading-tight mt-2 border border-slate-200">Valores líquidos recalculam sozinhos. Alterar revestimento <strong className="text-emerald-600">agora atualiza o estoque</strong> automaticamente.</p>
                    </div>
                </div>
            )}{modalType === 'expense' && (<><div><label className="text-xs font-bold text-slate-500">Descrição</label><input className="w-full p-3 border rounded-xl" value={editingItem.description} onChange={e => setEditingItem({ ...editingItem, description: e.target.value })} /></div><div><label className="text-xs font-bold text-slate-500">Data</label><input type="date" className="w-full p-3 border rounded-xl" value={editingItem.date ? editingItem.date.slice(0, 10) : ''} onChange={e => setEditingItem({ ...editingItem, date: e.target.value + 'T12:00:00Z' })} /></div><div><label className="text-xs font-bold text-slate-500">Valor (R$)</label><input type="number" className="w-full p-3 border rounded-xl" value={editingItem.amount} onChange={e => setEditingItem({ ...editingItem, amount: e.target.value })} /></div><div><label className="text-xs font-bold text-slate-500">Conta Origem</label><select className="w-full p-3 border rounded-xl" value={editingItem.account_id} onChange={e => setEditingItem({ ...editingItem, account_id: e.target.value })}><option value="">Selecione...</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div></>)}{modalType === 'installer' && (<><div><label className="text-xs font-bold text-slate-500">Nome Completo</label><input className="w-full p-3 border rounded-xl" value={editingItem.full_name || ''} onChange={e => setEditingItem({ ...editingItem, full_name: e.target.value })} /></div><div><label className="text-xs font-bold text-slate-500">Comissão Padrão (R$)</label><input type="number" className="w-full p-3 border rounded-xl" value={editingItem.commission_rate} onChange={e => setEditingItem({ ...editingItem, commission_rate: e.target.value })} /></div></>)}{modalType === 'account' && (<><div><label className="text-xs font-bold text-slate-500">Nome da Conta</label><input className="w-full p-3 border rounded-xl" value={editingItem.name || ''} onChange={e => setEditingItem({ ...editingItem, name: e.target.value })} /></div><div><label className="text-xs font-bold text-slate-500">Tipo de Conta</label><select className="w-full p-3 border rounded-xl" value={editingItem.type || 'banco'} onChange={e => setEditingItem({ ...editingItem, type: e.target.value })}><option value="banco">Banco (Cartão/PIX)</option><option value="carteira">Caixa Físico</option></select></div><div><label className="text-xs font-bold text-slate-500">Região</label><select className="w-full p-3 border rounded-xl" value={editingItem.region_id || 'matriz'} onChange={e => setEditingItem({ ...editingItem, region_id: e.target.value })}><option value="matriz">Global / Matriz</option>{regions.filter(r => r.slug !== 'matriz').map(r => <option key={r.slug} value={r.slug}>{r.name}</option>)}</select></div><div><label className="text-xs font-bold text-slate-500">Saldo Inicial</label><input type="number" step="0.01" className="w-full p-3 border rounded-xl" value={editingItem.initial_balance || 0} onChange={e => setEditingItem({ ...editingItem, initial_balance: e.target.value })} /></div></>)}</div><div className="flex gap-3 mt-6"><button onClick={() => setShowEditModal(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Cancelar</button><button onClick={(e) => { e.currentTarget.disabled = true; e.currentTarget.innerText = 'Salvando...'; handleSaveEdit(); }} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 disabled:opacity-50">Salvar Alterações</button></div></div></div>)
            }
            {showTransferModal && (<div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"><div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95"><h3 className="text-lg font-bold mb-4 text-slate-900 flex items-center gap-2"><ArrowRightLeft size={20} /> Transferência</h3><form onSubmit={handleTransfer} className="space-y-4"><div><label className="text-xs font-bold text-slate-500">De (Origem)</label><select className="w-full p-3 border rounded-xl" required onChange={e => setTransferData({ ...transferData, from: e.target.value })}><option value="">Selecione...</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name} (R$ {Number(a.balance).toFixed(2)})</option>)}</select></div><div><label className="text-xs font-bold text-slate-500">Para (Destino)</label><select className="w-full p-3 border rounded-xl" required onChange={e => setTransferData({ ...transferData, to: e.target.value })}><option value="">Selecione...</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div><div><label className="text-xs font-bold text-slate-500">Valor (R$)</label><input type="number" step="0.01" className="w-full p-3 border rounded-xl" required onChange={e => setTransferData({ ...transferData, amount: e.target.value })} /></div><button className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-500 mt-2">Confirmar</button><button type="button" onClick={() => setShowTransferModal(false)} className="w-full py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancelar</button></form></div></div>)}
            {selectedTransaction && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                            <h3 className="font-bold text-lg flex items-center gap-2"><Eye size={18} className="text-blue-400" /> Detalhes do Atendimento</h3>
                            <button onClick={() => setSelectedTransaction(null)} className="p-2 hover:bg-slate-700 rounded-full transition-colors"><X size={20} /></button>
                        </div>
                        <div className="overflow-y-auto p-5">
                            <div className="flex flex-col md:flex-row gap-5">
                                <div className="w-full md:w-1/2 flex flex-col gap-3">
                                    {selectedTransaction.photo_url ? (
                                        <>
                                            <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shadow-sm h-full flex items-center justify-center">
                                                <img src={selectedTransaction.photo_url} alt="Comprovante" className="w-full h-auto object-cover max-h-80" />
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => window.open(selectedTransaction.photo_url, '_blank')} className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg font-bold text-xs hover:bg-slate-200 flex items-center justify-center gap-1">
                                                    <Maximize size={14} /> Ampliar
                                                </button>
                                                <button onClick={async () => {
                                                    try {
                                                        const response = await fetch(selectedTransaction.photo_url);
                                                        const blob = await response.blob();
                                                        const url = window.URL.createObjectURL(blob);
                                                        const a = document.createElement('a');
                                                        a.href = url;
                                                        a.download = `foto-volante-${selectedTransaction.id}.jpg`;
                                                        document.body.appendChild(a);
                                                        a.click();
                                                        a.remove();
                                                        window.URL.revokeObjectURL(url);
                                                    } catch(e) {
                                                        window.open(selectedTransaction.photo_url, '_blank');
                                                    }
                                                }} className="flex-1 bg-blue-50 text-blue-700 py-2 rounded-lg font-bold text-xs hover:bg-blue-100 flex items-center justify-center gap-1">
                                                    <Download size={14} /> Baixar
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="h-full min-h-[160px] bg-slate-50 rounded-xl flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-300">
                                            <Eye size={28} className="mb-2 opacity-50" />
                                            <span className="text-xs font-medium">Sem foto</span>
                                        </div>
                                    )}
                                </div>
                                <div className="w-full md:w-1/2 space-y-4">
                                    <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Veículo / Cliente</p>
                                            <p className="font-bold text-lg text-slate-900 leading-tight">{selectedTransaction.vehicle_model}</p>
                                            <p className="text-xs text-slate-500 font-medium">{selectedTransaction.customer_name}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Valor Bruto</p>
                                            <p className="font-bold text-lg text-emerald-600">R$ {Number((selectedTransaction.gross_amount || selectedTransaction.amount || 0) + (selectedTransaction.is_split_payment ? (selectedTransaction.gross_amount_2 || 0) : 0)).toFixed(2)}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">Cidade</p>
                                            <p className="font-semibold text-slate-700 text-sm truncate">{selectedTransaction.calendar_name || '-'}</p>
                                        </div>
                                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">Revestimento</p>
                                            <p className="font-semibold text-slate-700 text-sm truncate">{inventory.find(i => i.id === selectedTransaction.material_used_id)?.name || '-'}</p>
                                        </div>
                                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 col-span-2">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">Pagamento</p>
                                            <p className="font-semibold text-slate-700 text-sm capitalize">
                                                {selectedTransaction.is_split_payment 
                                                    ? `${selectedTransaction.payment_method} (R$ ${Number(selectedTransaction.gross_amount).toFixed(2)} em ${selectedTransaction.installments || 1}x) + ${selectedTransaction.payment_method_2} (R$ ${Number(selectedTransaction.gross_amount_2).toFixed(2)} em ${selectedTransaction.installments_2 || 1}x)` 
                                                    : `${selectedTransaction.payment_method} (${selectedTransaction.installments || 1}x)`}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        {selectedTransaction.net_amount && (
                                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex flex-col justify-center col-span-2">
                                                <p className="text-[9px] font-bold text-blue-500 uppercase">Líquido (Empresa)</p>
                                                <p className="font-bold text-blue-700 text-base">R$ {Number(selectedTransaction.net_amount).toFixed(2)}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                            <p className="text-[10px] text-slate-400 font-medium">Pressione <kbd className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600">ESC</kbd> para fechar ou <kbd className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600">Setas</kbd> para navegar</p>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}