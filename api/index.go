package handler

import (
	"bytes"
	"context"
	"database/sql"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/adapter"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	dbPool *pgxpool.Pool
	once   sync.Once
)

func getDB() *pgxpool.Pool {
	once.Do(func() {
		config, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
		if err != nil {
			log.Fatalf("Não foi possível parsear a URL do banco: %v", err)
		}
		config.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeExec
		pool, err := pgxpool.NewWithConfig(context.Background(), config)
		if err != nil {
			log.Fatalf("Não foi possível conectar ao banco de dados: %v", err)
		}
		dbPool = pool
	})
	return dbPool
}

type App struct {
	db *pgxpool.Pool
}

func Handler(w http.ResponseWriter, r *http.Request) {
	app := fiber.New()
	mainApp := &App{db: getDB()}
	mainApp.setupRoutes(app)
	adapter.FiberApp(app)(w, r)
}

type User struct {
	ID        string    `json:"id" db:"id"`
	Username  string    `json:"username" db:"username"`
	Email     string    `json:"email" db:"email"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	Avatar    string    `json:"avatar" db:"avatar"`
	Role      string    `json:"role" db:"role"`
}

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

type Column struct {
	ID       int    `json:"id" db:"id"`
	BoardID  int    `json:"board_id" db:"board_id"`
	Title    string `json:"title" db:"title"`
	Position int    `json:"position" db:"position"`
	Color    string `json:"color" db:"color"`
}

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

type SupabaseClaims struct {
	UserID string `json:"sub"`
	jwt.RegisteredClaims
}

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
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Token inválido"})
	}

	if !token.Valid {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Token inválido ou expirado"})
	}

	claims, ok := token.Claims.(*SupabaseClaims)
	if !ok || claims.UserID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Claims do token inválidas"})
	}

	c.Locals("userID", claims.UserID)
	return c.Next()
}

func (app *App) setupRoutes(fiberApp *fiber.App) {
	api := fiberApp.Group("/api")
	protected := api.Use(app.authMiddleware)

	protected.Get("/users", app.getUsers)
	protected.Post("/user/avatar", app.handleAvatarUpload)
	protected.Get("/boards/public", app.getPublicBoards)
	protected.Get("/boards/private", app.getPrivateBoards)
	protected.Post("/boards", app.createBoard)
	protected.Delete("/boards/:id", app.deleteBoard)
	protected.Get("/boards/:id/columns", app.getColumns)
	protected.Post("/columns", app.createColumn)
	protected.Delete("/columns/:id", app.deleteColumn)
	protected.Get("/columns/:id/cards", app.getCards)
	protected.Post("/columns/:id/cards", app.createCard)
	protected.Put("/cards/:id", app.updateCard)
	protected.Delete("/cards/:id", app.deleteCard)
	protected.Put("/cards/:id/move", app.moveCard)
}

func (app *App) handleAvatarUpload(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	file, err := c.FormFile("avatar")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Nenhum arquivo de avatar enviado"})
	}
	if !strings.HasPrefix(file.Header.Get("Content-Type"), "image/") {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Formato de arquivo inválido"})
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
	fileName := fmt.Sprintf("avatar-%s%s", userID, filepath.Ext(file.Filename))
	uploadURL := fmt.Sprintf("%s/storage/v1/object/avatars/%s", os.Getenv("SUPABASE_PROJECT_URL"), fileName)
	req, err := http.NewRequest("POST", uploadURL, bytes.NewReader(fileBytes))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro interno ao preparar upload"})
	}
	req.Header.Set("Authorization", "Bearer "+os.Getenv("SUPABASE_SERVICE_KEY"))
	req.Header.Set("Content-Type", file.Header.Get("Content-Type"))
	req.Header.Set("x-upsert", "true")
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro interno ao fazer upload"})
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("Supabase retornou status não-OK: %s, Body: %s", resp.Status, string(body))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Falha ao armazenar o arquivo"})
	}
	publicURL := fmt.Sprintf("%s/storage/v1/object/public/avatars/%s", os.Getenv("SUPABASE_PROJECT_URL"), fileName)
	query := `UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('avatar_url', $1::text) WHERE id = $2`
	_, err = app.db.Exec(context.Background(), query, publicURL, userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao atualizar perfil"})
	}
	return c.JSON(fiber.Map{"avatar_url": publicURL})
}

func (app *App) getBoardIDFromCard(cardID int) (int, error) {
	var boardID int
	err := app.db.QueryRow(context.Background(), `SELECT c.board_id FROM columns c JOIN cards ca ON c.id = ca.column_id WHERE ca.id = $1`, cardID).Scan(&boardID)
	return boardID, err
}

func (app *App) createColumn(c *fiber.Ctx) error {
	var col Column
	if err := c.BodyParser(&col); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "dados de coluna inválidos"})
	}
	if col.BoardID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "board_id é obrigatório"})
	}
	var maxPos sql.NullInt64
	app.db.QueryRow(context.Background(), "SELECT MAX(position) FROM columns WHERE board_id = $1", col.BoardID).Scan(&maxPos)
	col.Position = int(maxPos.Int64) + 1
	err := app.db.QueryRow(context.Background(), `INSERT INTO columns (board_id, title, position, color) VALUES ($1, $2, $3, $4) RETURNING id`, col.BoardID, col.Title, col.Position, col.Color).Scan(&col.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "erro ao criar coluna"})
	}
	return c.Status(201).JSON(col)
}

func (app *App) deleteColumn(c *fiber.Ctx) error {
	columnID, _ := strconv.Atoi(c.Params("id"))
	tx, err := app.db.Begin(context.Background())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro interno"})
	}
	defer tx.Rollback(context.Background())
	var cardCount int
	tx.QueryRow(context.Background(), "SELECT COUNT(*) FROM cards WHERE column_id = $1", columnID).Scan(&cardCount)
	if cardCount > 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "A coluna não pode ser excluída pois contém tarefas"})
	}
	var boardID, position int
	tx.QueryRow(context.Background(), "SELECT board_id, position FROM columns WHERE id = $1", columnID).Scan(&boardID, &position)
	tx.Exec(context.Background(), "DELETE FROM columns WHERE id = $1", columnID)
	tx.Exec(context.Background(), "UPDATE columns SET position = position - 1 WHERE board_id = $1 AND position > $2", boardID, position)
	if err := tx.Commit(context.Background()); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Erro ao confirmar a exclusão"})
	}
	return c.Status(200).JSON(fiber.Map{"status": "deleted"})
}

func (app *App) deleteBoard(c *fiber.Ctx) error {
	boardID, _ := strconv.Atoi(c.Params("id"))
	userID := c.Locals("userID").(string)
	var ownerID string
	app.db.QueryRow(context.Background(), "SELECT owner_id FROM boards WHERE id = $1", boardID).Scan(&ownerID)
	if ownerID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Acesso negado"})
	}
	_, err := app.db.Exec(context.Background(), "DELETE FROM boards WHERE id = $1", boardID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Erro ao deletar o quadro"})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (app *App) getUsers(c *fiber.Ctx) error {
	rows, err := app.db.Query(context.Background(), `SELECT id, email, COALESCE(raw_user_meta_data->>'username', email) as username, COALESCE(raw_user_meta_data->>'avatar_url', '') as avatar, created_at, COALESCE(role, '') as role FROM auth.users ORDER BY email`)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro ao buscar usuários"})
	}
	defer rows.Close()
	users, _ := pgx.CollectRows(rows, pgx.RowToStructByPos[User])
	return c.JSON(users)
}

func (app *App) getPublicBoards(c *fiber.Ctx) error {
	rows, err := app.db.Query(context.Background(), `SELECT id, title, description, owner_id, created_at, updated_at, color, is_public FROM boards WHERE is_public = true ORDER BY created_at DESC LIMIT 1`)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro ao buscar boards públicos"})
	}
	defer rows.Close()
	boards, _ := pgx.CollectRows(rows, pgx.RowToStructByPos[Board])
	return c.JSON(boards)
}

func (app *App) getPrivateBoards(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)
	rows, err := app.db.Query(context.Background(), `SELECT id, title, description, owner_id, created_at, updated_at, color, is_public FROM boards WHERE owner_id = $1 AND is_public = false ORDER BY created_at DESC`, userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro ao buscar seus boards privados"})
	}
	defer rows.Close()
	boards, _ := pgx.CollectRows(rows, pgx.RowToStructByPos[Board])
	return c.JSON(boards)
}

func (app *App) createBoard(c *fiber.Ctx) error {
	var reqBoard Board
	c.BodyParser(&reqBoard)
	userID := c.Locals("userID").(string)
	if reqBoard.Title == "" {
		return c.Status(400).JSON(fiber.Map{"error": "O título do quadro é obrigatório"})
	}
	tx, _ := app.db.Begin(context.Background())
	defer tx.Rollback(context.Background())
	tx.QueryRow(context.Background(), `INSERT INTO boards (title, description, owner_id, is_public, color) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at, updated_at`, reqBoard.Title, reqBoard.Description, userID, reqBoard.IsPublic, reqBoard.Color).Scan(&reqBoard.ID, &reqBoard.CreatedAt, &reqBoard.UpdatedAt)
	reqBoard.OwnerID = userID
	defaultColumns := []struct{ Title, Color string }{{"A Fazer", "#58a6ff"}, {"Em Andamento", "#d29922"}, {"Solucionado", "#3fb950"}, {"Não Solucionado", "#f85149"}}
	for i, col := range defaultColumns {
		tx.Exec(context.Background(), `INSERT INTO columns (board_id, title, position, color) VALUES ($1, $2, $3, $4)`, reqBoard.ID, col.Title, i, col.Color)
	}
	tx.Commit(context.Background())
	return c.Status(201).JSON(reqBoard)
}

func (app *App) getColumns(c *fiber.Ctx) error {
	boardID, _ := strconv.Atoi(c.Params("id"))
	userID := c.Locals("userID").(string)
	hasPermission, _ := app.checkBoardPermission(userID, boardID)
	if !hasPermission {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Acesso negado"})
	}
	tx, _ := app.db.Begin(context.Background())
	defer tx.Rollback(context.Background())
	query := `SELECT id, board_id, title, position, COALESCE(color, '#e4e6ea') as color FROM columns WHERE board_id = $1 ORDER BY position`
	rows, _ := tx.Query(context.Background(), query, boardID)
	var columns []Column
	foundSolucionado, foundNaoSolucionado, maxPosition := false, false, -1
	for rows.Next() {
		var col Column
		rows.Scan(&col.ID, &col.BoardID, &col.Title, &col.Position, &col.Color)
		titleLower := strings.ToLower(col.Title)
		if titleLower == "solucionado" {
			foundSolucionado = true
		}
		if titleLower == "não solucionado" {
			foundNaoSolucionado = true
		}
		if col.Position > maxPosition {
			maxPosition = col.Position
		}
		columns = append(columns, col)
	}
	rows.Close()
	if !foundSolucionado {
		maxPosition++
		tx.Exec(context.Background(), `INSERT INTO columns (board_id, title, position, color) VALUES ($1, $2, $3, $4)`, boardID, "Solucionado", maxPosition, "#3fb950")
	}
	if !foundNaoSolucionado {
		maxPosition++
		tx.Exec(context.Background(), `INSERT INTO columns (board_id, title, position, color) VALUES ($1, $2, $3, $4)`, boardID, "Não Solucionado", maxPosition, "#f85149")
	}
	tx.Commit(context.Background())
	if !foundSolucionado || !foundNaoSolucionado {
		rows, _ = app.db.Query(context.Background(), query, boardID)
		defer rows.Close()
		columns, _ = pgx.CollectRows(rows, pgx.RowToStructByPos[Column])
	}
	return c.JSON(columns)
}

func (app *App) getCards(c *fiber.Ctx) error {
	columnID, _ := strconv.Atoi(c.Params("id"))
	userID := c.Locals("userID").(string)
	boardID, _ := app.getBoardIDFromColumn(columnID)
	hasPermission, _ := app.checkBoardPermission(userID, boardID)
	if !hasPermission {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Acesso negado"})
	}
	rows, _ := app.db.Query(context.Background(), `SELECT id, column_id, title, COALESCE(description, '') as description, COALESCE(assigned_to, '') as assigned_to, COALESCE(priority, 'media') as priority, due_date, position, created_at, updated_at FROM cards WHERE column_id = $1 ORDER BY position`, columnID)
	defer rows.Close()
	cards, _ := pgx.CollectRows(rows, pgx.RowToStructByPos[Card])
	return c.JSON(cards)
}

func (app *App) createCard(c *fiber.Ctx) error {
	columnID, _ := strconv.Atoi(c.Params("id"))
	userID := c.Locals("userID").(string)
	boardID, _ := app.getBoardIDFromColumn(columnID)
	hasPermission, _ := app.checkBoardPermission(userID, boardID)
	if !hasPermission {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Acesso negado"})
	}
	var card Card
	c.BodyParser(&card)
	card.ColumnID = columnID
	var maxPos sql.NullInt64
	app.db.QueryRow(context.Background(), "SELECT MAX(position) FROM cards WHERE column_id = $1", columnID).Scan(&maxPos)
	card.Position = int(maxPos.Int64) + 1
	app.db.QueryRow(context.Background(), `INSERT INTO cards (column_id, title, description, assigned_to, priority, due_date, position) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at, updated_at`, card.ColumnID, card.Title, card.Description, card.AssignedTo, card.Priority, card.DueDate, card.Position).Scan(&card.ID, &card.CreatedAt, &card.UpdatedAt)
	return c.Status(201).JSON(card)
}

func (app *App) updateCard(c *fiber.Ctx) error {
	cardID, _ := strconv.Atoi(c.Params("id"))
	var card Card
	c.BodyParser(&card)
	card.ID = cardID
	_, err := app.db.Exec(context.Background(), `UPDATE cards SET title = $1, description = $2, assigned_to = $3, priority = $4, due_date = $5, updated_at = NOW() WHERE id = $6`, card.Title, card.Description, card.AssignedTo, card.Priority, card.DueDate, card.ID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro ao atualizar card"})
	}
	return c.Status(200).JSON(fiber.Map{"status": "updated"})
}

func (app *App) checkBoardPermission(userID string, boardID int) (bool, error) {
	var ownerID string
	var isPublic bool
	app.db.QueryRow(context.Background(), `SELECT owner_id, is_public FROM boards WHERE id = $1`, boardID).Scan(&ownerID, &isPublic)
	return isPublic || ownerID == userID, nil
}

func (app *App) getBoardIDFromColumn(columnID int) (int, error) {
	var boardID int
	err := app.db.QueryRow(context.Background(), `SELECT board_id FROM columns WHERE id = $1`, columnID).Scan(&boardID)
	return boardID, err
}

func (app *App) deleteCard(c *fiber.Ctx) error {
	cardID, _ := strconv.Atoi(c.Params("id"))
	_, err := app.db.Exec(context.Background(), `DELETE FROM cards WHERE id = $1`, cardID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro ao deletar card"})
	}
	return c.Status(200).JSON(fiber.Map{"status": "deleted"})
}

func (app *App) moveCard(c *fiber.Ctx) error {
	cardID, _ := strconv.Atoi(c.Params("id"))
	var req struct {
		ColumnID int `json:"column_id"`
		Position int `json:"position"`
	}
	c.BodyParser(&req)
	tx, _ := app.db.Begin(context.Background())
	defer tx.Rollback(context.Background())
	var oldColumnID, oldPosition int
	tx.QueryRow(context.Background(), "SELECT column_id, position FROM cards WHERE id = $1 FOR UPDATE", cardID).Scan(&oldColumnID, &oldPosition)
	tx.Exec(context.Background(), "UPDATE cards SET position = position - 1, updated_at = NOW() WHERE column_id = $1 AND position > $2", oldColumnID, oldPosition)
	tx.Exec(context.Background(), "UPDATE cards SET position = position + 1, updated_at = NOW() WHERE column_id = $1 AND position >= $2", req.ColumnID, req.Position)
	tx.Exec(context.Background(), "UPDATE cards SET column_id = $1, position = $2, updated_at = NOW() WHERE id = $3", req.ColumnID, req.Position, cardID)
	tx.Commit(context.Background())
	return c.Status(200).JSON(fiber.Map{"status": "moved"})
}
