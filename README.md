# BrunaFlow AI

O **BrunaFlow AI** é uma plataforma de automação de processos que conecta formulários e aplicações a fluxos inteligentes de atendimento. A solução recebe eventos por webhook, classifica contatos com inteligência artificial, personaliza mensagens e envia e-mails reais pela conta Gmail conectada pelo usuário.

**Aplicação:** [brunaflow-ai.brunaflow.workers.dev](https://brunaflow-ai.brunaflow.workers.dev/)

## Principais funcionalidades

- Criação e gerenciamento de automações por gatilho.
- Webhooks com chave exclusiva por workspace.
- Classificação de leads e definição de prioridade com IA.
- Integração com Groq e Gemini, com fallback entre provedores.
- Conexão individual com Gmail usando OAuth 2.0.
- Criação, edição e geração de modelos de e-mail com IA.
- Variáveis personalizáveis, como `{{nome}}`, `{{email}}` e `{{mensagem}}`.
- Envio de testes e registro dos e-mails enviados.
- Histórico de execuções, taxa de sucesso e tempo economizado.
- Controles de privacidade, desconexão de integrações e exclusão dos dados do workspace.

## Como funciona

```text
Aplicação ou formulário
        ↓ webhook
BrunaFlow AI
        ↓
Classificação com Groq ou Gemini
        ↓
Modelo de e-mail personalizado
        ↓
Envio pela conta Gmail conectada
        ↓
Histórico e métricas no dashboard
```

## Tecnologias utilizadas

- **Next.js 16**, **React 19** e **TypeScript**
- **Vinext**, **Vite** e **Tailwind CSS**
- **Cloudflare Workers** para execução e publicação
- **Cloudflare D1** como banco de dados SQL
- **Drizzle ORM** para schema e consultas
- **Gmail API** e **Google OAuth 2.0**
- **Groq API** e **Google Gemini API**
- **Lucide React** e componentes baseados em **shadcn/ui**

## Execução local

Requisitos: Node.js `22.13.0` ou superior.

```bash
npm ci
```

Copie `.env.example` para `.env.local` e preencha somente as credenciais necessárias. Depois execute:

```bash
npm run dev
```

A aplicação será iniciada localmente pelo ambiente Vinext/Vite.

## Variáveis de ambiente

O arquivo `.env.example` documenta as configurações disponíveis para:

- Groq e Gemini;
- Google OAuth e Gmail;
- criptografia dos tokens OAuth;
- autenticação dos webhooks.

Nunca envie arquivos `.env` ou credenciais reais para o repositório.

## Objetivo do projeto

O BrunaFlow AI foi desenvolvido como projeto de portfólio para demonstrar automação empresarial, integração entre serviços, processamento de eventos, persistência de dados, segurança de credenciais e aplicação prática de inteligência artificial.
