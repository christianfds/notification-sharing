# Requirements Document

## Introduction

O sistema de compartilhamento de notificações para cultos religiosos permite que secretários enviem avisos e comunicados em tempo real para o pastor durante o culto, por meio de um painel de secretaria e um painel de visualização em dispositivo móvel ou tablet. O Administrador possui acesso completo ao sistema: gerencia contas de usuários e também pode exercer todas as funções do Secretário (envio de notificações, categorias, templates e histórico) e do Pastor (recebimento de notificações e marcação como lidas). O sistema oferece categorização de notificações, uso de templates pré-definidos e confirmação de leitura pelo pastor.

## Glossary

- **Sistema**: O sistema de compartilhamento de notificações como um todo.
- **Administrador**: O superusuário do sistema. Gerencia contas de usuários (criação, edição e desativação de contas de Secretário e Pastor) e possui acesso completo às funcionalidades do Secretário e do Pastor.
- **Secretário**: O secretário ou secretária responsável por enviar notificações, gerenciar categorias e templates durante o culto.
- **Pastor**: O pastor ou celebrante que recebe e visualiza as notificações em seu dispositivo. Também referenciado como Cliente no contexto da interface de recebimento.
- **Cliente**: Sinônimo de Pastor no contexto do Painel_Pastor.
- **Notificação**: Uma mensagem criada pelo Secretário e entregue ao Pastor.
- **Categoria**: Um grupo lógico que classifica as notificações (ex: Aniversariantes, Pedido de Oração, Avisos Gerais).
- **Template**: Um modelo pré-definido de notificação que o Secretário pode utilizar para agilizar a criação de mensagens.
- **Painel_Admin**: Interface do Administrador que consolida o gerenciamento de contas de usuários e todo o acesso ao Painel_Secretário e ao Painel_Pastor.
- **Painel_Secretário**: Interface do Secretário para criar, categorizar e enviar notificações, gerenciar categorias, templates e visualizar histórico.
- **Painel_Pastor**: Interface do Pastor para visualizar e marcar notificações como lidas.
- **Canal_Tempo_Real**: Mecanismo de comunicação bidirecional que entrega notificações ao Pastor sem necessidade de atualização manual da página.

---

## Requirements

### Requisito 1: Autenticação de Usuários

**User Story:** Como usuário do sistema, quero fazer login com credenciais seguras, para que apenas pessoas autorizadas acessem o sistema durante o culto.

#### Critérios de Aceitação

1. THE Sistema SHALL suportar três perfis de acesso: Administrador, Secretário e Pastor.
2. WHEN um usuário fornece nome de usuário e senha correspondentes a um registro ativo no sistema, THE Sistema SHALL conceder acesso ao painel correspondente ao perfil desse registro; usuários com perfil Administrador SHALL ter acesso ao Painel_Admin, ao Painel_Secretário e ao Painel_Pastor.
3. IF um usuário fornece nome de usuário ou senha que não correspondem a nenhum registro ativo, THEN THE Sistema SHALL exibir uma mensagem de erro indicando credenciais inválidas, negar o acesso e registrar a tentativa falha.
4. IF um usuário realiza 5 tentativas de login com credenciais inválidas consecutivas para o mesmo nome de usuário, THEN THE Sistema SHALL bloquear novas tentativas de login para esse nome de usuário por 15 minutos e exibir uma mensagem indicando o bloqueio temporário.
5. WHEN uma sessão de usuário permanece inativa por 8 horas, THE Sistema SHALL exibir uma notificação informando o encerramento da sessão, encerrar a sessão automaticamente e redirecionar o usuário para a tela de login.

---

### Requisito 2: Gerenciamento de Usuários

**User Story:** Como Administrador, quero criar, editar e desativar contas de Secretário e Pastor, para que apenas pessoas autorizadas tenham acesso ao sistema com o perfil correto.

#### Critérios de Aceitação

1. THE Painel_Admin SHALL permitir que o Administrador crie novas contas com perfil Secretário ou Pastor, informando nome de usuário único (case-insensitive) com entre 3 e 50 caracteres não-espaço e senha inicial com no mínimo 8 caracteres.
2. WHEN o Administrador submete uma nova conta com nome de usuário único e dados válidos, THE Sistema SHALL salvar a conta com status ativo e exibi-la imediatamente na listagem de usuários.
3. IF o Administrador tenta criar uma conta com um nome de usuário já existente (case-insensitive), THEN THE Sistema SHALL exibir uma mensagem de erro informando o conflito e não salvar a conta.
4. WHEN o Administrador submete a edição de uma conta existente com dados válidos, THE Sistema SHALL salvar as alterações e refletir as mudanças imediatamente na listagem de usuários.
5. WHEN o Administrador desativa uma conta de usuário, THE Sistema SHALL alterar o status da conta para inativo, impedir que o usuário realize novos logins e encerrar a sessão ativa desse usuário, se houver.
6. IF o Administrador tenta desativar a própria conta de Administrador, THEN THE Sistema SHALL negar a operação e exibir uma mensagem informando que a conta ativa de Administrador não pode ser desativada.
7. THE Painel_Admin SHALL listar todas as contas de usuários com nome de usuário, perfil e status (ativo/inativo), em ordem alfabética por nome de usuário.
8. THE Painel_Admin SHALL permitir que o Administrador reative uma conta previamente desativada.

---

### Requisito 2b: Permissões Elevadas do Administrador

**User Story:** Como Administrador, quero ter acesso completo a todas as funcionalidades do sistema, para que eu possa operar como Secretário ou Pastor quando necessário.

#### Critérios de Aceitação

1. THE Sistema SHALL conceder ao Administrador acesso a todas as funcionalidades do Secretário: criar, editar e excluir categorias e templates, criar e enviar notificações, e visualizar o histórico de notificações.
2. THE Sistema SHALL conceder ao Administrador acesso a todas as funcionalidades do Pastor: receber notificações em tempo real pelo Canal_Tempo_Real e marcar notificações como lidas.
3. WHEN o Administrador envia uma notificação, THE Sistema SHALL processar o envio com as mesmas regras de validação e entrega aplicadas ao Secretário.
4. WHEN o Administrador marca uma notificação como lida, THE Sistema SHALL processar a marcação com as mesmas regras aplicadas ao Pastor.
5. THE Painel_Admin SHALL oferecer navegação para as visões do Painel_Secretário e do Painel_Pastor sem necessidade de novo login.

---

### Requisito 3: Gerenciamento de Categorias

**User Story:** Como Secretário, quero criar e atualizar categorias de notificação, para que as notificações sejam organizadas de forma clara e fácil de identificar durante o culto.

#### Critérios de Aceitação

1. THE Painel_Secretário SHALL permitir que o Secretário crie novas categorias com um nome contendo entre 1 e 50 caracteres não-espaço.
2. WHEN o Secretário submete uma nova categoria com nome único (case-insensitive), THE Sistema SHALL salvar a categoria e exibi-la imediatamente na listagem de categorias.
3. IF o Secretário tenta criar uma categoria com um nome já existente (case-insensitive), THEN THE Sistema SHALL exibir uma mensagem de erro informando o conflito e não salvar a categoria.
4. WHEN o Secretário submete a edição do nome de uma categoria existente com um nome válido e único, THE Sistema SHALL salvar a alteração e atualizar o nome em todas as referências existentes.
5. WHEN o Secretário exclui uma categoria, THE Sistema SHALL remover a categoria da listagem, impedir sua atribuição a novas notificações e manter as notificações existentes associadas a essa categoria sem alteração de conteúdo.
6. THE Painel_Secretário SHALL listar todas as categorias em ordem alfabética.
7. IF o Secretário tenta editar o nome de uma categoria para um nome já existente (case-insensitive), THEN THE Sistema SHALL exibir uma mensagem de erro informando o conflito e não salvar a alteração.

---

### Requisito 4: Gerenciamento de Templates

**User Story:** Como Secretário, quero criar e utilizar templates de notificações, para que eu possa enviar mensagens padronizadas de forma rápida durante o culto.

#### Critérios de Aceitação

1. THE Sistema SHALL fornecer ao menos os seguintes templates padrão: "Aniversariantes", "Pedido de Oração" e "Aviso Geral".
2. THE Painel_Secretário SHALL permitir que o Secretário crie novos templates com título de até 100 caracteres e corpo de texto de até 500 caracteres, ambos obrigatórios e com ao menos 1 caractere não-espaço.
3. IF o Secretário submete um novo template com título ou corpo vazio, THEN THE Sistema SHALL exibir uma mensagem de validação indicando o campo faltante e não salvar o template.
4. WHEN o Secretário seleciona um template para uso, THE Painel_Secretário SHALL preencher os campos de título e corpo do formulário de nova notificação com o conteúdo do template, mantendo os campos editáveis.
5. WHEN o Secretário submete a edição de um template existente com título e corpo válidos, THE Sistema SHALL salvar o conteúdo atualizado sem alterar notificações previamente enviadas com base nesse template.
6. THE Painel_Secretário SHALL permitir que o Secretário exclua templates criados pelo Secretário.
7. IF o Secretário tenta excluir um template padrão do sistema, THEN THE Sistema SHALL negar a exclusão e exibir uma mensagem informando que templates padrão não podem ser excluídos.

---

### Requisito 5: Criação e Envio de Notificações

**User Story:** Como Secretário, quero criar e enviar notificações categorizadas durante o culto, para que o pastor receba os avisos necessários em tempo real.

#### Critérios de Aceitação

1. THE Painel_Secretário SHALL permitir que o Secretário crie uma notificação com título de até 100 caracteres, corpo de texto de até 500 caracteres e uma categoria obrigatória selecionada da lista de categorias disponíveis.
2. WHEN o Secretário submete uma notificação válida, THE Sistema SHALL registrar a notificação com data e hora de envio.
3. WHEN o Secretário submete uma notificação válida, THE Sistema SHALL enviá-la ao Painel_Pastor em até 2 segundos.
4. IF o envio da notificação ao Painel_Pastor falhar, THEN THE Sistema SHALL exibir uma mensagem de erro no Painel_Secretário indicando falha na entrega e registrar o erro.
5. IF o Secretário submete uma notificação sem categoria selecionada, THEN THE Sistema SHALL exibir uma mensagem de validação indicando que a categoria é obrigatória e impedir o envio.
6. IF o Secretário submete uma notificação com título ou corpo vazio, THEN THE Sistema SHALL exibir uma mensagem de validação indicando o campo faltante e impedir o envio.
7. WHEN o Secretário abre o Painel_Secretário na sessão atual, THE Painel_Secretário SHALL exibir a lista de notificações enviadas na sessão atual em ordem cronológica decrescente.
8. WHERE um template estiver disponível, THE Painel_Secretário SHALL permitir que o Secretário inicie a criação de uma notificação a partir de um template, preenchendo os campos de título e corpo com o conteúdo do template selecionado.

---

### Requisito 6: Recebimento de Notificações em Tempo Real

**User Story:** Como Pastor, quero receber notificações em tempo real no meu dispositivo, para que eu tome ciência dos avisos sem interromper o fluxo do culto.

#### Critérios de Aceitação

1. WHEN o Secretário envia uma notificação, THE Canal_Tempo_Real SHALL entregar a notificação ao Painel_Pastor em até 2 segundos.
2. WHEN uma nova notificação não lida é recebida, THE Painel_Pastor SHALL exibir um contador de notificações não lidas no cabeçalho do painel, incrementando a contagem a cada nova notificação recebida.
3. WHEN uma nova notificação é recebida e o dispositivo do Pastor suporta áudio, THE Painel_Pastor SHALL emitir um alerta sonoro.
4. WHEN uma nova notificação é recebida e o dispositivo do Pastor não suporta áudio mas suporta vibração, THE Painel_Pastor SHALL acionar a vibração do dispositivo.
5. WHEN o Pastor abre o Painel_Pastor, THE Painel_Pastor SHALL exibir as notificações em ordem cronológica decrescente, com título, categoria e hora de envio.
6. WHILE o Pastor estiver com o Painel_Pastor aberto, THE Canal_Tempo_Real SHALL manter a conexão ativa e entregar novas notificações sem necessidade de ação do Pastor.
7. IF a conexão com o Canal_Tempo_Real for interrompida, THEN THE Painel_Pastor SHALL exibir um indicador de perda de conexão e tentar reconectar automaticamente em intervalos de 5 segundos, por no máximo 5 tentativas.
8. IF o Canal_Tempo_Real não conseguir reconectar após 5 tentativas, THEN THE Painel_Pastor SHALL exibir uma mensagem informando que a conexão foi perdida e solicitar ação manual do Pastor para tentar novamente.

---

### Requisito 7: Marcação de Notificações como Lidas

**User Story:** Como Pastor, quero marcar notificações como lidas, para que eu e o Secretário saibamos quais avisos já foram processados durante o culto.

#### Critérios de Aceitação

1. WHEN o Pastor interage com uma notificação não lida no Painel_Pastor, THE Painel_Pastor SHALL permitir que o Pastor marque essa notificação como lida.
2. WHEN o Pastor marca uma notificação como lida, THE Sistema SHALL registrar o horário de leitura no fuso horário local do servidor e atualizar o estado da notificação para "lida".
3. WHEN o Pastor marca uma notificação como lida, THE Painel_Secretário SHALL refletir o estado atualizado da notificação em até 2 segundos.
4. IF o Painel_Secretário não refletir o estado atualizado em até 2 segundos devido a falha de comunicação, THEN THE Sistema SHALL registrar o erro e tentar reenviar a atualização de estado.
5. THE Painel_Pastor SHALL exibir notificações não lidas com destaque visual distinto (ex: fundo diferenciado ou ícone de não lido) e notificações lidas sem esse destaque.
6. THE Painel_Secretário SHALL exibir o status de leitura (lida/não lida e horário de leitura quando aplicável) de cada notificação enviada.
7. WHEN o Pastor tenta marcar como lida uma notificação já marcada como lida, THE Sistema SHALL ignorar a ação sem exibir mensagem de erro.

---

### Requisito 8: Histórico de Notificações

**User Story:** Como Secretário, quero visualizar o histórico de notificações enviadas, para que eu possa consultar os avisos comunicados durante cultos anteriores.

#### Critérios de Aceitação

1. THE Painel_Secretário SHALL manter um histórico de todas as notificações enviadas, persistido entre sessões, por no mínimo 12 meses a partir da data de envio.
2. THE Painel_Secretário SHALL permitir que o Secretário filtre o histórico por categoria e por intervalo de datas de até 31 dias corridos.
3. WHEN o Secretário aplica filtros de pesquisa, THE Sistema SHALL retornar os resultados em até 3 segundos.
4. THE Painel_Secretário SHALL exibir no histórico: título, categoria, data/hora de envio e status de leitura de cada notificação.
5. IF nenhuma notificação corresponder aos filtros aplicados, THEN THE Painel_Secretário SHALL exibir uma mensagem informando que nenhum resultado foi encontrado.
6. THE Painel_Secretário SHALL exibir os resultados do histórico em páginas de no máximo 50 notificações, com controles de navegação entre páginas.