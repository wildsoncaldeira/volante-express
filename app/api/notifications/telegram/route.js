import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      customer_name, 
      vehicle_model, 
      vehicle_year, 
      gross_amount, 
      payment_method,
      is_split_payment,
      gross_amount_2,
      payment_method_2,
      material_name,
      installer_name,
      calendar_name,
      photo_url 
    } = body;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.warn('Telegram token ou chat ID não configurados.');
      return NextResponse.json({ skipped: true, reason: 'Configurações ausentes' }, { status: 200 });
    }

    // Formata valores
    const formattedAmount1 = Number(gross_amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const formattedAmount2 = is_split_payment ? Number(gross_amount_2 || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';
    
    let paymentText = `${payment_method ? payment_method.toUpperCase() : 'N/I'} (${formattedAmount1})`;
    if (is_split_payment) {
      paymentText += ` + ${payment_method_2 ? payment_method_2.toUpperCase() : 'N/I'} (${formattedAmount2})`;
    }

    const caption = `🟢 <b>NOVO SERVIÇO CONCLUÍDO!</b>\n\n` +
      `👤 <b>Cliente:</b> ${customer_name || 'Não informado'}\n` +
      `🚗 <b>Veículo:</b> ${vehicle_model || 'Não informado'} ${vehicle_year ? `(${vehicle_year})` : ''}\n` +
      `📍 <b>Cidade/Agenda:</b> ${calendar_name || 'N/A'}\n` +
      `🛠️ <b>Material:</b> ${material_name || 'Instalação'}\n` +
      `💰 <b>Valor Total:</b> ${paymentText}\n` +
      `👷 <b>Instalador:</b> ${installer_name || 'Não atribuído'}\n\n` +
      `⏰ <b>Data/Hora:</b> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;

    const inlineKeyboard = photo_url ? {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📸 Ver Foto da Instalação', url: photo_url }]
        ]
      }
    } : {};

    let response;
    // Se houver foto, tenta enviar via sendPhoto primeiro para exibir a imagem no chat
    if (photo_url) {
      response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photo_url,
          caption: caption,
          parse_mode: 'HTML',
          ...inlineKeyboard
        })
      });

      const photoRes = await response.json();
      if (photoRes.ok) {
        return NextResponse.json({ success: true, mode: 'photo' }, { status: 200 });
      }
      console.warn('Falha ao enviar foto no Telegram, tentando mensagem simples:', photoRes);
    }

    // Fallback para mensagem de texto simples se não houver foto ou se sendPhoto falhar
    response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: caption,
        parse_mode: 'HTML',
        ...inlineKeyboard
      })
    });

    const textRes = await response.json();
    if (!textRes.ok) {
      throw new Error(`Telegram API Error: ${textRes.description}`);
    }

    return NextResponse.json({ success: true, mode: 'text' }, { status: 200 });

  } catch (error) {
    console.error('Erro ao enviar notificação do Telegram:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
