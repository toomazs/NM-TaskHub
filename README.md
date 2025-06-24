# 💙 NM Kanban v2.0 (React)

NM Kanban é uma aplicação web full-stack de quadro Kanban, projetada para gerenciamento de tarefas e fluxos de trabalho de demandas da **N-MultiFibra**. A aplicação foi modernizada, utilizando uma API RESTful de alta performance em Go (Golang) e um frontend dinâmico e reativo construído com **React, TypeScript e Vite**, com atualizações em tempo real via WebSockets.

O sistema é modular, seguro, performático e pronto para deploy em plataformas de nuvem modernas.

---

## 🚀 Principais Funcionalidades

-   **Autenticação de Usuários:** Sistema de login seguro utilizando Supabase Auth para gerenciamento de usuários e sessões via JWT.
-   **Gerenciamento Completo (CRUD):** API completa para criação, leitura, atualização e exclusão de quadros, colunas e cards.
-   **Interface Drag & Drop Avançada:** Movimentação intuitiva de cards entre colunas e reordenação de colunas, com persistência imediata no banco de dados, utilizando a biblioteca `@dnd-kit` para máxima performance e acessibilidade.
-   **Atualizações em Tempo Real:** Uso de WebSockets para refletir instantaneamente as alterações feitas por um usuário para todos os outros que estiverem visualizando o mesmo quadro.
-   **Edição Rica de Tarefas:** Modal detalhado para edição de tarefas com campos de prioridade, data de entrega, responsável e seções de comentários.
-   **Auto-Save Inteligente:** As alterações feitas no modal de edição de tarefas são salvas automaticamente em segundo plano, sem a necessidade de clicar em um botão "Salvar".
-   **Dashboard de Analytics:** Uma página dedicada com gráficos e métricas sobre a produtividade, status de tarefas e performance da equipe.
-   **Notificações e Convites:** Sistema de notificações para convites de quadros e atribuição de tarefas.
-   **Upload de Avatares:** Funcionalidade para upload de fotos de perfil de usuário, com armazenamento de arquivos no Supabase Storage.
-   **Design Responsivo:** Interface adaptável para uso em desktops e dispositivos móveis.

---

## 📷 Imagens

<details>
  <summary> Clique para ver </summary>

- Login <br> <br>
  <img src="https://i.imgur.com/16a5u0j.png" width="500"/><br><br>

- Aba Suporte <br> <br>
  <img src="https://i.imgur.com/Q02j193.png" width="500"/><br><br>

- Cards e Prioridade por Cor <br> <br>
  <img src="https://i.imgur.com/3SHH9P9.png" width="400"/><br><br>

- Cards com Data de Entrega longe, próxima ou atrasada <br> <br>
  <img src="https://i.imgur.com/qKiTeHi.png" width="400"/><br><br>  

- Modal de Editar Tarefa <br> <br>
  <img src="https://i.imgur.com/N3BYWMB.png" width="550"/><br><br>  

</details>

---

## 💻 Tecnologias Utilizadas

A aplicação utiliza uma arquitetura moderna e eficiente, separando claramente as responsabilidades entre o backend e o frontend.

### Backend

-   **Linguagem:** **Go (Golang)**
-   **Framework Web:** **Fiber v2**, um framework web de alta performance inspirado no Express.js.
-   **Banco de Dados:** **PostgreSQL**, gerenciado pela plataforma Supabase.
-   **Autenticação e Armazenamento:** **Supabase** (Auth para usuários, Storage para arquivos e Database).
-   **Comunicação em Tempo Real:** **WebSockets** (`gofiber/websocket/v2`).
-   **Comunicação com o BD:** Driver `pgx/v5` para PostgreSQL.

### Frontend

-   **Framework/Linguagem:** **React** com **TypeScript**, garantindo um código robusto, tipado e escalável.
-   **Build Tool:** **Vite**, para um ambiente de desenvolvimento ultrarrápido e um processo de build otimizado.
-   **Estrutura:** **Single-Page Application (SPA)** com arquitetura baseada em componentes.
-   **Bibliotecas Principais:**
    -   `react-router-dom` para roteamento.
    -   `@dnd-kit` para drag-and-drop de alta performance.
    -   `recharts` para a criação de gráficos no dashboard.
    -   `react-hot-toast` para notificações.
    -   `supabase-js` para interagir com a autenticação do Supabase.
-   **Estilização:** **CSS3** moderno com uso extensivo de Variáveis CSS para um tema escuro customizável e layout baseado em Flexbox/Grid.
-   **Ícones:** Font Awesome.

---

## 🧑‍💻 Configuração do Ambiente Local

Para rodar este projeto em sua máquina local, siga os passos abaixo.

### Pré-requisitos

-   Go 1.21 ou superior.
-   Node.js v18 ou superior.
-   Uma conta e um projeto criado na [Supabase](https://supabase.com/).

### Passos para Instalação

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/toomazs/NM-Kanban-API.git
    cd NM-Kanban-API
    ```

2.  **Configure o Backend:**
    * Crie um arquivo chamado `.env` na raiz do projeto.
    * Adicione as seguintes variáveis, substituindo pelos valores do seu projeto Supabase:
        ```env
        DATABASE_URL="postgres://..."
        SUPABASE_JWT_SECRET="seu_jwt_secret"
        SUPABASE_PROJECT_URL="[https://seu-id.supabase.co](https://seu-id.supabase.co)"
        SUPABASE_SERVICE_KEY="sua_service_role_key"
        ```
    * Instale as dependências do Go:
        ```bash
        go mod tidy
        ```

3.  **Configure o Frontend:**
    * Navegue até a pasta do frontend:
        ```bash
        cd react-frontend
        ```
    * Instale as dependências do Node.js:
        ```bash
        npm install
        ```

4.  **Execute a Aplicação (2 Terminais):**
    * **Terminal 1 (Backend):** Na raiz do projeto, inicie o servidor Go.
        ```bash
        go run main.go
        ```
        O servidor backend estará rodando em `http://localhost:8080`.

    * **Terminal 2 (Frontend):** Na pasta `react-frontend`, inicie o servidor de desenvolvimento do Vite.
        ```bash
        npm run dev
        ```
        A aplicação estará acessível em `http://localhost:5173`.

---

## 🌐 **Endpoints da API**

Todos os endpoints listados abaixo estão no grupo `/api` e são protegidos, ou seja, exigem um token de autenticação JWT válido no cabeçalho `Authorization`. <br>
[Clique para ver em Swagger](https://app.swaggerhub.com/apis-docs/tomazinc/n-multifibra_kanban_api/2.0.0).

#### Usuários e Autenticação
| Método HTTP | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/api/users` | Retorna a lista de todos os usuários do sistema. |
| `POST` | `/api/user/avatar` | Realiza o upload do avatar para o usuário autenticado. |

#### Quadros (Boards)
| Método HTTP | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/api/boards/public` | Busca o quadro público principal. |
| `GET` | `/api/boards/private` | Busca os quadros privados do usuário (criados por ele ou compartilhados com ele). |
| `POST` | `/api/boards` | Cria um novo quadro privado. |
| `DELETE` | `/api/boards/:id` | Deleta um quadro privado (apenas o dono pode fazer isso). |
| `POST` | `/api/boards/:id/leave` | Permite que um usuário saia de um quadro do qual é membro. |

#### Colunas (Columns)
| Método HTTP | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/api/boards/:id/columns` | Busca todas as colunas de um quadro específico. |
| `POST` | `/api/boards/:id/columns/reorder` | Reordena a posição das colunas em um quadro. |
| `POST` | `/api/columns` | Cria uma nova coluna em um quadro. |
| `PUT` | `/api/columns/:id` | Atualiza os dados de uma coluna (título, cor). |
| `DELETE` | `/api/columns/:id` | Deleta uma coluna (somente se estiver vazia). |

#### Cards (Tarefas)
| Método HTTP | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/api/columns/:id/cards` | Busca todos os cards de uma coluna específica. |
| `POST` | `/api/columns/:id/cards` | Cria um novo card em uma coluna específica. |
| `PUT` | `/api/cards/:id` | Atualiza os dados de um card (título, descrição, prioridade, etc.). |
| `DELETE` | `/api/cards/:id` | Deleta um card. |
| `POST` | `/api/cards/move` | Move um card para uma nova coluna ou uma nova posição na mesma coluna. |

#### Membros e Convites
| Método HTTP | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/api/boards/:id/members` | Retorna a lista de membros de um quadro. |
| `DELETE` | `/api/boards/:boardId/members/:memberId` | Remove um membro de um quadro (apenas o dono). |
| `GET` | `/api/boards/:id/invitable-users` | Retorna uma lista de usuários que podem ser convidados para um quadro. |
| `POST` | `/api/boards/:id/invite` | Envia um convite para um usuário se juntar a um quadro. |
| `POST` | `/api/invitations/:id/respond` | Permite que um usuário aceite ou recuse um convite para um quadro. |

#### Notificações
| Método HTTP | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/api/notifications` | Busca todas as notificações do usuário logado. |
| `POST` | `/api/notifications/:id/read` | Marca uma notificação específica como lida. |
| `POST` | `/api/notifications/mark-all-as-read` | Marca todas as notificações (exceto convites) como lidas. |

---

## ⬆️ Deploy no Render

A aplicação está configurada e pronta para deploy na plataforma **Render**.

-   **Build Command:**
    ```bash
    cd react-frontend && npm install && npm run build && cd .. && go build -tags netgo -ldflags '-s -w' -o app
    ```
-   **Start Command:**
    ```bash
    ./app
    ```
-   As **Variáveis de Ambiente** (`DATABASE_URL`, `SUPABASE_JWT_SECRET`, etc.) devem ser configuradas diretamente no painel de controle do seu serviço no Render.
