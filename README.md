
# Kanban API -  N-Multifibra

um sistema simples de kanban com backend de API REST em **golang (fiber)** e frontend em **html, css e javascript**. o projeto é feito para ser simples, rápido e executado localmente com uma configuração mínima.

- login e logout com cookie
- cards com CRUD
- colunas personalizadas
- mover cards com drag & drop
- banco sqlite gerado automaticamente
- API rápida com go + fiber
- [documentação da API no swagger](https://app.swaggerhub.com/apis-docs/tomazinc/n-multifibra_kanban_api/1.0.0)

---

## imagens

- login <br> <br>
  <img src="https://i.imgur.com/nAjDLKQ.jpeg" width="500"/><br><br>

- tela principal kanban <br> <br>
  <img src="https://i.imgur.com/l75pjmV.jpeg" width="500"/><br><br>

- modal nova tarefa <br> <br>
  <img src="https://i.imgur.com/GpLOSCf.jpeg" width="300"/><br><br>  

---

## resumo dos endpoints da API

### autenticação
- `post /login` – login com e-mail e senha (retorna cookie `auth_token`)
- `post /logout` – logout (remove cookie)

### boards
- `get /boards` – lista boards do usuário
- `post /boards` – cria novo board

### columns
- `get /boards/{id}/columns` – lista colunas de um board

### cards
- `get /columns/{id}/cards` – lista cards de uma coluna
- `post /columns/{id}/cards` – cria novo card
- `put /cards/{id}` – atualiza card
- `delete /cards/{id}` – deleta card
- `put /cards/{id}/move` – move card entre colunas

### segurança
autenticação via cookie (`auth_token`) usando esquema `cookieauth`.

---

## como rodar

1. verifique a versao do go (1.18+): [go.dev](https://go.dev/doc/install)
2. clona o projeto:
   ```bash
   git clone https://github.com/toomazs/nm-kanban-api.git
   cd nm-kanban-api
   ```
3. instala as dependências:
   ```bash
   go mod tidy
   ```
4. roda a aplicação:
   ```bash
   go run ./cmd/main.go
   ```
5. o projeto vai abrir no navegador automaticamente. caso não abra - digite no navegador: [http://localhost:8080](http://localhost:8080)

## usuários padrão para login estão dentro do `main.go`

---
