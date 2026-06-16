# GREEN ODDS PRO - Deployment

## Observacao de arquitetura

O projeto usa PostgreSQL e scheduler residente no processo Node.js. A opcao mais direta e segura e Railway, Render ou VPS com processo persistente.

Vercel nao oferece processo residente nem armazenamento local duravel. Use PostgreSQL gerenciado e execute jobs em cron/worker externo.

## Vercel

Requisitos antes do deploy:

1. Conectar um PostgreSQL gerenciado.
2. Aplicar `npm run db:deploy` e testar restauracao.
3. Substituir o scheduler residente por Vercel Cron ou worker externo.
4. Armazenar backups em S3/R2/Blob, nunca no filesystem local.
5. Configurar todas as variaveis no painel da Vercel.

Use `npm run build` como comando de build. Nao considere o sistema pronto enquanto os jobs externos nao aparecerem em `/jobs`.

## Railway

Opcao recomendada com PostgreSQL gerenciado:

1. Crie servico Node e banco PostgreSQL.
2. Configure as variaveis de `.env.production.example`.
3. Build: `npm ci && npx prisma generate && npm run build`.
4. Pre-deploy: `npx prisma migrate deploy`.
5. Start: `npm run start`.
6. Use volume ou object storage para `BACKUP_DIR`.

Um unico processo deve controlar o scheduler. Multiplas replicas exigem lock distribuido antes de habilitar jobs em todas elas.

## Render

1. Crie Web Service Node e banco persistente.
2. Build: `npm ci && npx prisma generate && npm run build`.
3. Start: `npm run start`.
4. Execute `npx prisma migrate deploy` antes do start.
5. Anexe Persistent Disk apenas para backups locais; o banco deve permanecer no PostgreSQL.

Instancias que suspendem por inatividade interrompem o scheduler. Use plano sempre ativo ou cron/worker separado.

## VPS Linux

Opcao compativel com a arquitetura atual:

```bash
sudo apt update
sudo apt install -y nginx
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
```

Execute com systemd ou PM2 em uma unica instancia. Configure Nginx como reverse proxy HTTPS. Restrinja permissoes do `.env`, banco e backups ao usuario da aplicacao.

Para systemd, use reinicio automatico e carregue variaveis por `EnvironmentFile`. Monitore processo, disco, banco e `/api/health`.

## Checklist pos-deploy

- `/health` sem RED.
- `/jobs` recebendo novas execucoes.
- Provider licenciado configurado e com chamadas bem-sucedidas.
- `/admin` exige autenticacao.
- Backup externo testado.
- `/go-live` revisado.
- `ALLOW_MOCK_PROVIDER=false`.
- Nenhuma chave presente em logs ou artefatos.

## Responsabilidade

Disponibilidade tecnica nao representa promessa de lucro ou garantia de green. Todas as previsoes permanecem probabilisticas.
