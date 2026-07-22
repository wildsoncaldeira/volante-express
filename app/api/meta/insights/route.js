export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

import { identifyCityFromAdSet } from '../../../utils/meta';

function getDateRanges(rangeStr, customStart, customEnd) {
    const today = new Date();
    // Ajuste fuso (Brasil)
    today.setHours(today.getHours() - 3);

    let start = new Date(today);
    let end = new Date(today);
    
    end.setUTCHours(23, 59, 59, 999);
    start.setUTCHours(0, 0, 0, 0);

    if (rangeStr === 'yesterday_and_today') {
        start.setDate(start.getDate() - 1);
    } else if (rangeStr === 'yesterday') {
        start.setDate(start.getDate() - 1);
        end = new Date(start);
        end.setUTCHours(23, 59, 59, 999);
    } else if (rangeStr === 'last_7d') {
        start.setDate(start.getDate() - 7);
    } else if (rangeStr === 'last_30d') {
        start.setDate(start.getDate() - 30);
    } else if (rangeStr === 'this_month') {
        start.setDate(1);
    } else if (rangeStr === 'last_month') {
        start.setMonth(start.getMonth() - 1);
        start.setDate(1);
        end = new Date(start);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
        end.setUTCHours(23, 59, 59, 999);
    } else if (rangeStr === 'custom' && customStart && customEnd) {
        start = new Date(customStart + 'T00:00:00-03:00');
        end = new Date(customEnd + 'T23:59:59-03:00');
    }

    return { 
        start: start.toISOString(), 
        end: end.toISOString(),
        // Para API do Meta Ads o formato é YYYY-MM-DD
        metaStart: start.toISOString().split('T')[0],
        metaEnd: end.toISOString().split('T')[0]
    };
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const rangeStr = searchParams.get('range') || 'today';
        const customStart = searchParams.get('start');
        const customEnd = searchParams.get('end');
        const dates = getDateRanges(rangeStr, customStart, customEnd);

        const META_TOKEN = process.env.META_ACCESS_TOKEN;
        const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;

        // Se ainda não tiver as chaves, retorna mock para desenvolvimento visual
        if (!META_TOKEN || !AD_ACCOUNT_ID) {
            console.warn('⚠️ Credenciais do Meta ausentes. Retornando dados fictícios.');
            return NextResponse.json({
                error: 'Credenciais ausentes',
                mockData: true,
                data: [
                    { city: 'Sete Lagoas', spend: 350.50, leads: 15, clients: 3, cpa: 23.36, cac: 116.83 },
                    { city: 'Divinópolis', spend: 520.10, leads: 22, clients: 5, cpa: 23.64, cac: 104.02 },
                    { city: 'Santo Antônio do Monte', spend: 110.00, leads: 8, clients: 2, cpa: 13.75, cac: 55.00 },
                    { city: 'Paraopeba / Caetanópolis', spend: 85.00, leads: 4, clients: 1, cpa: 21.25, cac: 85.00 }
                ]
            });
        }

        // 1. Busca Insights no Meta Ads por Ad Set (aumentando limite para 500)
        const metaUrl = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/insights?limit=500&level=adset&fields=adset_id,adset_name,spend,impressions,clicks,actions,cost_per_action_type&time_range={'since':'${dates.metaStart}','until':'${dates.metaEnd}'}&access_token=${META_TOKEN}`;
        
        const metaRes = await fetch(metaUrl, { cache: 'no-store' });
        const metaJson = await metaRes.json();

        if (metaJson.error) {
            console.error('Erro Meta API:', metaJson.error);
            return NextResponse.json({ error: metaJson.error.message }, { status: 400 });
        }

        const adSetsData = metaJson.data || [];

        // 2. Busca Atendimentos (Supabase) no período
        const { data: appointments } = await supabase
            .from('appointments')
            .select('id, calendar_name, status, created_at')
            .gte('created_at', dates.start)
            .lte('created_at', dates.end);

        const apps = appointments || [];

        // 3. Cruzamento e Agrupamento (Ad Set -> Cidade -> Custos)
        const cityStats = {};

        // 3.1 Adiciona gastos do Meta
        adSetsData.forEach(adSet => {
            const city = identifyCityFromAdSet(adSet.adset_name);
            if (!cityStats[city]) {
                cityStats[city] = { city, spend: 0, leads: 0, clients: 0 };
            }
            cityStats[city].spend += parseFloat(adSet.spend || 0);
        });

        // 3.2 Adiciona contagem do Supabase (Leads e Clientes)
        apps.forEach(app => {
            // Busca a cidade usando a inteligência também no calendar_name (caso venha zoado),
            // ou assume que o calendar_name do banco já é o nome canônico mapeado
            const dbCityName = app.calendar_name || 'Desconhecida';
            
            // Para garantir o match exato, procuramos o alias reverso se necessário,
            // mas como já mapeamos o dbName oficial, comparamos direto ou passamos pela IA de alias.
            const city = identifyCityFromAdSet(dbCityName) !== 'Desconhecida' 
                ? identifyCityFromAdSet(dbCityName) 
                : dbCityName;

            if (!cityStats[city]) {
                cityStats[city] = { city, spend: 0, leads: 0, clients: 0 };
            }

            // Lead: Qualquer agendamento que entrou
            cityStats[city].leads += 1;
            
            // Cliente: Apenas os que o status for 'concluido'
            if (app.status === 'concluido') {
                cityStats[city].clients += 1;
            }
        });

        // 4. Formata resposta final e calcula CPA / CAC
        const finalData = Object.values(cityStats).map(stat => {
            return {
                ...stat,
                cpa: stat.leads > 0 ? Number((stat.spend / stat.leads).toFixed(2)) : 0,
                cac: stat.clients > 0 ? Number((stat.spend / stat.clients).toFixed(2)) : 0
            };
        });

        return NextResponse.json({ data: finalData, rawAdSets: adSetsData });

    } catch (err) {
        console.error('Erro na API Meta:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
