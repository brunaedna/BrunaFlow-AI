# Conectar contas Gmail ao BrunaFlow

Cada visitante autoriza a própria conta no Google. O BrunaFlow guarda somente um token OAuth criptografado; a senha do Gmail nunca passa pelo aplicativo.

## 1. Preparar o Google Cloud

1. Crie ou selecione um projeto no Google Cloud Console.
2. Ative a **Gmail API**.
3. Configure a tela de consentimento OAuth como aplicativo externo.
4. Adicione os escopos:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.metadata`
5. Crie um cliente OAuth do tipo **Web application**.
6. Cadastre as URLs de redirecionamento exatas:
   - Local: `http://127.0.0.1:4175/api/integrations/gmail/callback`
   - Produção: `https://SEU-WORKER.workers.dev/api/integrations/gmail/callback`
   - Se usar domínio próprio, cadastre também `https://SEU-DOMINIO/api/integrations/gmail/callback`.

Enquanto o aplicativo estiver no modo de teste do Google, inclua manualmente os e-mails dos avaliadores como usuários de teste. Para permitir qualquer conta Google, publique a tela de consentimento e conclua qualquer verificação solicitada pelo Google.

## 2. Configurar no Cloudflare

Cadastre como segredos de produção:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
OAUTH_ENCRYPTION_KEY
```

`OAUTH_ENCRYPTION_KEY` deve ser uma sequência longa e aleatória. Não publique esse valor no GitHub e não o troque depois que usuários conectarem suas contas, pois os tokens existentes deixariam de ser descriptografados.

Também mantenha as chaves da IA já usadas pelo projeto:

```text
GROQ_API_KEY
GEMINI_API_KEY
```

## 3. Banco de dados

Aplique todas as migrações da pasta `drizzle` em ordem. As migrações `0004` e `0005` adicionam conexões Gmail criptografadas e isolamento dos dados por visitante.

## 4. Testar

1. Abra o BrunaFlow em uma janela anônima.
2. Clique em **Conectar Gmail**.
3. Confira os escopos na tela oficial do Google e autorize.
4. Volte ao painel e confirme que os totais da caixa foram sincronizados.
5. Execute um fluxo e confirme que a mensagem aparece em **Enviados** na conta conectada.
6. Clique em desconectar e confirme que o painel deixa de acessar a conta.
