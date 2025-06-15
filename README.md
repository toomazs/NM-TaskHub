
# Kanban API -  N-MultiFibra

Um sistema simples de Kanban com backend de API REST em **Golang** usando framework Fiber e Frontend em **HTML, CSS e JavaScript**. O projeto é feito para ser simples, rápido e executado localmente com uma configuração mínima.

- Login e Logout com cookie
- Cards com CRUD
- Colunas personalizadas
- Mover cards com Drag & Drop
- Banco SQLite gerado automaticamente
- API rápida com Go + Fiber
- [Documentação da API no Swagger](https://app.swaggerhub.com/apis-docs/tomazinc/n-multifibra_kanban_api/1.0.0)

---

## Imagens

- Login <br> <br>
  <img src="https://i.imgur.com/nAjDLKQ.jpeg" width="500"/><br><br>

- Tela principal do Kanban <br> <br>
  <img src="https://i.imgur.com/l75pjmV.jpeg" width="500"/><br><br>

- Modal de Nova Tarefa <br> <br>
  <img src="https://i.imgur.com/GpLOSCf.jpeg" width="300"/><br><br>  

---

## Resumo dos Endpoints da API

### Autenticação
- `post /login` – login com e-mail e senha (retorna cookie `auth_token`)
- `post /logout` – logout (remove cookie)

### Boards
- `get /boards` – lista boards do usuário
- `post /boards` – cria novo board

### Columns
- `get /boards/{id}/columns` – lista colunas de um board

### Cards
- `get /columns/{id}/cards` – lista cards de uma coluna
- `post /columns/{id}/cards` – cria novo card
- `put /cards/{id}` – atualiza card
- `delete /cards/{id}` – deleta card
- `put /cards/{id}/move` – move card entre colunas

### Segurança
autenticação via cookie (`auth_token`) usando esquema `cookieauth`.

---

## Como rodar

1. Verifique a versão do GO (1.18+): [go.dev](https://go.dev/doc/install)
2. Clone o repositóri:
   ```bash
   git clone https://github.com/toomazs/nm-kanban-api.git
   cd nm-kanban-api
   ```
3. Instale as dependências:
   ```bash
   go mod tidy
   ```
4. Rode a aplicação:
   ```bash
   go run ./cmd/main.go
   ```
5. O projeto vai abrir no navegador automaticamente. Caso não abra - digite no navegador: [http://localhost:8080](http://localhost:8080)

## Usuários padrão para Login estão dentro do `main.go`

---
