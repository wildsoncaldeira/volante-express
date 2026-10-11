import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      expense_id,
      description,
      amount,
      category,
      account_name,
      installer_name
    } = body;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    // Permite configurar um chat específico para despesas ou usar o chat padrão
    const chatId = process.env.TELEGRAM_EXPENSE_CHAT_ID || process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.warn('Telegram token ou chat ID não configurados.');
      return NextResponse.json({ skipped: true, reason: 'Configurações de Telegram ausentes' }, { status: 200 });
    }

    const formattedAmount = Number(amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const message = 
      `🚨 <b>NOVA SOLICITAÇÃO DE SAÍDA DO CAIXA!</b>\n\n` +
      `👷 <b>Solicitante:</b> ${installer_name || 'Instalador'}\n` +
      `📍 <b>Caixa:</b> ${account_name || 'Regional'}\n` +
      `🏷️ <b>Categoria:</b> ${category || 'Operacional'}\n` +
      `📝 <b>Descrição:</b> ${description || 'Sem descrição'}\n` +
      `💰 <b>Valor Solicitado:</b> <b>${formattedAmount}</b>\n\n` +
      `⏰ <b>Data/Hora:</b> ${now}\n\n` +
      `<i>Clique abaixo para aprovar ou recusar esta saída diretamente pelo Telegram:</i>`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '✅ Aprovar Saída', callback_data: `approve_expense:${expense_id}` },
          { text: '❌ Recusar', callback_data: `reject_expense:${expense_id}` }
        ]
      ]
    };

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard
      })
    });

    const data = await res.json();
    if (!data.ok) {
      console.error('Telegram error:', data);
      return NextResponse.json({ error: data.description }, { status: 400 });
    }

    return NextResponse.json({ success: true, messageId: data.result.message_id });
  } catch (error) {
    console.error('Erro ao enviar notificação de despesa:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
