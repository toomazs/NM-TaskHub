package main

import (
	// go internos
	"crypto/rand"
	"database/sql"
	"embed"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"

	// go externos
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/filesystem"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/template/html/v2"
	"github.com/gofiber/websocket/v2"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

//go:embed frontend/templates/*.html
var templates embed.FS

//go:embed frontend/static/*
var static embed.FS

// estrutura
type User struct {
	ID        int       `json:"id" db:"id"`
	Username  string    `json:"username" db:"username"`
	Email     string    `json:"email" db:"email"`
	Password  string    `json:"-" db:"password"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	Avatar    string    `json:"avatar" db:"avatar"`
	Role      string    `json:"role" db:"role"`
}

type Board struct {
	ID          int       `json:"id" db:"id"`
	Title       string    `json:"title" db:"title"`
	Description string    `json:"description" db:"description"`
	OwnerID     int       `json:"owner_id" db:"owner_id"`
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
	Limit    int    `json:"limit" db:"limit"`
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

type App struct {
	db      *sql.DB
	clients map[int]map[*websocket.Conn]bool
}

// criacao de db automatica com sqlite
func (app *App) initDB() error {
	var err error
	app.db, err = sql.Open("sqlite", "./kanban.db")
	if err != nil {
		return err
	}

	schemas := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			email TEXT UNIQUE NOT NULL,
			password TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			avatar TEXT DEFAULT '',
			role TEXT DEFAULT 'user'
		)`,
		`CREATE TABLE IF NOT EXISTS boards (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			description TEXT DEFAULT '',
			owner_id INTEGER NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			color TEXT DEFAULT '#3498db',
			is_public BOOLEAN DEFAULT FALSE,
			FOREIGN KEY (owner_id) REFERENCES users(id)
		)`,
		`CREATE TABLE IF NOT EXISTS columns (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			board_id INTEGER NOT NULL,
			title TEXT NOT NULL,
			position INTEGER NOT NULL,
			color TEXT DEFAULT '#ecf0f1',
			limit_cards INTEGER DEFAULT 0,
			FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS cards (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			column_id INTEGER NOT NULL,
			title TEXT NOT NULL,
			description TEXT DEFAULT '',
			assigned_to TEXT,
			priority TEXT DEFAULT 'media',
			due_date DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			position INTEGER NOT NULL,
			FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE
		)`,
	}

	for _, schema := range schemas {
		if _, err := app.db.Exec(schema); err != nil {
			return fmt.Errorf("falha ao executar schema: %w", err)
		}
	}
	app.createDefaultUser()
	return nil
}

func (app *App) createDefaultUser() {
	type defaultUser struct {
		Username string
		Email    string
		Password string
		Role     string
	}

	// users criados padrao nm
	usersToCreate := []defaultUser{
		{Username: "admin", Email: "admin@kanban.local", Password: "admin123", Role: "admin"},
		{Username: "eduardo", Email: "eduardo@kanban.local", Password: "nm12345678", Role: "user"},
		{Username: "marques", Email: "marques@kanban.local", Password: "nm12345678", Role: "user"},
		{Username: "rosa", Email: "rosa@kanban.local", Password: "nm12345678", Role: "user"},
		{Username: "miyake", Email: "miyake@kanban.local", Password: "nm12345678", Role: "user"},
		{Username: "gomes", Email: "gomes@kanban.local", Password: "nm12345678", Role: "user"},
		{Username: "pedro", Email: "pedro@kanban.local", Password: "nm12345678", Role: "user"},
		{Username: "rodrigo", Email: "rodrigo@kanban.local", Password: "nm12345678", Role: "user"},
		{Username: "rubens", Email: "rubens@kanban.local", Password: "nm12345678", Role: "user"},
	}

	for _, u := range usersToCreate {
		var count int
		err := app.db.QueryRow("SELECT COUNT(*) FROM users WHERE email = ?", u.Email).Scan(&count)
		if err != nil {
			log.Printf("erro ao verificar user %s: %v", u.Username, err)
			continue
		}

		if count == 0 {
			hashedPassword, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
			if err != nil {
				log.Printf("erro ao gerar hash para %s: %v", u.Username, err)
				continue
			}
			_, err = app.db.Exec(`INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`,
				u.Username, u.Email, string(hashedPassword), u.Role)
			if err == nil {
				log.Printf("user '%s' criado com sucesso", u.Username)
			} else {
				log.Printf("erro ao criar user '%s': %v", u.Username, err)
			}
		}
	}
}

// auth com middleware system
func (app *App) authMiddleware(c *fiber.Ctx) error {
	token := c.Cookies("auth_token")
	if token == "" {
		if strings.HasPrefix(c.Path(), "/api") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "nao autorizado"})
		}
		return c.Next()
	}
	return c.Next()
}

// endpoints API
func (app *App) setupRoutes(fiberApp *fiber.App) {
	api := fiberApp.Group("/api")
	api.Post("/login", app.login)
	api.Post("/logout", app.logout)

	protected := api.Use(app.authMiddleware)
	protected.Get("/boards", app.getBoards)
	protected.Post("/boards", app.createBoard)
	protected.Get("/boards/:id/columns", app.getColumns)
	protected.Get("/columns/:id/cards", app.getCards)
	protected.Post("/columns/:id/cards", app.createCard)
	protected.Put("/cards/:id", app.updateCard)
	protected.Delete("/cards/:id", app.deleteCard)
	protected.Put("/cards/:id/move", app.moveCard)
}

// login
func (app *App) login(c *fiber.Ctx) error {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "dados invalidos"})
	}

	var user User
	var hashedPassword string
	err := app.db.QueryRow(`SELECT id, username, email, password FROM users WHERE email = ?`, req.Email).Scan(&user.ID, &user.Username, &user.Email, &hashedPassword)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "credenciais invalidas"})
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(req.Password)); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "credenciais invalidas"})
	}

	token := generateToken()
	c.Cookie(&fiber.Cookie{
		Name:     "auth_token",
		Value:    token,
		Expires:  time.Now().Add(24 * time.Hour),
		HTTPOnly: true,
		SameSite: "Lax",
	})

	return c.JSON(fiber.Map{"user": user})
}

// logout
func (app *App) logout(c *fiber.Ctx) error {
	c.Cookie(&fiber.Cookie{
		Name:     "auth_token",
		Value:    "",
		Expires:  time.Now().Add(-time.Hour),
		HTTPOnly: true,
	})
	return c.JSON(fiber.Map{"message": "logout sucesso"})
}

// boards
func (app *App) getBoards(c *fiber.Ctx) error {
	rows, err := app.db.Query(`SELECT id, title, description FROM boards ORDER BY id DESC`)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro ao buscar boards"})
	}
	defer rows.Close()

	// slice vazio retornando como [] e nao null
	boards := make([]Board, 0)

	for rows.Next() {
		var board Board
		if err := rows.Scan(&board.ID, &board.Title, &board.Description); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "erro ao ler board"})
		}
		boards = append(boards, board)
	}
	return c.JSON(boards)
}

// criar boards
func (app *App) createBoard(c *fiber.Ctx) error {
	var board Board
	if err := c.BodyParser(&board); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "dados invalidos"})
	}
	board.OwnerID = 1 // atribui admin como padrao
	result, err := app.db.Exec(`INSERT INTO boards (title, description, owner_id) VALUES (?, ?, ?)`,
		board.Title, board.Description, board.OwnerID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro ao criar board"})
	}
	boardID, _ := result.LastInsertId()

	defaultColumns := []string{"Terceirizada - Validações", "O.S. - Escallo", "Casos Suporte", "Upgrades/Retenção", "O.S. - Reagendamentos"}
	for i, title := range defaultColumns {
		_, err := app.db.Exec(`INSERT INTO columns (board_id, title, position) VALUES (?, ?, ?)`, boardID, title, i)
		if err != nil {
			log.Printf("erro ao criar coluna padrão: %v", err)
		}
	}
	board.ID = int(boardID)
	return c.Status(201).JSON(board)
}

// colunas
func (app *App) getColumns(c *fiber.Ctx) error {
	boardID := c.Params("id")
	rows, err := app.db.Query(`SELECT id, board_id, title, position FROM columns WHERE board_id = ? ORDER BY position`, boardID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro ao buscar colunas"})
	}
	defer rows.Close()

	columns := make([]Column, 0)
	for rows.Next() {
		var col Column
		if err := rows.Scan(&col.ID, &col.BoardID, &col.Title, &col.Position); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "erro ao ler dados da coluna"})
		}
		columns = append(columns, col)
	}
	return c.JSON(columns)
}

// cards
func (app *App) getCards(c *fiber.Ctx) error {
	columnID := c.Params("id")
	rows, err := app.db.Query(`SELECT id, column_id, title, description, assigned_to, priority, due_date, position FROM cards WHERE column_id = ? ORDER BY position`, columnID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro ao buscar cards"})
	}
	defer rows.Close()

	cards := make([]Card, 0)
	for rows.Next() {
		var card Card
		var assignedTo sql.NullString
		if err := rows.Scan(&card.ID, &card.ColumnID, &card.Title, &card.Description, &assignedTo, &card.Priority, &card.DueDate, &card.Position); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "erro ao ler dados do card"})
		}
		card.AssignedTo = assignedTo.String
		cards = append(cards, card)
	}
	return c.JSON(cards)
}

// func criar card
func (app *App) createCard(c *fiber.Ctx) error {
	var card Card
	if err := c.BodyParser(&card); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "dados de card invalidos"})
	}
	columnID, _ := strconv.Atoi(c.Params("id"))
	card.ColumnID = columnID

	var maxPos sql.NullInt64
	_ = app.db.QueryRow("SELECT MAX(position) FROM cards WHERE column_id = ?", columnID).Scan(&maxPos)
	card.Position = int(maxPos.Int64) + 1

	result, err := app.db.Exec(`
		INSERT INTO cards (column_id, title, description, assigned_to, priority, due_date, position)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		card.ColumnID, card.Title, card.Description, card.AssignedTo, card.Priority, card.DueDate, card.Position)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro ao criar card"})
	}
	id, _ := result.LastInsertId()
	card.ID = int(id)
	return c.Status(201).JSON(card)
}

// func editar card
func (app *App) updateCard(c *fiber.Ctx) error {
	cardId := c.Params("id")
	var card Card
	if err := c.BodyParser(&card); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "dados de card inválidos"})
	}
	_, err := app.db.Exec(`
		UPDATE cards SET title = ?, description = ?, assigned_to = ?, priority = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?`,
		card.Title, card.Description, card.AssignedTo, card.Priority, card.DueDate, cardId)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro ao atualizar card"})
	}
	return c.JSON(fiber.Map{"status": "updated"})
}

// func deletar card
func (app *App) deleteCard(c *fiber.Ctx) error {
	cardId := c.Params("id")
	_, err := app.db.Exec(`DELETE FROM cards WHERE id = ?`, cardId)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro ao deletar card"})
	}
	return c.JSON(fiber.Map{"status": "deleted"})
}

// func drag and drop card
func (app *App) moveCard(c *fiber.Ctx) error {
	cardId := c.Params("id")
	var req struct {
		ColumnID int `json:"column_id"`
		Position int `json:"position"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "dados de movimentacao invalidos"})
	}
	_, err := app.db.Exec(`UPDATE cards SET column_id = ?, position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
		req.ColumnID, req.Position, cardId)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "erro ao mover card"})
	}
	return c.JSON(fiber.Map{"status": "moved"})
}

// gerar token simples
func generateToken() string {
	bytes := make([]byte, 16)
	_, _ = rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// abrir navegador padrao
func openBrowser(url string) {
	var cmd string
	var args []string
	switch runtime.GOOS {
	case "windows":
		cmd, args = "rundll32", []string{"url.dll,FileProtocolHandler", url}
	case "darwin":
		cmd = "open"
	default:
		cmd = "xdg-open"
	}
	if runtime.GOOS != "windows" {
		args = append(args, url)
	}
	_ = exec.Command(cmd, args...).Start()
}

// main
func main() {
	app := &App{
		clients: make(map[int]map[*websocket.Conn]bool),
	}
	if err := app.initDB(); err != nil {
		log.Fatalf("Erro ao inicializar banco de dados: %v", err)
	}
	defer app.db.Close()

	engine := html.NewFileSystem(http.FS(templates), ".html")
	fiberApp := fiber.New(fiber.Config{
		Views: engine,
	})

	fiberApp.Use(logger.New())
	fiberApp.Use(recover.New())
	fiberApp.Use(cors.New(cors.Config{
		AllowOrigins:     "http://localhost:8080",
		AllowCredentials: true,
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization",
	}))

	// registrar rotas da API
	app.setupRoutes(fiberApp)

	fiberApp.Use("/static", filesystem.New(filesystem.Config{
		Root:       http.FS(static),
		PathPrefix: "frontend/static",
	}))

	fiberApp.Get("/*", func(c *fiber.Ctx) error {
		return c.Render("frontend/templates/index", fiber.Map{
			"Title": "N-MULTIFIBRA | Kanban Pro",
		})
	})

	log.Println("log: local serv sucesso http://localhost:8080")
	go openBrowser("http://localhost:8080")
	log.Fatal(fiberApp.Listen(":8080"))
}
