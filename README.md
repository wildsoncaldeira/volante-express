# Volante Express / Volante Pro 🚗📱

> Sistema de gestão de campo, automação de ordens de serviço e checkout financeiro para especialistas em revestimento e estética de volantes.

O **Volante Express** é uma plataforma desenvolvida para digitalizar, organizar e automatizar toda a operação de campo da empresa. Ele serve como a ponte entre o marketing/vendas (GoHighLevel) e o instalador em campo, eliminando o uso de papel, automatizando o controle de estoque regional, calculando taxas de maquininha em tempo real e gerando peças de marketing instantâneas.

---

## 🎯 Objetivo do Projeto

Otimizar a logística e a execução de serviços automotivos em campo. O aplicativo gerencia a jornada do instalador desde o recebimento da agenda matinal até o checkout financeiro e registro fotográfico do serviço na casa ou empresa do cliente.

---

## 🚀 Principais Funcionalidades

### 👥 Visão do Instalador (App de Campo)

- **Agenda Inteligente:** Sincronização em tempo real dos serviços agendados para o dia via integração com CRM.
- **Filtro por Regional:** O instalador visualiza apenas serviços e materiais da sua praça de atuação (ex: Sete Lagoas, Divinópolis, Belo Horizonte).
- **Controle de Estoque Local:** Seleção e baixa automática dos insumos utilizados no atendimento.
- **Calculadora Dinâmica de Checkout:** Exibição imediata do valor das parcelas já com as taxas atualizadas da maquininha (InfinitePay).
- **Pagamento Híbrido (Split):** Suporte para recebimento dividido (ex: parte em PIX, parte no Cartão de Crédito).
- **Câmera com Marca D'água Integrada:** Upload do comprovante visual do serviço com compressão automática (~4MB para ~150KB) e inserção automática de cidade e modelo do carro para fins de marketing.

### 💼 Visão Administrativa (Backoffice)

- **Gestão de Estoque e Regionais:** Controle centralizado de insumos por cidade.
- **Configuração de Taxas:** Painel para atualização das taxas de parcelamento do cartão.
- **Auditoria de Logs:** Visualização de webhooks recebidos e histórico financeiro/comissões dos instaladores.

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js (React) + Tailwind CSS |
| Backend & Banco | Supabase (PostgreSQL) |
| Segurança | Row Level Security (RLS) |
| Imagens | Sharp (compressão + overlays SVG server-side) |
| Infraestrutura | VPS Hostinger + Nginx + PM2 |
| Integrações | Webhooks com GoHighLevel (GHL) |

---

## ⚙️ Configuração do Ambiente Local

### Pré-requisitos

- Node.js v18 ou superior
- NPM ou Yarn
- Conta/Projeto criado no Supabase

### 1. Clonar o Repositório

```bash
git clone https://github.com/wildsoncaldeira/volante-express.git
cd volante-express
```

### 2. Instalar as Dependências

```bash
npm install
```

### 3. Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-aqui
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role-privada

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Rodar em Desenvolvimento

```bash
npm run dev
```

Acesse `http://localhost:3000` no navegador.

---

## 🌐 Deploy em Produção (VPS)

### Nginx — `/etc/nginx/sites-available/default`

```nginx
server {
    server_name app.volanteexpress.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### PM2

```bash
npm run build
pm2 start npm --name "volante-express" -- start
pm2 save
```

---

## 🔒 Segurança (Supabase RLS)

Todas as tabelas públicas possuem políticas de acesso controladas via Row Level Security:

- **`regions`, `payment_rates`:** SELECT permitido apenas para usuários autenticados.
- **`webhook_logs`:** RLS ativo sem políticas públicas — acesso exclusivo via `SUPABASE_SERVICE_ROLE_KEY` pelo backend.

---

## 🔮 Roadmap

- [ ] **Modo Offline-First:** Cache local via PWA (IndexedDB / PowerSync) para uso em locais sem cobertura 4G.
- [ ] **Automação Instagram:** Integração da API de fotos com n8n/Make para postagem automática nos Stories.

---

🎨 Desenvolvido por **Wildson Caldeira**
