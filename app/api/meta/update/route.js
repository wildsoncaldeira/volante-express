import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const body = await request.json();
        const { objectId, action, value } = body; 
        // objectId pode ser ID da campanha ou do adset
        // action: 'status' ou 'budget'
        // value: 'ACTIVE'/'PAUSED' para status, ou number (ex: 50.00) para budget

        if (!objectId || !action || value === undefined) {
            return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
        }

        const META_TOKEN = process.env.META_ACCESS_TOKEN;
        if (!META_TOKEN) {
            return NextResponse.json({ message: 'Modo simulação: Ação não executada pois não há token.' });
        }

        let updatePayload = {};

        if (action === 'status') {
            updatePayload.status = value;
        } else if (action === 'budget') {
            // Meta espera o valor em centavos (ex: 50 reais = 5000)
            updatePayload.daily_budget = Math.round(Number(value) * 100);
        }

        const url = `https://graph.facebook.com/v19.0/${objectId}`;
        
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                access_token: META_TOKEN,
                ...updatePayload
            })
        });

        const json = await res.json();

        if (json.error) {
            return NextResponse.json({ error: json.error.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, data: json });

    } catch (err) {
        console.error('Erro Update Meta:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
