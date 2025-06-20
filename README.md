# 💙 NM Kanban v1.0

NM Kanban é uma aplicação web full-stack de quadro Kanban, projetada para gerenciamento de tarefas e fluxos de trabalho de demandas da **N-MultiFibra**. A aplicação é construída com uma API RESTful de alta performance em Go (Golang) e um frontend dinâmico e reativo em Vanilla JavaScript, com atualizações em tempo real via WebSockets.

O sistema é modular, seguro e pronto para deploy em plataformas de nuvem modernas.

---

## 🚀 Principais Funcionalidades

-   **Autenticação de Usuários:** Sistema de login seguro utilizando Supabase Auth para gerenciamento de usuários e sessões via JWT.
-   **Gerenciamento de Quadros (Boards):** API completa para criação, leitura, atualização e exclusão (CRUD) de quadros, colunas e cards.
-   **Interface Drag & Drop:** Movimentação intuitiva de cards entre colunas com persistência imediata no banco de dados.
-   **Atualizações em Tempo Real:** Uso de WebSockets para refletir instantaneamente as alterações feitas por um usuário para todos os outros que estiverem visualizando o mesmo quadro.
-   **Edição Rica de Tarefas:** Modal detalhado para edição de tarefas com campos de prioridade, data de entrega, responsável e seções de comentários.
-   **Auto-Save Inteligente:** As alterações feitas no modal de edição de tarefas são salvas automaticamente em segundo plano, sem a necessidade de clicar em um botão "Salvar".
-   **Upload de Avatares:** Funcionalidade para upload de fotos de perfil de usuário, com armazenamento de arquivos em um serviço de object storage externo (Supabase Storage).
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

- Modal de Nova Tarefa <br> <br>
  <img src="https://i.imgur.com/WhSPzrM.png" width="550"/><br><br>  

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
-   **Comunicação com o BD:** Driver `pgx/v5` para PostgreSQL, otimizado para performance e segurança.

### Frontend

-   **Linguagem:** **Vanilla JavaScript (ES6+)**, utilizando `async/await` para uma comunicação assíncrona limpa.
-   **Estrutura:** **Single-Page Application (SPA)**, onde o conteúdo é carregado e renderizado dinamicamente sem recarregar a página.
-   **Bibliotecas:** `supabase-js` para interagir com a autenticação do Supabase.
-   **Estilização:** **CSS3** moderno com uso extensivo de Variáveis CSS para um tema customizável e layout baseado em Flexbox/Grid.
-   **Ícones:** Font Awesome.

---

## 🧑‍💻 Configuração do Ambiente Local

Para rodar este projeto em sua máquina local, siga os passos abaixo.

### Pré-requisitos

-   Go 1.21 ou superior.
-   Uma conta e um projeto criado na [Supabase](https://supabase.com/).

### Passos para Instalação

1.  **Clone o repositório:**
    ```bash
    git clone [https://github.com/toomazs/NM-Kanban-API.git](https://github.com/toomazs/NM-Kanban-API.git)
    cd seu-repositorio
    ```

2.  **Crie o arquivo de ambiente:**
    Crie um arquivo chamado `.env` na raiz do projeto e adicione as seguintes variáveis, substituindo pelos valores do seu projeto Supabase:
    ```env
    # Encontrado em Project Settings > Database > Connection string
    DATABASE_URL="postgres://..."

    # Encontrado em Project Settings > API > Project API keys
    SUPABASE_JWT_SECRET="seu_jwt_secret"
    SUPABASE_PROJECT_URL="[https://seu-id.supabase.co](https://seu-id.supabase.co)"
    SUPABASE_SERVICE_KEY="sua_service_role_key"
    ```

3.  **Instale as dependências:**
    ```bash
    go mod tidy
    ```

4.  **Execute a aplicação:**
    ```bash
    go run main.go
    ```

    O servidor será iniciado localmente na porta `8080` e uma aba do navegador será aberta automaticamente.

---

## 🌐 Documentação da API

A API segue os princípios RESTful e a maioria das rotas é protegida por um middleware de autenticação que valida o token JWT do Supabase.
[Clique para ver em Swagger](https://app.swaggerhub.com/apis-docs/tomazinc/n-multifibra_kanban_api/1.0.0).

### Middleware

-   `authMiddleware`: Valida o `Bearer Token` em cada requisição para rotas protegidas, extraindo o `userID` e o injetando no contexto da requisição.
-   **Middleware Padrão (Fiber):** `Logger` para logs de requisição, `Recover` para prevenir que a aplicação quebre em caso de `panic`, e `CORS` para controle de acesso de origens cruzadas.

### Endpoints

| Método   | Rota                    | Descrição                                         | Protegida |
| :------- | :---------------------- | :------------------------------------------------ | :-------- |
| `GET`    | `/api/users`            | Retorna a lista de todos os usuários.             | Sim       |
| `GET`    | `/api/boards`           | Retorna os quadros do usuário logado.             | Sim       |
| `GET`    | `/api/boards/:id/columns` | Retorna as colunas de um quadro específico.         | Sim       |
| `GET`    | `/api/columns/:id/cards`  | Retorna os cards de uma coluna específica.          | Sim       |
| `POST`   | `/api/columns`          | Cria uma nova coluna.                             | Sim       |
| `POST`   | `/api/columns/:id/cards`  | Cria um novo card em uma coluna.                  | Sim       |
| `POST`   | `/api/user/avatar`      | Realiza o upload do avatar do usuário.            | Sim       |
| `PUT`    | `/api/cards/:id`        | Atualiza os dados de um card.                     | Sim       |
| `PUT`    | `/api/cards/:id/move`   | Move um card para outra coluna ou posição.        | Sim       |
| `DELETE` | `/api/cards/:id`        | Deleta um card.                                   | Sim       |
| `DELETE` | `/api/columns/:id`      | Deleta uma coluna (apenas se estiver vazia).      | Sim       |

---

## ⬆️ Deploy

A aplicação está configurada para deploy em plataformas como a **Render**.

-   **Build Command:** `go build -tags netgo -ldflags '-s -w' -o app`
-   **Start Command:** `./app`
-   As **Variáveis de Ambiente** (`DATABASE_URL`, `SUPABASE_JWT_SECRET`, etc.) devem ser configuradas diretamente no painel de controle da plataforma de hospedagem.
