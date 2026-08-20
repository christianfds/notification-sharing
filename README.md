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
