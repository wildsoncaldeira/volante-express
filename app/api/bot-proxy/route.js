import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        const body = await req.json();
        const res = await fetch('https://bot.volanteexpress.com.br/api/bot/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
