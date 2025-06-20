package main

import (
	"bytes"
	"context"
	"database/sql"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/filesystem"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/template/html/v2"
	"github.com/gofiber/websocket/v2"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

//go:embed frontend/templates/*.html
var templates embed.FS

//go:embed frontend/static/*
var static embed.FS

// estrutura User
type User struct {
	ID        string    `json:"id" db:"id"`
	Username  string    `json:"username" db:"username"`
	Email     string    `json:"email" db:"email"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	Avatar    string    `json:"avatar" db:"avatar"`
	Role      string    `json:"role" db:"role"`
}

// estrutura Board
type Board struct {
	ID          int       `json:"id" db:"id"`
	Title       string    `json:"title" db:"title"`
	Description string    `json:"description" db:"description"`
	OwnerID     string    `json:"owner_id" db:"owner_id"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
	Color       string    `json:"color" db:"color"`
	IsPublic    bool      `json:"is_public" db:"is_public"`
}

// estrutura Column
type Column struct {
	ID       int    `json:"id" db:"id"`
	BoardID  int    `json:"board_id" db:"board_id"`
	Title    string `json:"title" db:"title"`
	Position int    `json:"position" db:"position"`
	Color    string `json:"color" db:"color"`
}

// estrutura Card
type Card struct {
	ID          int        `json:"id" db:"id"`
	ColumnID    int        `json:"column_id" db:"column_id"`
	Title       string     `json:"title" db:"title"`
	Description string     `json:"description" db:"description"`
	AssignedTo  string     `json:"assigned_to" db:"assigned_to"`
	Priority    string     `json:"priority" db:"priority"`
	DueDate     *time.Time `json:"due_date" db:"due_date"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
	Position    int        `json:"position" db:"position"`
}

// estrutura WsMessage
type WsMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// estrutura principal da App
type App struct {
	db      *pgxpool.Pool
	clients map[int]map[*websocket.Conn]bool
}

// estrutura para claims do Supabase JWT
type SupabaseClaims struct {
	UserID string `json:"sub"`
	jwt.RegisteredClaims
}

// estabelece a conexão com o banco de dados
func (app *App) connectDB() error {
	config, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if err != nil {
		return fmt.Errorf("não foi possível parsear a URL do banco: %w", err)
	}

	config.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeExec

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		return fmt.Errorf("não foi possível conectar ao banco de dados: %w", err)
	}

	if err := pool.Ping(context.Background()); err != nil {
		return fmt.Errorf("não foi possível pingar o banco de dados: %w", err)
	}

	app.db = pool
	return nil
}

// authMiddleware lida com a validação do token JWT
func (app *App) authMiddleware(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Cabeçalho de autorização ausente"})
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || parts[0] != "Bearer" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Formato de autorização inválido. Esperado: Bearer <token>"})
	}
	tokenString := parts[1]

	jwtSecret := os.Getenv("SUPABASE_JWT_SECRET")
	if jwtSecret == "" {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Configuração do servidor incorreta"})
	}

	token, err := jwt.ParseWithClaims(tokenString, &SupabaseClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("método de assinatura inesperado: %v", token.Header["alg"])
		}
		return []byte(jwtSecret), nil
	}, jwt.WithAudience("authenticated"))

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Token expirado"})
		}
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Token inválido"})
	}

	if !token.Valid {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Token inválido ou expirado"})
	}

	claims, ok := token.Claims.(*SupabaseClaims)
	if !ok || claims.UserID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Claims do token inválidas ou ID de usuário ausente"})
	}

	c.Locals("userID", claims.UserID)
	return c.Next()
}

// gerencia novas conexões de WebSocket
func (app *App) handleWebSocket(c *websocket.Conn) {
	boardID, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		c.Close()
		return
	}

	if app.clients[boardID] == nil {
		app.clients[boardID] = make(map[*websocket.Conn]bool)
	}
	app.clients[boardID][c] = true

	defer func() {
		delete(app.clients[boardID], c)
		if len(app.clients[boardID]) == 0 {
			delete(app.clients, boardID)
		}
		c.Close()
	}()
	for {
		if _, _, err := c.ReadMessage(); err != nil {
			break
		}
	}
}

// broadcast envia uma mensagem para todos os clientes conectados a um board
func (app *App) broadcast(boardID int, message WsMessage) {
	if clients, ok := app.clients[boardID]; ok {
		payloadBytes, _ := json.Marshal(message)
		for client := range clients {
			if err := client.WriteMessage(websocket.TextMessage, payloadBytes); err != nil {
				client.Close()
				delete(clients, client)
			}
		}
	}
}

// processa o upload do arquivo de avatar
func (app *App) handleAvatarUpload(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	file, err := c.FormFile("avatar")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Nenhum arquivo de avatar enviado"})
	}

	contentType := file.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Formato de arquivo inválido. Apenas imagens são permitidas."})
	}

	src, err := file.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao abrir o arquivo"})
	}
	defer src.Close()

	fileBytes, err := io.ReadAll(src)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao ler o arquivo"})
	}

	ext := filepath.Ext(file.Filename)
	fileName := fmt.Sprintf("avatar-%s%s", userID, ext)

	supabaseURL := os.Getenv("SUPABASE_PROJECT_URL")
	supabaseKey := os.Getenv("SUPABASE_SERVICE_KEY")

	uploadURL := fmt.Sprintf("%s/storage/v1/object/avatars/%s", supabaseURL, fileName)

	req, err := http.NewRequest("POST", uploadURL, bytes.NewReader(fileBytes))
	if err != nil {
		log.Printf("❌ Erro ao criar requisição para o Supabase: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro interno ao preparar upload"})
	}

	req.Header.Set("Authorization", "Bearer "+supabaseKey)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("x-upsert", "true")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ Erro ao fazer upload para o Supabase: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro interno ao fazer upload"})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("❌ Supabase retornou status não-OK: %s, Body: %s", resp.Status, string(body))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Falha ao armazenar o arquivo"})
	}

	publicURL := fmt.Sprintf("%s/storage/v1/object/public/avatars/%s", supabaseURL, fileName)

	query := `
		UPDATE auth.users
		SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('avatar_url', $1::text)
		WHERE id = $2
	`
	_, err = app.db.Exec(context.Background(), query, publicURL, userID)
	if err != nil {
		log.Printf("❌ Erro ao atualizar o avatar do usuário no DB: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao atualizar perfil"})
	}

	return c.JSON(fiber.Map{"avatar_url": publicURL})
}

// obtém o ID do board a partir de um ID de card
func (app *App) getBoardIDFromCard(cardID int) (int, error) {
	var boardID int
	query := `SELECT c.board_id FROM columns c
			  INNER JOIN cards ca ON c.id = ca.column_id
			  WHERE ca.id = $1`

	err := app.db.QueryRow(context.Background(), query, cardID).Scan(&boardID)
	if err != nil {
		return 0, err
	}
	return boardID, nil
}

// cria uma nova coluna
func (app *App) createColumn(c *fiber.Ctx) error {
	var col Column
	if err := c.BodyParser(&col); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "dados de coluna inválidos"})
	}

	if col.BoardID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "board_id é obrigatório"})
	}

	var maxPos sql.NullInt64
	err := app.db.QueryRow(context.Background(),
		"SELECT MAX(position) FROM columns WHERE board_id = $1", col.BoardID).Scan(&maxPos)
	if err != nil {
		maxPos.Int64 = -1
	}
	col.Position = int(maxPos.Int64) + 1

	query := `
        INSERT INTO columns (board_id, title, position, color)
        VALUES ($1, $2, $3, $4)
        RETURNING id
    `
	err = app.db.QueryRow(context.Background(), query,
		col.BoardID, col.Title, col.Position, col.Color).Scan(&col.ID)

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "erro ao criar coluna"})
	}

	app.broadcast(col.BoardID, WsMessage{Type: "COLUMN_CREATED", Payload: col})

	return c.Status(201).JSON(col)
}

// deleta uma coluna se ela estiver vazia
func (app *App) deleteColumn(c *fiber.Ctx) error {
	columnID, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "ID da coluna inválido"})
	}

	tx, err := app.db.Begin(context.Background())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro interno do servidor"})
	}
	defer tx.Rollback(context.Background())

	var cardCount int
	err = tx.QueryRow(context.Background(), "SELECT COUNT(*) FROM cards WHERE column_id = $1", columnID).Scan(&cardCount)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao verificar cards na coluna"})
	}
	if cardCount > 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "A coluna não pode ser excluída pois contém tarefas."})
	}

	var boardID, position int
	err = tx.QueryRow(context.Background(), "SELECT board_id, position FROM columns WHERE id = $1", columnID).Scan(&boardID, &position)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Coluna não encontrada"})
	}

	_, err = tx.Exec(context.Background(), "DELETE FROM columns WHERE id = $1", columnID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao deletar a coluna"})
	}

	_, err = tx.Exec(context.Background(), "UPDATE columns SET position = position - 1 WHERE board_id = $1 AND position > $2", boardID, position)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao reordenar colunas"})
	}

	if err := tx.Commit(context.Background()); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao confirmar a exclusão"})
	}

	app.broadcast(boardID, WsMessage{Type: "BOARD_STATE_UPDATED", Payload: nil})

	return c.Status(200).JSON(fiber.Map{"status": "deleted"})
}

// endpoints API
func (app *App) setupRoutes(fiberApp *fiber.App) {
	api := fiberApp.Group("/api")
	protected := api.Use(app.authMiddleware)

	protected.Get("/users", app.getUsers)
	protected.Get("/boards", app.getBoards)
	protected.Post("/boards", app.createBoard)
	protected.Get("/boards/:id/columns", app.getColumns)
	protected.Post("/columns", app.createColumn)
	protected.Delete("/columns/:id", app.deleteColumn)
	protected.Get("/columns/:id/cards", app.getCards)
	protected.Post("/columns/:id/cards", app.createCard)
	protected.Put("/cards/:id", app.updateCard)
	protected.Delete("/cards/:id", app.deleteCard)
	protected.Put("/cards/:id/move", app.moveCard)
	protected.Post("/user/avatar", app.handleAvatarUpload)
}

// obtém todos os usuários
func (app *App) getUsers(c *fiber.Ctx) error {
	conn, err := app.db.Acquire(context.Background())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro de conexão"})
	}
	defer conn.Release()

	users := make([]User, 0)

	query := `
        SELECT
            id,
            email,
            COALESCE(raw_user_meta_data->>'username', email) as username,
            COALESCE(raw_user_meta_data->>'avatar_url', '') as avatar,
            created_at,
            COALESCE(role, '') as role
        FROM auth.users ORDER BY email
    `
	rows, err := conn.Query(context.Background(), query)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro ao buscar usuários"})
	}
	defer rows.Close()

	for rows.Next() {
		var user User
		if err := rows.Scan(&user.ID, &user.Email, &user.Username, &user.Avatar, &user.CreatedAt, &user.Role); err != nil {
			continue
		}
		users = append(users, user)
	}

	return c.JSON(users)
}

// cria um board padrão para um usuário
func (app *App) createDefaultBoard(userID string) (Board, error) {
	var board Board
	board.OwnerID = userID
	board.Title = "Kanban Principal"
	board.Description = "Board de trabalho padrão"
	board.IsPublic = true
	board.Color = "#0079bf"

	var boardID int
	err := app.db.QueryRow(context.Background(), `
		INSERT INTO boards (title, description, owner_id, is_public, color)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id`,
		board.Title, board.Description, board.OwnerID, board.IsPublic, board.Color).Scan(&boardID)

	if err != nil {
		return board, fmt.Errorf("erro ao criar board padrão: %w", err)
	}
	board.ID = boardID

	defaultColumns := []string{"Casos Suporte", "Upgrades/Retenção", "Escallo", "Solucionado", "Não Solucionado"}
	for i, title := range defaultColumns {
		_, err := app.db.Exec(context.Background(), `INSERT INTO columns (board_id, title, position) VALUES ($1, $2, $3)`, boardID, title, i)
		if err != nil {
		}
	}
	return board, nil
}

// obtém os boards de um usuário
func (app *App) getBoards(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	conn, err := app.db.Acquire(context.Background())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro de conexão"})
	}
	defer conn.Release()

	query := `SELECT id, title, description, owner_id, created_at, updated_at, color, is_public
			  FROM boards
			  WHERE owner_id = $1 OR is_public = true
			  ORDER BY created_at DESC`

	rows, err := conn.Query(context.Background(), query, userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro ao buscar boards"})
	}
	defer rows.Close()

	boards := make([]Board, 0)
	for rows.Next() {
		var board Board
		if err := rows.Scan(&board.ID, &board.Title, &board.Description,
			&board.OwnerID, &board.CreatedAt, &board.UpdatedAt,
			&board.Color, &board.IsPublic); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "erro ao ler board"})
		}
		boards = append(boards, board)
	}

	if len(boards) == 0 {
		newBoard, err := app.createDefaultBoard(userID)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "falha ao criar board padrão", "details": err.Error()})
		}
		boards = append(boards, newBoard)
	}

	return c.JSON(boards)
}

// cria um novo board
func (app *App) createBoard(c *fiber.Ctx) error {
	var reqBoard Board
	if err := c.BodyParser(&reqBoard); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "dados invalidos"})
	}
	userID := c.Locals("userID").(string)

	newBoard, err := app.createDefaultBoard(userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro ao criar board"})
	}

	return c.Status(201).JSON(newBoard)
}

// obtém as colunas de um board
func (app *App) getColumns(c *fiber.Ctx) error {
	boardID := c.Params("id")
	conn, err := app.db.Acquire(context.Background())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro de conexão"})
	}
	defer conn.Release()

	query := `SELECT id, board_id, title, position, COALESCE(color, '#e4e6ea') as color
			  FROM columns
			  WHERE board_id = $1
			  ORDER BY position`

	rows, err := conn.Query(context.Background(), query, boardID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro ao buscar colunas"})
	}
	defer rows.Close()

	columns := make([]Column, 0)
	for rows.Next() {
		var col Column
		if err := rows.Scan(&col.ID, &col.BoardID, &col.Title, &col.Position, &col.Color); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "erro ao ler dados da coluna"})
		}
		columns = append(columns, col)
	}

	return c.JSON(columns)
}

// obtém os cards de uma coluna
func (app *App) getCards(c *fiber.Ctx) error {
	columnID := c.Params("id")
	conn, err := app.db.Acquire(context.Background())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro de conexão"})
	}
	defer conn.Release()

	rows, err := conn.Query(context.Background(), `
		SELECT
			id, column_id, title,
			COALESCE(description, '') as description,
			COALESCE(assigned_to, '') as assigned_to,
			COALESCE(priority, 'media') as priority,
			due_date, position, created_at, updated_at
		FROM cards
		WHERE column_id = $1
		ORDER BY position`, columnID)

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro ao buscar cards"})
	}
	defer rows.Close()

	cards := make([]Card, 0)
	for rows.Next() {
		var card Card
		if err := rows.Scan(
			&card.ID, &card.ColumnID, &card.Title, &card.Description,
			&card.AssignedTo, &card.Priority, &card.DueDate, &card.Position,
			&card.CreatedAt, &card.UpdatedAt,
		); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "erro ao ler dados do card"})
		}
		cards = append(cards, card)
	}

	return c.JSON(cards)
}

// criar um novo card
func (app *App) createCard(c *fiber.Ctx) error {
	var card Card
	if err := c.BodyParser(&card); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "dados de card inválidos"})
	}

	columnID, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "ID da coluna inválido"})
	}
	card.ColumnID = columnID

	var maxPos sql.NullInt64
	err = app.db.QueryRow(context.Background(),
		"SELECT MAX(position) FROM cards WHERE column_id = $1", columnID).Scan(&maxPos)
	if err != nil {
		maxPos.Int64 = 0
	}
	card.Position = int(maxPos.Int64) + 1

	query := `
		INSERT INTO cards (column_id, title, description, assigned_to, priority, due_date, position)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, updated_at`

	err = app.db.QueryRow(context.Background(), query,
		card.ColumnID, card.Title, card.Description, card.AssignedTo,
		card.Priority, card.DueDate, card.Position).Scan(&card.ID, &card.CreatedAt, &card.UpdatedAt)

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro ao criar card"})
	}

	var boardID int
	err = app.db.QueryRow(context.Background(),
		"SELECT board_id FROM columns WHERE id = $1", columnID).Scan(&boardID)
	if err == nil {
		app.broadcast(boardID, WsMessage{Type: "CARD_CREATED", Payload: card})
	}

	return c.Status(201).JSON(card)
}

// atualiza um card existente
func (app *App) updateCard(c *fiber.Ctx) error {
	cardID, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "ID do card inválido"})
	}

	var card Card
	if err := c.BodyParser(&card); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "dados de card inválidos"})
	}
	card.ID = cardID

	query := `
		UPDATE cards
		SET title = $1, description = $2, assigned_to = $3, priority = $4, due_date = $5, updated_at = NOW()
		WHERE id = $6`

	_, err = app.db.Exec(context.Background(), query,
		card.Title, card.Description, card.AssignedTo, card.Priority, card.DueDate, card.ID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro ao atualizar card"})
	}

	boardID, err := app.getBoardIDFromCard(card.ID)
	if err == nil {
		var updatedCard Card
		selectQuery := `
			SELECT id, column_id, title, COALESCE(description, '') as description,
				   COALESCE(assigned_to, '') as assigned_to, COALESCE(priority, 'media') as priority,
				   due_date, position, created_at, updated_at
			FROM cards WHERE id = $1`

		err := app.db.QueryRow(context.Background(), selectQuery, card.ID).Scan(
			&updatedCard.ID, &updatedCard.ColumnID, &updatedCard.Title, &updatedCard.Description,
			&updatedCard.AssignedTo, &updatedCard.Priority, &updatedCard.DueDate, &updatedCard.Position,
			&updatedCard.CreatedAt, &updatedCard.UpdatedAt,
		)

		if err == nil {
			app.broadcast(boardID, WsMessage{Type: "CARD_UPDATED", Payload: updatedCard})
		}
	}

	return c.Status(200).JSON(fiber.Map{"status": "updated"})
}

// deletar um card
func (app *App) deleteCard(c *fiber.Ctx) error {
	cardID, _ := strconv.Atoi(c.Params("id"))
	boardID, err := app.getBoardIDFromCard(cardID)
	if err != nil {
	}

	_, err = app.db.Exec(context.Background(), `DELETE FROM cards WHERE id = $1`, cardID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro ao deletar card"})
	}

	if boardID != 0 {
		app.broadcast(boardID, WsMessage{Type: "CARD_DELETED", Payload: fiber.Map{"card_id": cardID}})
	}
	return c.Status(200).JSON(fiber.Map{"status": "deleted"})
}

// mover card entre colunas ou posições
func (app *App) moveCard(c *fiber.Ctx) error {
	cardID, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "ID do card inválido"})
	}

	var req struct {
		ColumnID int `json:"column_id"`
		Position int `json:"position"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "dados de movimentação inválidos"})
	}

	boardID, boardIDErr := app.getBoardIDFromCard(cardID)
	if boardIDErr != nil {
	}

	tx, err := app.db.Begin(context.Background())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro interno do servidor"})
	}
	defer tx.Rollback(context.Background())

	var oldColumnID, oldPosition int
	err = tx.QueryRow(context.Background(), "SELECT column_id, position FROM cards WHERE id = $1 FOR UPDATE", cardID).Scan(&oldColumnID, &oldPosition)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "card não encontrado"})
	}

	_, err = tx.Exec(context.Background(), "UPDATE cards SET position = position - 1, updated_at = NOW() WHERE column_id = $1 AND position > $2", oldColumnID, oldPosition)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro ao mover card (step 1)"})
	}

	_, err = tx.Exec(context.Background(), "UPDATE cards SET position = position + 1, updated_at = NOW() WHERE column_id = $1 AND position >= $2", req.ColumnID, req.Position)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro ao mover card (step 2)"})
	}

	_, err = tx.Exec(context.Background(), "UPDATE cards SET column_id = $1, position = $2, updated_at = NOW() WHERE id = $3", req.ColumnID, req.Position, cardID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro ao mover card (step 3)"})
	}

	if err := tx.Commit(context.Background()); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro interno do servidor"})
	}

	if boardID != 0 {
		var allCards []Card
		rows, err := app.db.Query(context.Background(), `
			SELECT ca.id, ca.column_id, ca.title, COALESCE(ca.description, '') as description,
				   COALESCE(ca.assigned_to, '') as assigned_to, COALESCE(ca.priority, 'media') as priority,
				   ca.due_date, ca.position, ca.created_at, ca.updated_at
			FROM cards ca
			JOIN columns co ON ca.column_id = co.id
			WHERE co.board_id = $1`, boardID)
		if err != nil {
		} else {
			defer rows.Close()
			for rows.Next() {
				var card Card
				if err := rows.Scan(&card.ID, &card.ColumnID, &card.Title, &card.Description, &card.AssignedTo, &card.Priority, &card.DueDate, &card.Position, &card.CreatedAt, &card.UpdatedAt); err == nil {
					allCards = append(allCards, card)
				}
			}
			app.broadcast(boardID, WsMessage{Type: "BOARD_STATE_UPDATED", Payload: fiber.Map{"cards": allCards}})
		}
	}

	return c.Status(200).JSON(fiber.Map{"status": "moved"})
}

// abre URL fornecida
func openBrowser(url string) {
	var cmd string
	var args []string
	switch runtime.GOOS {
	case "windows":
		cmd, args = "rundll32", []string{"url.dll,FileProtocolHandler", url}
	case "darwin":
		cmd, args = "open", []string{url}
	default:
		cmd, args = "xdg-open", []string{url}
	}
	_ = exec.Command(cmd, args...).Start()
}

// entrada principal da aplicação
func main() {
	if err := os.MkdirAll("./static/avatars", os.ModePerm); err != nil {
		log.Fatalf("Erro ao criar o diretório de avatares: %v", err)
	}
	if err := godotenv.Load(); err != nil {
		log.Println("Arquivo .env não encontrado, usando variáveis de ambiente do sistema.")
	}

	app := &App{clients: make(map[int]map[*websocket.Conn]bool)}
	if err := app.connectDB(); err != nil {
	}
	defer app.db.Close()

	engine := html.NewFileSystem(http.FS(templates), ".html")
	fiberApp := fiber.New(fiber.Config{Views: engine})

	fiberApp.Use(logger.New(), recover.New())

	fiberApp.Use(cors.New(cors.Config{
		AllowOrigins:     "https://nm-kanban-api.onrender.com, http://localhost:8080",
		AllowCredentials: true,
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization",
	}))

	app.setupRoutes(fiberApp)

	fiberApp.Use("/static", filesystem.New(filesystem.Config{
		Root:       http.FS(static),
		PathPrefix: "frontend/static",
	}))

	fiberApp.Get("/ws/board/:id", websocket.New(app.handleWebSocket))
	fiberApp.Get("/*", func(c *fiber.Ctx) error {
		return c.Render("frontend/templates/index", fiber.Map{"Title": "NM Kanban"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	addr := fmt.Sprintf("0.0.0.0:%s", port)

	log.Printf("Servidor iniciando na porta %s", port)
	if err := fiberApp.Listen(addr); err != nil {
		log.Fatalf("Erro ao iniciar o servidor: %v", err)
	}
}
