# Notification Sharing — Sistema de Compartilhamento de Notificações para Cultos

Sistema web em tempo real que permite que secretários enviem avisos e comunicados ao pastor durante o culto, com confirmação de leitura e histórico persistido.

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Backend | Node.js 18+ · Express · TypeScript |
| WebSocket | `ws` (comunicação bidirecional em tempo real) |
| Banco de dados | PostgreSQL via Prisma ORM |
| Frontend | React · TypeScript · Vite |
| Autenticação | JWT (access token 15 min) + Refresh Token httpOnly cookie (8h) |
| Testes | Jest · fast-check (backend) · Vitest · fast-check (frontend) |

## Perfis de Usuário

| Perfil | Acesso |
|---|---|
| **Administrador** | Gerencia contas de usuários + todas as funcionalidades de Secretário e Pastor |
| **Secretário** | Cria e envia notificações, gerencia categorias e templates, consulta histórico |
| **Pastor** | Recebe notificações em tempo real, marca como lidas |

## Pré-requisitos

- Node.js 18 ou superior
- PostgreSQL 14 ou superior

## Como executar

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
# Edite .env com suas credenciais do PostgreSQL e secrets JWT
```

### 3. Executar migrations do banco de dados

```bash
npm run prisma:migrate --workspace=packages/backend
```

### 4. Popular banco com dados iniciais (seed)

```bash
npm run prisma:seed --workspace=packages/backend
```

Cria os três templates padrão ("Aniversariantes", "Pedido de Oração", "Aviso Geral") e o usuário Administrador inicial.

### 5. Iniciar em modo desenvolvimento

```bash
npm run dev
```

Backend: `http://localhost:3000`  
Frontend: `http://localhost:5173` (proxy `/api` e `/ws` para o backend)

### Build para produção

```bash
npm run build
npm run start
```

Em produção o backend serve o bundle React via `express.static`.

### Deploy com Docker Compose e Traefik

O projeto inclui uma imagem de produção e um `docker-compose.yml` para um VPS.
O Compose executa o backend, PostgreSQL persistente e expõe HTTP/WebSocket pela
rede externa `traefik-public`.

1. Crie a rede usada pelo seu Traefik, caso ainda não exista:

```bash
docker network create traefik-public
```

2. Copie e preencha as variáveis de produção:

```bash
cp .env.production.example .env.production
```

Use `--env-file` em todos os comandos para que o Compose também possa interpolar
o domínio e as credenciais do PostgreSQL:

```bash
docker compose --env-file .env.production build
docker compose --env-file .env.production up -d
```

O primeiro start aplica o schema Prisma com `prisma db push`. Depois, execute o
seed uma única vez para criar os templates e o Super Admin inicial:

```bash
docker compose --env-file .env.production run --rm app sh -c "npx prisma db push --schema=packages/backend/prisma/schema.prisma --skip-generate && npx ts-node packages/backend/prisma/seed.ts"
```

O resolver usado pelo Traefik está configurado como `letsencrypt`; altere o
label em `docker-compose.yml` se o seu Traefik usa outro nome. O WebSocket em
`/ws` é encaminhado pelo mesmo router HTTPS automaticamente.

Faça backup regular do volume `postgres-data` antes de atualizar ou remover a
stack. O arquivo `.env.production` nunca deve ser versionado.

### Deploy pelo Portainer

O workflow `Build and publish container` publica imagens no GitHub Container
Registry a cada push para `main`. As imagens são geradas para `linux/amd64` e
`linux/arm64`, incluindo Oracle Cloud Ampere.

Para um pacote privado, adicione `ghcr.io` em **Registries** no Portainer usando
seu usuário do GitHub e um Personal Access Token com `read:packages`. Pacotes
públicos não precisam desse login.

Crie uma Stack no Portainer usando `docker-compose.yml`, preencha as variáveis
de `.env.production.example` e faça o deploy. O Portainer usará a imagem
`ghcr.io/christianfds/notification-sharing:latest`.

Depois de um novo workflow concluído, use **Pull and redeploy** para atualizar.
Para deploy controlado, defina `IMAGE_TAG` como o tag `sha-...` publicado pelo
workflow em vez de usar `latest`.

## Estrutura do projeto

```
notification-sharing/
├── packages/
│   ├── backend/          # Node.js + Express + Prisma
│   │   ├── prisma/       # Schema e migrations
│   │   └── src/
│   │       ├── modules/  # auth, users, categories, templates, notifications, websocket
│   │       ├── middleware/
│   │       ├── jobs/
│   │       ├── lib/
│   │       ├── app.ts
│   │       ├── server.ts
│   │       └── config.ts
│   └── frontend/         # React + Vite
│       └── src/
│           ├── pages/
│           ├── components/
│           ├── hooks/
│           ├── services/
│           ├── contexts/
│           └── types/
├── .env.example
├── package.json          # Workspaces raiz
└── tsconfig.json
```
