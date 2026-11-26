'use client';
// app/admin/bot/page.js — /admin/bot: painel do bot em tela cheia.
// É a "casa" do operador (Maria Luísa): ela só enxerga as subabas liberadas ao papel dela.
import { useRouter } from 'next/navigation';
import BotPanel from './componentes/BotPanel';

export default function BotPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <BotPanel />
        <button onClick={() => router.push('/admin')} className="mt-8 text-xs text-slate-400 underline">ir para o admin completo</button>
      </div>
    </div>
  );
}
