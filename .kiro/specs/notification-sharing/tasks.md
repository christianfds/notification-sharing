# Implementation Plan: notification-sharing

## Overview

Implementação incremental do sistema de compartilhamento de notificações para cultos religiosos. A estrutura é um monorepo com backend (Node.js + Express + TypeScript + Prisma + PostgreSQL) e frontend (React + TypeScript + Vite). O sistema possui três perfis de usuário (Administrador, Secretário, Pastor), comunicação em tempo real via WebSocket e 18 propriedades de correção cobertas por testes baseados em propriedades com fast-check.

A ordem de implementação segue a dependência natural: infraestrutura → autenticação → domínio (categorias, templates, notificações) → WebSocket → frontend → integração.

---

## Tasks

- [x] 1. Configurar estrutura do monorepo e infraestrutura base
  - [x] 1.1 Inicializar estrutura de diretórios do monorepo
    - Criar `packages/backend` e `packages/frontend` com `package.json` próprios
    - Configurar `package.json` raiz com workspaces e scripts de desenvolvimento
    - Adicionar `tsconfig.json` raiz com paths compartilhados e `tsconfig.json` em cada pacote
    - Adicionar `.gitignore`, `.env.example` e `README.md` raiz
    - _Requisitos: Arquitetura geral_

  - [x] 1.2 Configurar backend Express + TypeScript
    - Instalar dependências: `express`, `typescript`, `ts-node-dev`, `@types/express`, `@types/node`
    - Instalar dependências de produção: `ws`, `jsonwebtoken`, `bcryptjs`, `dotenv`, `node-cron`, `cors`, `helmet`
    - Instalar dependências de teste: `jest`, `ts-jest`, `supertest`, `fast-check`, `@types/jest`, `@types/supertest`, `@types/ws`, `@types/bcryptjs`, `@types/jsonwebtoken`
    - Criar `src/app.ts` (Express app), `src/server.ts` (ponto de entrada), `src/config.ts` (variáveis de ambiente)
    - Configurar `jest.config.ts` para TypeScript
    - _Requisitos: Arquitetura geral_

  - [x] 1.3 Configurar Prisma e schema do banco de dados
    - Instalar `prisma` e `@prisma/client`
    - Criar `prisma/schema.prisma` com os modelos: `User`, `LoginAttempt`, `RefreshToken`, `Category`, `Template`, `Notification` conforme o design
    - Criar migration inicial: `npx prisma migrate dev --name init`
    - Criar `src/lib/prisma.ts` com instância singleton do PrismaClient
    - Criar `prisma/seed.ts` com seed dos três templates padrão ("Aniversariantes", "Pedido de Oração", "Aviso Geral") e do usuário Administrador inicial
    - _Requisitos: 4.1, Arquitetura geral_

  - [x] 1.4 Configurar frontend React + TypeScript + Vite
    - Criar projeto com `npm create vite@latest frontend -- --template react-ts`
    - Instalar dependências: `react-router-dom`, `axios`
    - Instalar dependências de teste: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `fast-check`
    - Configurar `vite.config.ts` com proxy para `/api` e `/ws` apontando para o backend em desenvolvimento
    - Criar estrutura de pastas: `src/pages/`, `src/components/`, `src/hooks/`, `src/services/`, `src/types/`
    - Criar `src/types/index.ts` com interfaces TypeScript compartilhadas (User, Notification, Category, Template, UserRole)
    - _Requisitos: Arquitetura geral_

- [x] 2. Implementar autenticação e segurança
  - [x] 2.1 Implementar AuthService no backend
    - Criar `src/modules/auth/auth.service.ts` com métodos: `login`, `refreshToken`, `logout`, `validateToken`
    - Implementar geração de access token JWT (expiração 15 min) com payload `{ sub: userId, role, iat, exp }`
    - Implementar geração e armazenamento de refresh token opaco (expiração 8h) na tabela `RefreshToken`
    - Implementar revogação de refresh token no logout e ao encerrar sessão por inatividade
    - Implementar hashing de senha com `bcryptjs` (fator 12)
    - _Requisitos: 1.2, 1.5_

  - [x] 2.2 Implementar lógica de bloqueio de conta por tentativas
    - Criar `src/modules/auth/login-attempt.service.ts` com rastreamento de tentativas por username (case-insensitive)
    - Implementar janela deslizante: se as últimas 5 tentativas dentro de 15 min forem todas falhas → bloquear por 15 min
    - Retornar HTTP 423 com `ACCOUNT_LOCKED` quando bloqueado
    - Registrar tentativas bem-sucedidas para resetar o contador
    - _Requisitos: 1.3, 1.4_

  - [x] 2.3 Criar rotas e middleware de autenticação
    - Criar `src/modules/auth/auth.router.ts` com `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`
    - Criar `src/middleware/auth.middleware.ts` que valida o JWT do header `Authorization: Bearer <token>` e injeta `req.user`
    - Criar `src/middleware/role.middleware.ts` que verifica o perfil requerido e retorna 403 se insuficiente
    - Configurar cookie httpOnly Secure SameSite=Strict para o refresh token
    - _Requisitos: 1.1, 1.2, 2b.5_

  - [ ]* 2.4 Escrever teste de propriedade — Property 1: credencial válida retorna token com perfil correto
    - **Property 1: Autenticação — credencial válida retorna token com perfil correto**
    - **Validates: Requisito 1.2**
    - Usar fast-check para gerar combinações de username/senha válidos e verificar que o token retornado contém `userId` e `role` corretos
    - Arquivo: `src/modules/auth/__tests__/auth.property.test.ts`

  - [ ]* 2.5 Escrever teste de propriedade — Property 2: credencial inválida é sempre rejeitada
    - **Property 2: Autenticação — credencial inválida é sempre rejeitada**
    - **Validates: Requisito 1.3**
    - Usar fast-check para gerar strings arbitrárias de username/senha que não correspondam a nenhum usuário e verificar que sempre retorna 401 sem token

  - [ ]* 2.6 Escrever testes de unidade para AuthService e bloqueio de conta
    - Testar login com credenciais válidas e inválidas
    - Testar bloqueio após 5 tentativas consecutivas falhas
    - Testar que tentativa bem-sucedida reseta o contador
    - Testar expiração do bloqueio de 15 minutos
    - Testar revogação do refresh token no logout
    - _Requisitos: 1.2, 1.3, 1.4_

- [x] 3. Checkpoint — Verificar autenticação
  - Garantir que todos os testes de autenticação passem, consultar o usuário em caso de dúvidas.

- [x] 4. Implementar gerenciamento de usuários (Admin)
  - [x] 4.1 Implementar UserService no backend
    - Criar `src/modules/users/user.service.ts` com métodos: `createUser`, `listUsers`, `updateUser`, `setUserStatus`, `getUserById`
    - Validar unicidade de username (case-insensitive, armazenar em lowercase)
    - Validar comprimento do username (3–50 caracteres não-espaço)
    - Validar senha mínima de 8 caracteres
    - Ordenar listagem alfabeticamente por username
    - Implementar regra de negócio: Admin não pode desativar a própria conta
    - Implementar encerramento de sessão ativa do usuário desativado (revogar refresh tokens)
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x] 4.2 Criar rotas de usuários
    - Criar `src/modules/users/user.router.ts` com:
      - `GET /api/v1/users` (Admin apenas)
      - `POST /api/v1/users` (Admin apenas)
      - `PUT /api/v1/users/:id` (Admin apenas)
      - `PATCH /api/v1/users/:id/status` (Admin apenas)
    - Aplicar middleware de autenticação e autorização em todas as rotas
    - _Requisitos: 2.1, 2.4, 2.5, 2.7, 2.8_

  - [ ]* 4.3 Escrever teste de propriedade — Property 3: round-trip de cadastro de usuário
    - **Property 3: Criação de usuário — round-trip de cadastro**
    - **Validates: Requisitos 2.1, 2.2**
    - Usar fast-check para gerar usernames e senhas válidos e verificar que o usuário aparece na listagem e consegue fazer login

  - [ ]* 4.4 Escrever teste de propriedade — Property 4: unicidade de username é case-insensitive
    - **Property 4: Unicidade de username é case-insensitive**
    - **Validates: Requisito 2.3**
    - Usar fast-check para gerar variações de capitalização de um username existente e verificar rejeição com 409

  - [ ]* 4.5 Escrever teste de propriedade — Property 5: ciclo de vida de conta
    - **Property 5: Ciclo de vida de conta — desativação bloqueia e reativação restaura**
    - **Validates: Requisitos 2.5, 2.8**
    - Verificar que após desativação o login é rejeitado, e após reativação o login é aceito novamente

  - [ ]* 4.6 Escrever teste de propriedade — Property 6: listagem de usuários em ordem alfabética
    - **Property 6: Listagem de usuários em ordem alfabética (parte de usuários)**
    - **Validates: Requisito 2.7**
    - Usar fast-check para criar N usuários com nomes arbitrários e verificar que a listagem retorna todos em ordem alfabética crescente por username (case-insensitive)

  - [ ]* 4.7 Escrever testes de unidade para UserService
    - Testar criação com username duplicado (case-insensitive)
    - Testar desativação da própria conta de Admin
    - Testar que desativação revoga sessões ativas
    - Testar reativação restaura acesso
    - _Requisitos: 2.3, 2.6, 2.8_

- [x] 5. Implementar gerenciamento de categorias
  - [x] 5.1 Implementar CategoryService no backend
    - Criar `src/modules/categories/category.service.ts` com métodos: `createCategory`, `listCategories`, `updateCategory`, `deleteCategory`
    - Armazenar `name` em lowercase e `displayName` com capitalização original do usuário
    - Validar unicidade case-insensitive e comprimento (1–50 caracteres não-espaço)
    - Ordenar listagem alfabeticamente por `displayName`
    - Implementar exclusão: remove da listagem mas mantém notificações existentes intactas
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 5.2 Criar rotas de categorias
    - Criar `src/modules/categories/category.router.ts` com:
      - `GET /api/v1/categories` (Secretário, Admin)
      - `POST /api/v1/categories` (Secretário, Admin)
      - `PUT /api/v1/categories/:id` (Secretário, Admin)
      - `DELETE /api/v1/categories/:id` (Secretário, Admin)
    - _Requisitos: 3.1–3.7_

  - [ ]* 5.3 Escrever teste de propriedade — Property 6: listagem de categorias em ordem alfabética
    - **Property 6: Listagem de categorias em ordem alfabética (parte de categorias)**
    - **Validates: Requisito 3.6**
    - Usar fast-check para criar N categorias com nomes arbitrários e verificar ordem alfabética crescente (case-insensitive)

  - [ ]* 5.4 Escrever teste de propriedade — Property 7: round-trip e unicidade de categoria
    - **Property 7: Criação de categoria — round-trip e unicidade case-insensitive**
    - **Validates: Requisitos 3.1, 3.2, 3.3, 3.7**
    - Verificar que categoria válida aparece na listagem e que variações de capitalização do mesmo nome são rejeitadas

  - [ ]* 5.5 Escrever teste de propriedade — Property 8: exclusão de categoria preserva notificações
    - **Property 8: Exclusão de categoria preserva notificações existentes**
    - **Validates: Requisito 3.5**
    - Criar N notificações em uma categoria, excluir a categoria e verificar que as notificações permanecem com conteúdo intacto

  - [ ]* 5.6 Escrever testes de unidade para CategoryService
    - Testar criação com nome duplicado (case-insensitive)
    - Testar edição para nome já existente
    - Testar que exclusão não altera notificações associadas
    - _Requisitos: 3.3, 3.4, 3.5, 3.7_

- [x] 6. Implementar gerenciamento de templates
  - [x] 6.1 Implementar TemplateService no backend
    - Criar `src/modules/templates/template.service.ts` com métodos: `createTemplate`, `listTemplates`, `updateTemplate`, `deleteTemplate`
    - Validar campos obrigatórios: título (1–100 chars não-espaço) e corpo (1–500 chars não-espaço)
    - Implementar proteção contra exclusão de templates padrão (`isDefault = true`) com erro `BUSINESS_RULE_VIOLATION`
    - Garantir que edição de template não afeta notificações já enviadas (notificação armazena título/corpo no momento do envio)
    - _Requisitos: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7_

  - [x] 6.2 Criar rotas de templates
    - Criar `src/modules/templates/template.router.ts` com:
      - `GET /api/v1/templates` (Secretário, Admin)
      - `POST /api/v1/templates` (Secretário, Admin)
      - `PUT /api/v1/templates/:id` (Secretário, Admin)
      - `DELETE /api/v1/templates/:id` (Secretário, Admin)
    - _Requisitos: 4.2, 4.6, 4.7_

  - [ ]* 6.3 Escrever teste de propriedade — Property 9: validação de campos obrigatórios de template
    - **Property 9: Validação de templates — campos obrigatórios não-espaço**
    - **Validates: Requisitos 4.2, 4.3**
    - Usar fast-check para gerar strings compostas apenas de espaços ou vazias e verificar rejeição; gerar strings válidas e verificar aceitação

  - [ ]* 6.4 Escrever teste de propriedade — Property 11: edição de template não altera notificações enviadas
    - **Property 11: Edição de template não altera notificações já enviadas**
    - **Validates: Requisito 4.5**
    - Criar N notificações baseadas em um template, editar o template e verificar que nenhuma notificação existente teve título ou corpo alterados

  - [ ]* 6.5 Escrever testes de unidade para TemplateService
    - Testar rejeição de exclusão de template padrão
    - Testar validação de campos vazios / apenas espaços
    - Testar que edição não afeta notificações existentes
    - _Requisitos: 4.3, 4.5, 4.7_

- [x] 7. Checkpoint — Verificar domínio (usuários, categorias, templates)
  - Garantir que todos os testes dos módulos de domínio passem, consultar o usuário em caso de dúvidas.

- [x] 8. Implementar criação e histórico de notificações
  - [x] 8.1 Implementar NotificationService no backend
    - Criar `src/modules/notifications/notification.service.ts` com métodos: `createNotification`, `listNotifications`, `getNotificationById`, `markAsRead`
    - Validar campos obrigatórios: título (1–100 chars), corpo (1–500 chars), categoryId obrigatório
    - Registrar `sentAt` no momento da criação
    - Implementar filtros de histórico: por `categoryId`, por intervalo de datas (`from`/`to`, máx. 31 dias)
    - Implementar paginação: máx. 50 itens por página, ordenados por `sentAt` decrescente
    - Implementar `markAsRead`: idempotente — se já lida, ignorar sem erro; se não lida, registrar `readAt = NOW()`
    - _Requisitos: 5.1, 5.2, 5.5, 5.6, 7.2, 7.7, 8.1, 8.2, 8.3, 8.6_

  - [x] 8.2 Criar rotas de notificações
    - Criar `src/modules/notifications/notification.router.ts` com:
      - `POST /api/v1/notifications` (Secretário, Admin)
      - `GET /api/v1/notifications` (Secretário, Admin) — com query params `categoryId`, `from`, `to`, `page`, `pageSize`
      - `GET /api/v1/notifications/:id` (Secretário, Admin, Pastor)
    - _Requisitos: 5.1, 5.7, 8.1, 8.2, 8.4, 8.6_

  - [x] 8.3 Implementar job de limpeza diária de notificações antigas
    - Criar `src/jobs/cleanup.job.ts` usando `node-cron`
    - Deletar notificações com `sentAt < NOW() - INTERVAL '12 months'`
    - Deletar `LoginAttempt` com `attemptedAt < NOW() - INTERVAL '30 days'`
    - Registrar execução no console/log
    - _Requisitos: 8.1_

  - [ ]* 8.4 Escrever teste de propriedade — Property 12: round-trip de criação de notificação com timestamp
    - **Property 12: Criação de notificação — round-trip com timestamp**
    - **Validates: Requisitos 5.1, 5.2**
    - Usar fast-check para gerar títulos, corpos e categoryIds válidos e verificar que notificação é persistida com `sentAt` válido e aparece na listagem

  - [ ]* 8.5 Escrever teste de propriedade — Property 13: listagem em ordem cronológica decrescente
    - **Property 13: Listagem de notificações respeita ordem cronológica decrescente**
    - **Validates: Requisitos 5.7, 6.5**
    - Criar N notificações em momentos distintos e verificar que a listagem retorna em ordem estritamente decrescente por `sentAt`

  - [ ]* 8.6 Escrever teste de propriedade — Property 15: marcação como lida — idempotência e timestamp
    - **Property 15: Marcação como lida — idempotência e registro de timestamp**
    - **Validates: Requisitos 7.2, 7.7**
    - Verificar que `readAt` é preenchido na primeira marcação e não alterado em marcações subsequentes; verificar que não retorna erro

  - [ ]* 8.7 Escrever teste de propriedade — Property 17: filtros do histórico retornam apenas resultados compatíveis
    - **Property 17: Filtros do histórico retornam apenas resultados compatíveis**
    - **Validates: Requisito 8.2**
    - Usar fast-check para gerar combinações de filtros válidos e verificar que nenhum resultado fora do intervalo de datas ou da categoria especificada é retornado

  - [ ]* 8.8 Escrever teste de propriedade — Property 18: paginação respeita limite de 50 itens
    - **Property 18: Paginação do histórico respeita o limite máximo de 50 itens por página**
    - **Validates: Requisito 8.6**
    - Criar mais de 50 notificações e verificar que cada página contém no máximo 50 itens e que a navegação cobre todas sem duplicação ou omissão

  - [ ]* 8.9 Escrever testes de unidade para NotificationService
    - Testar validação de campos obrigatórios (título, corpo, categoria)
    - Testar filtros de data inválidos (intervalo > 31 dias)
    - Testar idempotência de `markAsRead`
    - _Requisitos: 5.5, 5.6, 7.7, 8.2_

- [x] 9. Implementar WebSocket Server
  - [x] 9.1 Implementar WebSocketModule no backend
    - Criar `src/modules/websocket/websocket.server.ts` que inicializa o servidor `ws` integrado ao servidor HTTP do Express
    - Implementar autenticação JWT na query string durante o handshake HTTP (`wss://<host>/ws?token=<access_token>`)
    - Recusar conexões sem token válido com código 1008 (Policy Violation)
    - Associar cada conexão ao `userId` e `role` extraídos do token
    - Implementar sala global `"main"` para broadcast a todos os conectados
    - Implementar lógica de remoção de conexões ao desconectar
    - _Requisitos: 6.1, 6.6, 2b.2_

  - [x] 9.2 Implementar eventos WebSocket — envio e marcação como lida
    - No `POST /api/v1/notifications`: após persistir, emitir `notification:new` para Pastor/Admin e `notification:sent_ack` para o remetente via WebSocket
    - Implementar handler de mensagem `notification:read` recebida do Pastor/Admin: atualizar `readAt` no banco e emitir `notification:status_updated` para Secretário/Admin
    - Implementar handler de `ping` → responder com `pong`
    - Registrar erros de entrega e notificar o Painel_Secretário se ACK não for recebido em 3 segundos
    - _Requisitos: 5.3, 5.4, 6.1, 7.2, 7.3, 7.4_

  - [ ]* 9.3 Escrever testes de integração para WebSocket
    - Testar handshake com token válido e inválido
    - Testar entrega de `notification:new` ao Pastor após criação via REST
    - Testar recebimento de `notification:read` e emissão de `notification:status_updated` para o Secretário
    - _Requisitos: 6.1, 7.2, 7.3_

- [x] 10. Checkpoint — Verificar backend completo
  - Garantir que todos os testes de backend passem (unidade, integração, PBT), consultar o usuário em caso de dúvidas.

- [x] 11. Implementar frontend — infraestrutura e autenticação
  - [x] 11.1 Implementar serviços de API e contexto de autenticação no frontend
    - Criar `src/services/api.ts` com instância do `axios` configurada com interceptors para adicionar `Authorization: Bearer <token>` e tratar renovação automática de token via `/auth/refresh`
    - Criar `src/services/auth.service.ts` com funções `login`, `logout`, `refreshToken`
    - Criar `src/contexts/AuthContext.tsx` com `AuthProvider` que armazena `user` e `accessToken` em memória (não em localStorage por segurança)
    - Criar `src/hooks/useAuth.ts` para consumir o `AuthContext`
    - _Requisitos: 1.1, 1.2, 1.5_

  - [x] 11.2 Implementar tela de login e roteamento por perfil
    - Criar `src/pages/LoginPage.tsx` com formulário de username/senha, exibição de mensagem de erro (credenciais inválidas, conta bloqueada) e redirecionamento automático ao perfil correto após login
    - Criar `src/router/AppRouter.tsx` com rotas protegidas: `/admin` → `Painel_Admin`, `/secretary` → `Painel_Secretário`, `/pastor` → `Painel_Pastor`
    - Criar `src/components/ProtectedRoute.tsx` que redireciona para `/login` se não autenticado e para a rota correta se o perfil não corresponder
    - Implementar redirecionamento automático para `/login` quando o access token expirar e o refresh falhar (sessão de 8h)
    - _Requisitos: 1.1, 1.2, 1.3, 1.5_

- [x] 12. Implementar Painel_Admin (frontend)
  - [x] 12.1 Implementar componentes de listagem e formulário de usuários
    - Criar `src/pages/AdminPage.tsx` com layout de navegação entre as visões Admin, Secretário e Pastor
    - Criar `src/components/admin/UserList.tsx` que exibe todos os usuários em ordem alfabética com nome, perfil e status (ativo/inativo)
    - Criar `src/components/admin/UserForm.tsx` para criação e edição de usuários (nome de usuário, perfil, senha inicial)
    - Criar `src/components/admin/StatusBadge.tsx` para indicar status ativo/inativo
    - Criar `src/components/admin/ConfirmModal.tsx` para confirmar ações de desativação
    - Conectar aos endpoints `GET/POST/PUT/PATCH /api/v1/users`
    - Exibir erros de validação e conflito de username
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2b.5_

  - [ ]* 12.2 Escrever testes de componente para UserList e UserForm
    - Testar renderização da lista com dados mockados (ordem alfabética, badges de status)
    - Testar submissão do formulário com campos válidos e inválidos
    - Testar exibição de mensagem de erro ao tentar criar username duplicado
    - _Requisitos: 2.1, 2.3, 2.7_

- [x] 13. Implementar Painel_Secretário (frontend)
  - [x] 13.1 Implementar formulário de criação de notificação
    - Criar `src/pages/SecretaryPage.tsx` com layout principal do Painel_Secretário
    - Criar `src/components/secretary/NotificationForm.tsx` com campos de título (máx. 100 chars), corpo (máx. 500 chars) e seletor de categoria obrigatória
    - Criar `src/components/secretary/TemplateSelector.tsx` que lista templates disponíveis e ao selecionar preenche os campos de título e corpo do `NotificationForm` (mantendo editável)
    - Exibir lista de notificações enviadas na sessão atual em ordem cronológica decrescente
    - Exibir alerta se ACK do WebSocket não for recebido em 3 segundos após envio
    - _Requisitos: 5.1, 5.5, 5.6, 5.7, 5.8, 4.4_

  - [x] 13.2 Implementar gerenciamento de categorias e templates no frontend
    - Criar `src/components/secretary/CategoryManager.tsx` com listagem, criação, edição e exclusão de categorias
    - Criar `src/components/secretary/TemplateManager.tsx` com listagem, criação, edição e exclusão de templates (com proteção visual para templates padrão)
    - Exibir mensagens de validação e conflito de nome em categorias
    - Exibir mensagem de erro ao tentar excluir template padrão
    - _Requisitos: 3.1–3.7, 4.2, 4.3, 4.6, 4.7_

  - [x] 13.3 Implementar histórico de notificações no frontend
    - Criar `src/components/secretary/NotificationHistory.tsx` com filtros (categoria + intervalo de datas ≤ 31 dias) e lista paginada (máx. 50 por página)
    - Exibir para cada notificação: título, categoria, data/hora de envio e status de leitura (com horário de leitura quando aplicável)
    - Criar `src/components/secretary/ReadStatusBadge.tsx` para exibir estado lida/não lida
    - Implementar controles de navegação entre páginas
    - Exibir mensagem "nenhum resultado encontrado" quando aplicável
    - _Requisitos: 7.6, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 13.4 Conectar Painel_Secretário ao WebSocket
    - Criar `src/hooks/useWebSocket.ts` com gerenciamento de conexão WebSocket (conectar com token, reconectar, desconectar)
    - No Painel_Secretário, escutar o evento `notification:status_updated` e atualizar o status de leitura da notificação correspondente em tempo real (≤ 2 segundos)
    - _Requisitos: 7.3, 7.4, 7.6_

  - [ ]* 13.5 Escrever teste de propriedade — Property 10: seleção de template preenche formulário com conteúdo exato
    - **Property 10: Seleção de template preenche formulário com conteúdo exato**
    - **Validates: Requisitos 4.4, 5.8**
    - Usar fast-check para gerar templates com título e corpo arbitrários e verificar que os campos do formulário são preenchidos exatamente com o conteúdo do template (sem truncamento ou alteração)

  - [ ]* 13.6 Escrever testes de componente para NotificationForm e NotificationHistory
    - Testar validação de campos obrigatórios (título, corpo, categoria)
    - Testar que seleção de template preenche os campos
    - Testar renderização do histórico com filtros e paginação
    - Testar exibição de status de leitura com `ReadStatusBadge`
    - _Requisitos: 5.1, 5.5, 5.6, 5.8, 8.4, 8.6_

- [x] 14. Implementar Painel_Pastor (frontend)
  - [x] 14.1 Implementar feed de notificações e contador de não lidas
    - Criar `src/pages/PastorPage.tsx` com layout do Painel_Pastor
    - Criar `src/components/pastor/NotificationFeed.tsx` que exibe notificações em ordem cronológica decrescente com título, categoria e hora de envio
    - Criar `src/components/pastor/UnreadBadge.tsx` com contador de notificações não lidas no cabeçalho
    - Criar `src/components/pastor/NotificationCard.tsx` com destaque visual distinto para notificações não lidas (classe CSS diferenciada) e botão/ação para marcar como lida
    - Ao carregar o painel, buscar notificações via `GET /api/v1/notifications` e calcular o contador de não lidas a partir da lista
    - _Requisitos: 6.2, 6.5, 7.1, 7.5_

  - [x] 14.2 Conectar Painel_Pastor ao WebSocket com alertas e reconexão
    - No Painel_Pastor, conectar ao WebSocket e escutar `notification:new` para adicionar a notificação ao feed, incrementar o contador e emitir alerta sonoro/vibração
    - Implementar alerta sonoro com `AudioContext` quando dispositivo suportar áudio (Requisito 6.3)
    - Implementar vibração com `navigator.vibrate` quando dispositivo não suportar áudio mas suportar vibração (Requisito 6.4)
    - Emitir evento `notification:read` via WebSocket ao marcar notificação como lida
    - Criar `src/components/pastor/ConnectionStatusBar.tsx` que exibe indicador de perda de conexão durante reconexão
    - _Requisitos: 6.1, 6.3, 6.4, 6.6, 7.1, 7.2_

  - [x] 14.3 Implementar lógica de reconexão WebSocket no Painel_Pastor
    - No hook `useWebSocket`, implementar reconexão automática: ao detectar desconexão, tentar reconectar em intervalos de 5 segundos, por no máximo 5 tentativas
    - Antes de cada tentativa de reconexão, verificar se o access token expirou e executar refresh se necessário
    - Após 5 tentativas sem sucesso, exibir mensagem "Conexão perdida. Tente novamente manualmente." com botão para retentativa manual
    - Ao reconectar, recarregar notificações não lidas via `GET /api/v1/notifications` para garantir consistência
    - _Requisitos: 6.7, 6.8_

  - [ ]* 14.4 Escrever teste de propriedade — Property 14: contador de não lidas reflete estado atual
    - **Property 14: Contador de notificações não lidas reflete estado atual**
    - **Validates: Requisito 6.2**
    - Usar fast-check para simular N notificações recebidas e M marcações como lida (M ≤ N) e verificar que o contador exibe exatamente N - M

  - [ ]* 14.5 Escrever teste de propriedade — Property 16: renderização com destaque correto
    - **Property 16: Renderização de notificação inclui todos os campos obrigatórios com destaque correto**
    - **Validates: Requisitos 7.5, 7.6, 8.4**
    - Usar fast-check para gerar notificações com `readAt` nulo ou preenchido e verificar que o indicador visual de "não lida" aparece apenas quando `readAt` é nulo, e que todos os campos obrigatórios estão presentes

  - [ ]* 14.6 Escrever testes de componente para NotificationFeed e NotificationCard
    - Testar renderização de notificação não lida vs. lida (destaque visual)
    - Testar incremento do `UnreadBadge` ao receber nova notificação
    - Testar exibição do `ConnectionStatusBar` durante reconexão
    - _Requisitos: 6.2, 7.5_

- [x] 15. Integração final e cabeamento de componentes
  - [x] 15.1 Integrar Painel_Admin com visões de Secretário e Pastor
    - Adicionar navegação no `AdminPage.tsx` para alternar entre as visões Admin, Secretário e Pastor sem novo login
    - Garantir que o Admin recebe eventos WebSocket de `notification:new` (como Pastor) e `notification:status_updated` (como Secretário) simultaneamente
    - Garantir que o Admin pode emitir `notification:read` e criar notificações com as mesmas regras de validação
    - _Requisitos: 2b.1, 2b.2, 2b.3, 2b.4, 2b.5_

  - [x] 15.2 Configurar Express para servir o bundle React em produção
    - Adicionar `express.static` no `app.ts` para servir `packages/frontend/dist`
    - Adicionar rota catch-all `GET *` que retorna `index.html` para suporte a SPA routing
    - Adicionar script no `package.json` raiz para build completo (`frontend build` + `backend start`)
    - _Requisitos: Arquitetura geral_

  - [ ]* 15.3 Escrever testes de integração end-to-end dos fluxos principais
    - Testar fluxo completo: Secretário envia notificação → Pastor recebe via WebSocket em ≤ 2s → Pastor marca como lida → Secretário vê status atualizado em ≤ 2s
    - Testar fluxo de reconexão: desconectar Pastor → reconectar → verificar carregamento de notificações pendentes
    - _Requisitos: 5.3, 6.1, 7.2, 7.3, 6.7_

- [x] 16. Checkpoint Final — Verificar sistema completo
  - Garantir que todos os testes (unidade, integração, PBT, componentes) passem, consultar o usuário em caso de dúvidas.

---

## Notes

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia os requisitos específicos para rastreabilidade
- Os checkpoints garantem validação incremental a cada camada implementada
- Os testes de propriedade (PBT) cobrem todas as 18 propriedades de correção definidas no design
- Os testes unitários cobrem casos de borda e condições de erro específicos
- O design usa TypeScript tanto no backend quanto no frontend — sem ambiguidade de linguagem
- O monorepo permite compartilhar tipos entre pacotes na pasta `packages/shared` se necessário no futuro
- Templates padrão são criados via seed do Prisma e protegidos contra exclusão pela flag `isDefault = true`
- A limpeza diária de notificações antigas e de `LoginAttempt` é executada via cron job no backend

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.4"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["2.1", "2.2"] },
    { "id": 4, "tasks": ["2.3"] },
    { "id": 5, "tasks": ["2.4", "2.5", "2.6", "4.1"] },
    { "id": 6, "tasks": ["4.2", "5.1"] },
    { "id": 7, "tasks": ["4.3", "4.4", "4.5", "4.6", "4.7", "5.2", "6.1"] },
    { "id": 8, "tasks": ["5.3", "5.4", "5.5", "5.6", "6.2"] },
    { "id": 9, "tasks": ["6.3", "6.4", "6.5", "8.1"] },
    { "id": 10, "tasks": ["8.2", "8.3"] },
    { "id": 11, "tasks": ["8.4", "8.5", "8.6", "8.7", "8.8", "8.9", "9.1"] },
    { "id": 12, "tasks": ["9.2"] },
    { "id": 13, "tasks": ["9.3", "11.1"] },
    { "id": 14, "tasks": ["11.2"] },
    { "id": 15, "tasks": ["12.1", "13.1"] },
    { "id": 16, "tasks": ["12.2", "13.2", "13.3", "14.1"] },
    { "id": 17, "tasks": ["13.4", "14.2"] },
    { "id": 18, "tasks": ["13.5", "13.6", "14.3"] },
    { "id": 19, "tasks": ["14.4", "14.5", "14.6"] },
    { "id": 20, "tasks": ["15.1", "15.2"] },
    { "id": 21, "tasks": ["15.3"] }
  ]
}
```
