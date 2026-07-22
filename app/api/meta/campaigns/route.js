export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { identifyCityFromAdSet } from '../../../utils/meta';

export async function GET(request) {
    try {
        const META_TOKEN = process.env.META_ACCESS_TOKEN;
        const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;

        if (!META_TOKEN || !AD_ACCOUNT_ID) {
            return NextResponse.json({
                error: 'Credenciais ausentes',
                mockData: true,
                data: [
                    {
                        id: 'mock_camp_1',
                        name: 'Campanha Volante Express - Conversas',
                        status: 'ACTIVE',
                        daily_budget: 150.00,
                        adsets: [
                            { id: 'mock_adset_1', name: 'Divinopolis Depoimentos', status: 'ACTIVE', daily_budget: 50.00 },
                            { id: 'mock_adset_2', name: 'Samonte Timelapse', status: 'PAUSED', daily_budget: 30.00 }
                        ]
                    }
                ]
            });
        }

        // Busca Campanhas (apenas ativas ou pausadas) e aumenta limite para 200 (padrão é 25)
        const campUrl = `https://graph.facebook.com/v19.0/${AD_ACCOUNT_ID}/campaigns?effective_status=['ACTIVE','PAUSED']&limit=200&fields=id,name,status,daily_budget,adsets.limit(200){id,name,status,daily_budget}&access_token=${META_TOKEN}`;
        const res = await fetch(campUrl, { cache: 'no-store' });
        const json = await res.json();

        if (json.error) {
            return NextResponse.json({ error: json.error.message }, { status: 400 });
        }

        // Formata os dados
        const campaigns = (json.data || []).map(camp => ({
            id: camp.id,
            name: camp.name,
            status: camp.status,
            daily_budget: camp.daily_budget ? (Number(camp.daily_budget) / 100) : 0, // Meta retorna em centavos
            adsets: (camp.adsets?.data || []).map(adset => ({
                id: adset.id,
                name: adset.name,
                status: adset.status,
                daily_budget: adset.daily_budget ? (Number(adset.daily_budget) / 100) : 0,
                city: identifyCityFromAdSet(adset.name)
            }))
        }));

        return NextResponse.json({ data: campaigns });

    } catch (err) {
        console.error('Erro ao buscar campanhas Meta:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
