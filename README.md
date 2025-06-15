
# kanban API -  n-multifibra

um sistema simples de kanban com backend em **golang (fiber)** e frontend em **html, css e javascript**. o projeto é feito para ser simples, rápido e executado localmente com uma configuração mínima.

- login e logout com cookie
- usuários padrão já cadastrados
- cards com CRUD (criar, ler, editar, excluir)
- colunas personalizadas
- mover cards com drag & drop
- banco sqlite gerado automaticamente
- API rápida com go + fiber
- frontend leve e direto
- documentação da api no swagger (`openapi.yaml`) - [doc swagger](https://app.swaggerhub.com/apis-docs/tomazinc/n-multifibra_kanban_api/1.0.0)

---

## como rodar

1. instala o go (1.18+): [go.dev](https://go.dev/doc/install)
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

---

## usuários padrão para login

| usuário   | email                   | senha        | permissão |
|-----------|-------------------------|--------------|-----------|
| admin     | admin@kanban.local      | admin123     | admin     |
| eduardo   | eduardo@kanban.local    | nm12345678   | usuário   |
| marques   | marques@kanban.local    | nm12345678   | usuário   |
| rosa      | rosa@kanban.local       | nm12345678   | usuário   |
| miyake    | miyake@kanban.local     | nm12345678   | usuário   |
| gomes     | gomes@kanban.local      | nm12345678   | usuário   |
| pedro     | pedro@kanban.local      | nm12345678   | usuário   |
| rodrigo   | rodrigo@kanban.local    | nm12345678   | usuário   |
| rubens    | rubens@kanban.local     | nm12345678   | usuário   |

