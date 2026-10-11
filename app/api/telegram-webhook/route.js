import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function answerCallback(botToken, callbackQueryId, text, showAlert = false) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert
      })
    });
  } catch (e) {
    console.error('Erro ao responder callback query:', e);
  }
}

async function editMessage(botToken, chatId, messageId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [] } // Remove os botões para evitar clique duplo
      })
    });
  } catch (e) {
    console.error('Erro ao editar mensagem no Telegram:', e);
  }
}

export async function POST(request) {
  try {
    const update = await request.json();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!update.callback_query) {
      return NextResponse.json({ ok: true });
    }

    const { id: callbackQueryId, data, message, from } = update.callback_query;
    if (!data) return NextResponse.json({ ok: true });

    const [action, expenseId] = data.split(':');
    const approverName = from.first_name ? `${from.first_name} ${from.last_name || ''}`.trim() : from.username || 'Administrador';

    if (action === 'approve_expense') {
      // 1. Busca a despesa no banco de dados
      const { data: exp, error: fetchErr } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', expenseId)
        .single();

      if (fetchErr || !exp) {
        await answerCallback(botToken, callbackQueryId, '⚠️ Despesa não encontrada!', true);
        return NextResponse.json({ ok: true });
      }

      // Verifica se já foi aprovada
      if (!exp.description?.startsWith('[PENDENTE:')) {
        await answerCallback(botToken, callbackQueryId, 'ℹ️ Esta saída já foi processada anteriormente.', true);
        return NextResponse.json({ ok: true });
      }

      // Extrai o valor real pendente e limpa a descrição
      const match = exp.description.match(/\[PENDENTE: R\$ ([\d.]+)\] (.*)/);
      const parsedAmount = match ? parseFloat(match[1]) : (exp.amount || 0);
      const cleanDesc = match ? match[2] : exp.description;

      // 2. Atualiza a despesa
      const { error: updateErr } = await supabase.from('expenses').update({
        amount: parsedAmount,
        description: cleanDesc
      }).eq('id', expenseId);

      if (updateErr) {
        await answerCallback(botToken, callbackQueryId, '❌ Erro ao atualizar despesa: ' + updateErr.message, true);
        return NextResponse.json({ ok: true });
      }

      // 3. Debita do saldo da conta (caixa)
      if (exp.account_id && parsedAmount > 0) {
        const { data: acc } = await supabase.from('accounts').select('balance').eq('id', exp.account_id).single();
        if (acc) {
          await supabase.from('accounts').update({
            balance: (acc.balance || 0) - parsedAmount
          }).eq('id', exp.account_id);
        }
      }

      // 4. Notifica quem clicou
      await answerCallback(botToken, callbackQueryId, `✅ Saída de R$ ${parsedAmount.toFixed(2)} APROVADA com sucesso!`, false);

      // 5. Atualiza a mensagem no grupo removendo os botões
      const originalText = message?.text || message?.caption || '';
      const nowStr = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const updatedText = originalText + `\n\n━━━━━━━━━━━━━━━━━━━━\n✅ <b>APROVADA</b> por <b>${approverName}</b>\n⏰ <b>Aprovado em:</b> ${nowStr}`;

      await editMessage(botToken, message.chat.id, message.message_id, updatedText);

    } else if (action === 'reject_expense') {
      // 1. Busca a despesa
      const { data: exp } = await supabase.from('expenses').select('*').eq('id', expenseId).single();

      if (exp && exp.description?.startsWith('[PENDENTE:')) {
        const cleanDesc = exp.description.replace(/\[PENDENTE: R\$ [\d.]+\] /, '');
        
        // Marca como recusada no banco
        await supabase.from('expenses').update({
          description: `[RECUSADO] ${cleanDesc}`
        }).eq('id', expenseId);

        await answerCallback(botToken, callbackQueryId, '❌ Solicitação de saída RECUSADA.', false);

        const originalText = message?.text || message?.caption || '';
        const nowStr = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const updatedText = originalText + `\n\n━━━━━━━━━━━━━━━━━━━━\n❌ <b>RECUSADA</b> por <b>${approverName}</b>\n⏰ <b>Recusado em:</b> ${nowStr}`;

        await editMessage(botToken, message.chat.id, message.message_id, updatedText);
      } else {
        await answerCallback(botToken, callbackQueryId, 'ℹ️ Esta solicitação já foi processada anteriormente.', true);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Erro no Webhook do Telegram:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
