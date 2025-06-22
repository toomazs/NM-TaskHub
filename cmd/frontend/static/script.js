import { userDisplayNameMap, userDisplayNameModalMap } from "./config.js";
import { debounce } from "./api.js";
import * as authService from "./services/auth.js";
import * as userService from "./services/users.js";
import * as boardService from "./services/boards.js";
import * as columnService from "./services/columns.js";
import * as cardService from "./services/cards.js";
import * as notificationService from "./services/notifications.js";

const state = {
  user: null,
  board: null,
  columns: [],
  cards: [],
  users: [],
  privateBoards: [],
  boardMembers: [],
  notifications: [],
  solucionadoId: null,
  naoSolucionadoId: null,
  editingCardId: null,
  editingColumnId: null,
  currentColumnId: null,
  ws: null,
  isModalDirty: false,
  activeSection: "suporte",
  notificationsNeedUpdate: false,
};

let elements = {};

// --- FUNÇÕES HELPER ---

async function loadModalHTML(modalId) {
  if (document.getElementById(modalId)) return;
  try {
    const response = await fetch(`/static/modals/${modalId}.html`);
    if (!response.ok) throw new Error(`Modal não encontrado: ${modalId}`);
    const html = await response.text();
    document
      .getElementById("modal-container")
      .insertAdjacentHTML("beforeend", html);
  } catch (error) {
    console.error(`Falha ao carregar o modal: ${error}`);
    showToast({ message: `Não foi possível carregar o componente ${modalId}.`, type: 'error' });
  }
}

function _performCloseAnimation(modalElement) {
  if (
    modalElement &&
    modalElement.style.display === "flex" &&
    !modalElement.classList.contains("closing")
  ) {
    modalElement.classList.add("closing");
    setTimeout(() => {
      modalElement.style.display = "none";
      modalElement.classList.remove("closing");
    }, 300);
  }
}

function closeAllModals() {
  document
    .querySelectorAll(".modal")
    .forEach((modal) => _performCloseAnimation(modal));
  state.editingCardId = null;
  state.currentColumnId = null;
  state.isModalDirty = false;
}

// --- INICIALIZAÇÃO DA APLICAÇÃO ---

document.addEventListener("DOMContentLoaded", async () => {
  elements = {
    loginSection: document.getElementById("loginSection"),
    kanbanSection: document.getElementById("kanbanSection"),
    kanbanContainer: document.querySelector(".kanban-container"),
    sidebar: document.getElementById("sidebar"),
    loader: document.getElementById("loader"),
    btnLogoutSidebar: document.getElementById("btnLogoutSidebar"),
    userName: document.getElementById("userName"),
    userAvatar: document.getElementById("userAvatar"),
    invitationsBell: document.getElementById("invitationsBell"),
    invitationsCount: document.getElementById("invitationsCount"),
    invitationsDropdown: document.getElementById("invitationsDropdown"),
  };
  addEventListeners();
  await checkAuth();
});

function addEventListeners() {
  document.getElementById("loginForm")?.addEventListener("submit", handleLogin);
  elements.btnLogoutSidebar?.addEventListener("click", logout);
  elements.invitationsBell?.addEventListener(
    "click",
    toggleNotificationsDropdown
  );

  document.getElementById("btnLeaveBoard").addEventListener("click", handleLeaveBoard);

  document
    .getElementById("avatarUpload")
    ?.addEventListener("change", handleAvatarUpload);
  document
    .getElementById("btnBackToBoards")
    .addEventListener("click", loadAndShowPrivateBoards);
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      if (state.activeSection === section && section !== "suporte") return;
      document
        .querySelectorAll(".nav-item")
        .forEach((i) => i.classList.remove("active"));
      item.classList.add("active");
      state.ws?.close();
      if (section === "suporte") initApp();
      else if (section === "private-boards") loadAndShowPrivateBoards();
      else showSection(`${section}Section`);
    });
  });
  document.body.addEventListener("click", async (e) => {
    if (e.target.classList.contains("modal")) closeAllModals();
    if (
      !elements.invitationsBell?.contains(e.target) &&
      !elements.invitationsDropdown?.contains(e.target)
    ) {
      if (
        elements.invitationsDropdown &&
        elements.invitationsDropdown.style.display === "block"
      ) {
        await handleMarkNotificationsAsRead();
        elements.invitationsDropdown.style.display = "none";
      }
    }
  });
  document.addEventListener("keydown", async (e) => {
    if (e.key === "Escape") {
      closeAllModals();
      if (
        elements.invitationsDropdown &&
        elements.invitationsDropdown.style.display === "block"
      ) {
        await handleMarkNotificationsAsRead();
        elements.invitationsDropdown.style.display = "none";
      }
    }
  });
}

// --- LÓGICA DE AUTENTICAÇÃO E FUNÇÕES PRINCIPAIS ---
async function checkAuth() {
  const {
    data: { session },
  } = await authService.getSession();
  if (session) {
    state.user = session.user;
    await loadInitialData();
    await initApp();
  } else {
    showLogin();
  }
}
async function loadInitialData() {
  await loadUsers();
  await fetchNotifications();
}
function showLogin() {
  elements.kanbanSection.style.display = "none";
  elements.sidebar.style.display = "none";
  document.body.classList.add("login-page");
  elements.loginSection.style.display = "flex";
  elements.loginSection.classList.add("fade-in");
}
async function handleLogin(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const submitButton = e.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
  const { error } = await authService.signIn(
    formData.get("email"),
    formData.get("password")
  );
  if (error) {
    showError(error.message);
    submitButton.disabled = false;
    submitButton.innerHTML = "Entrar";
  } else {
    location.reload();
  }
}
async function logout() {
  state.ws?.close();
  await authService.signOut();
  location.reload();
}
function updateSidebarUser() {
  if (!state.user || !state.users.length) return;
  const loggedInUser = state.users.find((u) => u.id === state.user.id);
  if (!loggedInUser) return;
  const displayName =
    userDisplayNameMap[loggedInUser.email] || loggedInUser.username;
  const avatarUrl = loggedInUser.avatar;
  elements.userName.textContent = displayName;
  if (avatarUrl) {
    elements.userAvatar.innerHTML = "";
    elements.userAvatar.style.backgroundImage = `url(${avatarUrl}?t=${new Date().getTime()})`;
  } else {
    const initial = displayName.charAt(0).toUpperCase();
    elements.userAvatar.style.backgroundImage = "none";
    elements.userAvatar.innerHTML = initial;
  }
}
async function initApp() {
  elements.loader.style.display = "flex";
  document.body.classList.remove("login-page");
  showSection("kanbanSection");
  elements.kanbanSection.style.opacity = 0;
  elements.sidebar.style.display = "flex";
  updateSidebarUser();
  updateUIForPublicBoard();
  try {
    const boardsResponse = await boardService.getPublicBoards();
    if (boardsResponse?.ok) {
      const boards = await boardsResponse.json();
      if (boards.length > 0) {
        state.board = boards[0];
        await loadBoardData();
        elements.loader.style.display = "none";
        elements.kanbanSection.classList.add("fade-in");
      } else {
        elements.loader.style.display = "none";
        showError("Nenhum quadro Kanban público encontrado.");
      }
    } else {
      elements.loader.style.display = "none";
      showError("Não foi possível carregar os quadros Kanban.");
    }
  } catch (error) {
    elements.loader.style.display = "none";
    showError("Erro fatal ao carregar dados. Tente recarregar a página.");
  }
}
async function loadBoardData() {
  await loadData();
  renderColumns();
  renderCards();
  updateStats();
  connectWS();
}
async function loadData() {
  const columnsResponse = await columnService.getColumnsForBoard(
    state.board.id
  );
  if (!columnsResponse?.ok) throw new Error("Erro ao carregar colunas");
  state.columns = await columnsResponse.json();
  state.columns.sort((a, b) => a.position - b.position);
  state.solucionadoId = null;
  state.naoSolucionadoId = null;
  if (state.board.is_public) {
    state.columns.forEach((col) => {
      const titleLower = col.title.trim().toLowerCase();
      if (titleLower === "solucionado") state.solucionadoId = col.id;
      if (titleLower === "não solucionado") state.naoSolucionadoId = col.id;
    });
  }
  const cardPromises = state.columns.map(async (col) => {
    const res = await cardService.getCardsForColumn(col.id);
    return res?.ok ? res.json() : [];
  });
  state.cards = (await Promise.all(cardPromises)).flat();
}
async function loadUsers() {
  try {
    const response = await userService.getUsers();
    state.users = response?.ok ? await response.json() : [];
  } catch (error) {
    state.users = [];
  }
}
function showSection(sectionId) {
  document
    .querySelectorAll(".content-section, #kanbanSection")
    .forEach((section) => {
      if (section) section.style.display = "none";
    });
  const sectionElement = document.getElementById(sectionId);
  if (sectionElement) sectionElement.style.display = "block";
  state.activeSection = sectionId;
}

// --- LÓGICA DE UI E RENDERIZAÇÃO ---
function updateUIForPublicBoard() {
    document.getElementById("btnBackToBoards").style.display = "none";
    document.getElementById(
        "boardTitleHeader"
    ).innerHTML = `<i class="fas fa-headset"></i> Suporte`;
    const btnInvite = document.getElementById("btnInviteUser");
    const boardMembers = document.getElementById("boardMembers");
    const publicStats = document.getElementById("publicBoardStats");
    if (btnInvite) btnInvite.style.display = "none";
    if (boardMembers) boardMembers.style.display = "none";
    if (publicStats) publicStats.style.display = "flex";
    
    document.getElementById("btnLeaveBoard").style.display = "none";
}
function updateUIForPrivateBoard() {
    document.getElementById("btnBackToBoards").style.display = "inline-flex";
    document.getElementById(
        "boardTitleHeader"
    ).innerHTML = `<i class="fas fa-user-lock"></i> ${state.board.title}`;
    const publicStats = document.getElementById("publicBoardStats");
    if (publicStats) publicStats.style.display = "none";

    const isOwner = String(state.board.owner_id) === String(state.user.id);

    const btnInvite = document.getElementById("btnInviteUser");
    const boardMembers = document.getElementById("boardMembers");
    const btnLeave = document.getElementById("btnLeaveBoard");

    if (btnInvite) btnInvite.style.display = isOwner ? "inline-flex" : "none";
    if (boardMembers) boardMembers.style.display = "flex";
    if (btnLeave) btnLeave.style.display = !isOwner ? "inline-flex" : "none";

    renderBoardMembers();
}
async function loadAndShowPrivateBoards() {
  showSection("privateBoardsSection");
  elements.loader.style.display = "flex";
  try {
    const response = await boardService.getPrivateBoards();
    if (response?.ok) {
      state.privateBoards = await response.json();
      renderPrivateBoardsList();
    } else {
      showError("Não foi possível carregar seus quadros privados.");
    }
  } catch (error) {
    showError("Erro de conexão ao buscar quadros privados.");
  } finally {
    elements.loader.style.display = "none";
  }
}
function renderPrivateBoardsList() {
  const container = document.getElementById("privateBoardsList");
  if (!container) return;
  container.innerHTML = "";
  if (state.privateBoards.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted);">Você ainda não tem quadros privados. Crie um ou aguarde um convite!</p>`;
    return;
  }
  state.privateBoards.forEach((board) => {
    const isOwner = board.owner_id === state.user.id;
    const card = document.createElement("div");
    card.className = "private-board-card";
    card.dataset.boardId = board.id;
    let ownerTagHTML = "";
    if (!isOwner) {
      const ownerDisplayName =
        userDisplayNameMap[board.owner_name] || board.owner_name;
      ownerTagHTML = `<div class="board-owner-tag">Quadro de ${ownerDisplayName}</div>`;
    }
    card.innerHTML = ` <div class="private-board-header"><h3><i class="fas fa-user-lock" style="color:${
      board.color || "#3498db"
    }"></i> ${board.title}</h3></div> ${ownerTagHTML} <p>${
      board.description || "Sem descrição."
    }</p> <div class="private-board-actions"> <button class="btn btn-primary btn-view-board"><i class="fas fa-arrow-right"></i> Acessar</button> ${
      isOwner
        ? `<button class="btn btn-secondary btn-delete-board"><i class="fas fa-times"></i> Excluir</button>`
        : ""
    } </div>`;
    card
      .querySelector(".btn-view-board")
      .addEventListener("click", () => selectPrivateBoard(board.id));
    if (isOwner) {
      card
        .querySelector(".btn-delete-board")
        .addEventListener("click", (event) =>
          handleDeleteBoard(board.id, event)
        );
    }
    container.appendChild(card);
  });
}
async function selectPrivateBoard(boardId) {
  const selectedBoard = state.privateBoards.find((b) => b.id === boardId);
  if (!selectedBoard) return;
  elements.loader.style.display = "flex";
  state.board = selectedBoard;

  await loadBoardMembers(); 
  updateUIForPrivateBoard(); 

  await loadBoardData();
  showSection("kanbanSection");
  elements.loader.style.display = "none";
}
function handleAssigneeClick(event) {
  const item = event.target.closest(".assignee-item");
  if (!item) return;
  document.getElementById("taskAssignee").value = item.dataset.value;
  item.parentElement
    .querySelectorAll(".assignee-item")
    .forEach((el) => el.classList.remove("selected"));
  item.classList.add("selected");
  handleFormInput();
}
function handlePrivateAssigneeClick(event) {
  const item = event.target.closest(".assignee-item");
  if (!item) return;
  document.getElementById("privateTaskAssignee").value = item.dataset.value;
  item.parentElement
    .querySelectorAll(".assignee-item")
    .forEach((el) => el.classList.remove("selected"));
  item.classList.add("selected");
  handlePrivateFormInput();
}
function handleFormInput() {
  if (state.editingCardId) {
    state.isModalDirty = true;
    autoSave();
  }
}
function handlePrivateFormInput() {
  if (state.editingCardId) {
    state.isModalDirty = true;
    autoSavePrivate();
  }
}
function renderColumns() {
  const kanbanContainer = elements.kanbanContainer;
  kanbanContainer.innerHTML = "";
  let columnsToRender = state.columns;
  if (state.board.is_public) {
    columnsToRender = state.columns.filter(
      (col) =>
        col.id !== state.solucionadoId && col.id !== state.naoSolucionadoId
    );
  }
  columnsToRender.forEach((col) => {
    kanbanContainer.appendChild(createColumnElement(col));
  });
  const addColumnPlaceholder = document.createElement("div");
  addColumnPlaceholder.className = "add-column-placeholder";
  addColumnPlaceholder.innerHTML = `<button class="add-column-btn" onclick="openColumnModal()"><i class="fas fa-plus"></i> Adicionar Coluna</button>`;
  kanbanContainer.appendChild(addColumnPlaceholder);
  addDragAndDropListenersToColumns();
}
function createColumnElement(column) {
  const columnEl = document.createElement("div");
  columnEl.className = "column";
  columnEl.dataset.columnId = column.id;
  const iconMap = {
    "casos suporte": "fas fa-headset",
    "upgrades/retenção": "fas fa-arrow-up",
    escallo: "fas fa-phone",
    "a fazer": "fas fa-list-alt",
    "em andamento": "fas fa-tasks",
  };
  const iconClass = iconMap[column.title.toLowerCase()] || "fas fa-columns";
  columnEl.innerHTML = ` <div class="column-header"> <div class="column-title" style="color: ${column.color};"> <i class="${iconClass}"></i> <span>${column.title}</span> <button class="delete-column-btn" onclick="deleteColumn(${column.id})"><i class="fas fa-times"></i></button> </div> <div class="column-actions"><button class="add-task-btn" onclick="openModal(null, ${column.id})"><i class="fas fa-plus"></i></button></div> </div> <div class="task-list" data-column-id="${column.id}"></div>`;
  return columnEl;
}
async function deleteColumn(columnId) {
    showToast({
        message: "Tem certeza que deseja excluir esta coluna? A coluna deve estar vazia.",
        type: 'confirm',
        onConfirm: async () => {
            try {
                const response = await columnService.deleteColumn(columnId);
                if (!response.ok) {
                    const errorData = await response.json();
                    showError(errorData.error || "Não foi possível excluir a coluna.");
                }
            } catch (error) {
                showError("Erro de conexão ao excluir a coluna.");
            }
        }
    });
}
function addDragAndDropListenersToColumns() {
  document.querySelectorAll(".task-list").forEach((taskList) => {
    taskList.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.currentTarget.classList.add("drag-over");
    });
    taskList.addEventListener("dragleave", (e) =>
      e.currentTarget.classList.remove("drag-over")
    );
    taskList.addEventListener("drop", (e) => {
      e.currentTarget.classList.remove("drag-over");
      handleDrop(e);
    });
  });
}
function renderCards() {
  document
    .querySelectorAll(".task-list")
    .forEach((list) => (list.innerHTML = ""));
  let cardsToRender = state.cards;
  if (state.board.is_public) {
    cardsToRender = state.cards.filter(
      (c) =>
        c.column_id !== state.solucionadoId &&
        c.column_id !== state.naoSolucionadoId
    );
  }
  cardsToRender.sort((a, b) => a.position - b.position);
  cardsToRender.forEach((card) => {
    const list = document.querySelector(
      `.task-list[data-column-id="${card.column_id}"]`
    );
    if (list) list.appendChild(createCardElement(card));
  });
}
function createUserAvatar(user) {
  const avatarElement = document.createElement("div");
  avatarElement.className = "assignee-avatar";
  if (user && user.avatar) {
    avatarElement.style.backgroundImage = `url(${user.avatar})`;
  } else if (user) {
    const displayName = userDisplayNameMap[user.email] || user.username || "U";
    avatarElement.textContent = displayName.charAt(0).toUpperCase();
  } else {
    const icon = document.createElement("i");
    icon.className = "fas fa-user";
    avatarElement.appendChild(icon);
  }
  return avatarElement;
}
function createCardElement(card) {
  let isOverdue = false,
    isDueToday = false;
  const isCompleted =
    state.board.is_public &&
    (card.column_id === state.solucionadoId ||
      card.column_id === state.naoSolucionadoId);
  if (card.due_date && !isCompleted) {
    const now = new Date(),
      dueDate = new Date(card.due_date);
    if (now > dueDate) isOverdue = true;
    else {
      const warningTime = new Date(dueDate.getTime());
      warningTime.setHours(warningTime.getHours() - 1);
      if (now >= warningTime) isDueToday = true;
    }
  }
  const div = document.createElement("div");
  let taskClasses = `task priority-${card.priority || "media"}`;
  if (isOverdue) taskClasses += " overdue";
  if (isDueToday) taskClasses += " due-today";
  div.className = taskClasses;
  div.draggable = true;
  div.dataset.cardId = card.id;
  let userSource = state.board.is_public ? state.users : state.boardMembers;
  const assignedUser = userSource.find(
    (u) => u.username === card.assigned_to || u.email === card.assigned_to
  );
  const assigneeDisplayName = assignedUser
    ? userDisplayNameMap[assignedUser.email] || assignedUser.username
    : "N/A";
  const assigneeAvatarElement = createUserAvatar(assignedUser);
  let statusIconHTML = "";
  if (isOverdue)
    statusIconHTML = '<i class="fas fa-exclamation-triangle overdue-icon"></i>';
  else if (isDueToday)
    statusIconHTML = '<i class="fas fa-clock due-today-icon"></i>';
  else if (card.due_date) statusIconHTML = '<i class="fas fa-calendar"></i>';
  div.innerHTML = ` <div class="task-actions"><button class="action-btn delete-btn"><i class="fas fa-trash"></i></button></div> <div class="task-header"><div class="task-title" style="word-break: break-word;">${
    card.title
  }</div></div> <div class="task-meta"> <div class="task-assignee">${
    assigneeAvatarElement.outerHTML
  }<span>${assigneeDisplayName}</span></div> <div class="task-due-info"> <span class="task-date-text">${
    card.due_date
      ? new Date(card.due_date).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : ""
  }</span> <div class="task-status-icons">${statusIconHTML}</div> </div> </div>`;
  div.addEventListener("click", () => editCard(card.id));
  div.addEventListener("dragstart", (e) => {
    e.target.classList.add("dragging");
    e.dataTransfer.setData("text/plain", card.id);
  });
  div.addEventListener("dragend", (e) => e.target.classList.remove("dragging"));
  div.querySelector(".delete-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    deleteCard(card.id);
  });
  return div;
}

// --- LÓGICA DE MODAIS ---

function setupPriorityHandlers(formId, modalId) {
  const form = document.getElementById(formId);
  const modalContent = document.querySelector(`#${modalId} .modal-content`);
  if (!form || !modalContent) return () => {};

  const priorityRadios = form.querySelectorAll('input[name="priority"]');

  const updateColor = (priority) => {
    modalContent.classList.remove(
      "priority-baixa",
      "priority-media",
      "priority-alta"
    );
    modalContent.classList.add(`priority-${priority || "media"}`);
  };

  priorityRadios.forEach((radio) => {
    radio.onchange = (e) => updateColor(e.target.value);
  });

  return (initialPriority) => {
    const priorityValue = initialPriority || "media";
    const inputToCheck = form.querySelector(
      `input[name="priority"][value="${priorityValue}"]`
    );
    if (inputToCheck) {
      inputToCheck.checked = true;
    }
    updateColor(priorityValue);
  };
}

async function openModal(columnName, columnId) {
    if (!state.board.is_public) {
        await openPrivateTaskModal(columnId);
        return;
    }
    if (!columnId) return;

    await loadModalHTML('taskModal');
    
    elements.taskModal = document.getElementById('taskModal');
    elements.taskForm = document.getElementById('taskForm');
    elements.modalTitle = document.getElementById('modalTitle');
    elements.btnConfirm = document.getElementById('btn-confirm-task');
    elements.assigneeSelector = document.getElementById('assignee-selector');
    
    elements.taskForm.onsubmit = handleSubmit;
    elements.assigneeSelector.onclick = handleAssigneeClick;
    document.getElementById('btn-solve').onclick = () => moveCardToSolved(true);
    document.getElementById('btn-unsolve').onclick = () => moveCardToSolved(false);
    document.getElementById('btn-return-to-scale').onclick = returnCardToBoard;

    const setInitialPriority = setupPriorityHandlers('taskForm', 'taskModal');

    state.isModalDirty = false;
    state.editingCardId = null;
    state.currentColumnId = columnId;
    elements.taskForm.reset();
    setInitialPriority('media'); 
    
    elements.modalTitle.querySelector('span').textContent = 'Nova Tarefa';
    document.getElementById('new-task-description-group').style.display = 'block';
    document.querySelector('#taskModal .modal-comments').style.display = 'none';
    document.getElementById('btn-solve').style.display = 'none';
    document.getElementById('btn-unsolve').style.display = 'none';
    document.getElementById('btn-return-to-scale').style.display = 'none';
    elements.btnConfirm.style.display = 'inline-flex';
    elements.assigneeSelector.innerHTML = '<div style="text-align:center; color: var(--text-muted);">Carregando...</div>';
    clearComments();
    elements.taskModal.style.display = 'flex';
    document.getElementById('taskTitle').focus();
    setTimeout(() => populateAssigneeSelector(null, 'public'), 10);
}

async function editCard(cardId) {
    if (!state.board.is_public) {
        await editPrivateTask(cardId);
        return;
    }
    await loadModalHTML('taskModal');

    elements.taskModal = document.getElementById('taskModal');
    elements.taskForm = document.getElementById('taskForm');
    elements.modalTitle = document.getElementById('modalTitle');
    elements.assigneeSelector = document.getElementById('assignee-selector');
    elements.btnConfirm = document.getElementById('btn-confirm-task');

    const card = state.cards.find(c => c.id === cardId);
    if (!card) return;

    document.getElementById('btn-solve').onclick = () => moveCardToSolved(true);
    document.getElementById('btn-unsolve').onclick = () => moveCardToSolved(false);
    document.getElementById('btn-return-to-scale').onclick = returnCardToBoard;
    elements.assigneeSelector.onclick = handleAssigneeClick;

    const setInitialPriority = setupPriorityHandlers('taskForm', 'taskModal');

    state.isModalDirty = false;
    state.editingCardId = cardId;
    elements.taskForm.reset(); 
    
    setInitialPriority(card.priority);
    
    elements.modalTitle.querySelector('span').textContent = 'Editar Tarefa';
    document.getElementById('taskTitle').value = card.title;
    document.getElementById('new-task-description-group').style.display = 'none';
    document.querySelector('#taskModal .modal-comments').style.display = 'flex';
    elements.btnConfirm.style.display = 'none';
    
    const isArchived = card.column_id === state.solucionadoId || card.column_id === state.naoSolucionadoId;
    document.getElementById('btn-solve').style.display = isArchived ? 'none' : 'inline-flex';
    document.getElementById('btn-unsolve').style.display = isArchived ? 'none' : 'inline-flex';
    document.getElementById('btn-return-to-scale').style.display = isArchived ? 'inline-flex' : 'none';

    elements.assigneeSelector.innerHTML = '<div style="text-align:center; color: var(--text-muted);">Carregando...</div>';
    clearComments();
    elements.taskModal.style.display = 'flex';
    setTimeout(() => {
        populateAssigneeSelector(card.assigned_to, 'public');
        if (card.due_date) {
            const localDate = new Date(card.due_date);
            localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
            document.getElementById('taskDate').value = localDate.toISOString().slice(0, 16);
        } else {
            document.getElementById('taskDate').value = '';
        }
        renderComments(card.description);
        elements.taskForm.removeEventListener('input', handleFormInput);
        elements.taskForm.addEventListener('input', handleFormInput);
    }, 10);
}

async function handleSubmit(e) {
  e.preventDefault();
  if (state.editingCardId) return;
  const cardData = getFormData();
  if (!cardData.title) {
    showError("O ID e Nome do Cliente é obrigatório.");
    return;
  }
  try {
    const response = await cardService.createCard(
      state.currentColumnId,
      cardData
    );
    if (response?.ok) {
      closeModal();
    } else {
      showError("Erro ao criar tarefa.");
    }
  } catch (error) {
    showError("Erro de conexão ao criar tarefa.");
  }
}
async function handlePrivateSubmit(e) {
  e.preventDefault();
  if (state.editingCardId) return;
  const cardData = getPrivateFormData();
  if (!cardData.title) {
    showError("O título da tarefa é obrigatório.");
    return;
  }
  try {
    const response = await cardService.createCard(
      state.currentColumnId,
      cardData
    );
    if (response?.ok) {
      closePrivateTaskModal();
    } else {
      showError("Erro ao criar tarefa privada.");
    }
  } catch (error) {
    showError("Erro de conexão ao criar tarefa privada.");
  }
}

async function openPrivateTaskModal(columnId) {
  await loadModalHTML("privateTaskModal");
  elements.privateTaskModal = document.getElementById("privateTaskModal");
  elements.privateTaskForm = document.getElementById("privateTaskForm");
  elements.privateAssigneeSelector = document.getElementById(
    "private-assignee-selector"
  );
  elements.privateTaskForm.onsubmit = handlePrivateSubmit;
  elements.privateAssigneeSelector.onclick = handlePrivateAssigneeClick;

  const setInitialPriority = setupPriorityHandlers(
    "privateTaskForm",
    "privateTaskModal"
  );

  state.isModalDirty = false;
  state.editingCardId = null;
  state.currentColumnId = columnId;
  elements.privateTaskForm.reset();
  setInitialPriority("media");

  document
    .getElementById("privateModalTitle")
    .querySelector("span").textContent = "Nova Tarefa";
  document.getElementById("private-new-task-description-group").style.display =
    "block";
  document.querySelector("#privateTaskModal .modal-comments").style.display =
    "none";
  document.getElementById("btn-confirm-private-task").style.display =
    "inline-flex";
  elements.privateAssigneeSelector.innerHTML = "";
  document.getElementById("private-comments-list").innerHTML = "";
  elements.privateTaskModal.style.display = "flex";
  document.getElementById("privateTaskTitle").focus();
  setTimeout(() => {
    populateAssigneeSelector(null, "private");
  }, 10);
}

async function editPrivateTask(cardId) {
  await loadModalHTML("privateTaskModal");
  elements.privateTaskModal = document.getElementById("privateTaskModal");
  elements.privateTaskForm = document.getElementById("privateTaskForm");
  elements.privateAssigneeSelector = document.getElementById(
    "private-assignee-selector"
  );

  const card = state.cards.find((c) => c.id === cardId);
  if (!card) return;
  if (!state.boardMembers || state.boardMembers.length === 0) {
    await loadBoardMembers();
  }

  const setInitialPriority = setupPriorityHandlers(
    "privateTaskForm",
    "privateTaskModal"
  );
  elements.privateAssigneeSelector.onclick = handlePrivateAssigneeClick;

  state.isModalDirty = false;
  state.editingCardId = cardId;
  elements.privateTaskForm.reset();
  setInitialPriority(card.priority);

  document
    .getElementById("privateModalTitle")
    .querySelector("span").textContent = "Editar Tarefa";
  document.getElementById("privateTaskTitle").value = card.title;
  document.getElementById("private-new-task-description-group").style.display =
    "none";
  document.querySelector("#privateTaskModal .modal-comments").style.display =
    "flex";
  document.getElementById("btn-confirm-private-task").style.display = "none";
  elements.privateTaskModal.style.display = "flex";
  setTimeout(() => {
    populateAssigneeSelector(card.assigned_to, "private");
    if (card.due_date) {
      const localDate = new Date(card.due_date);
      localDate.setMinutes(
        localDate.getMinutes() - localDate.getTimezoneOffset()
      );
      document.getElementById("privateTaskDate").value = localDate
        .toISOString()
        .slice(0, 16);
    } else {
      document.getElementById("privateTaskDate").value = "";
    }
    renderPrivateComments(card.description);
    elements.privateTaskForm.removeEventListener(
      "input",
      handlePrivateFormInput
    );
    elements.privateTaskForm.addEventListener("input", handlePrivateFormInput);
  }, 10);
}

function closeModal() {
  const modal = document.getElementById("taskModal");
  if (state.editingCardId && state.isModalDirty) {
    autoSave.cancel();
    saveCardChanges();
  }
  _performCloseAnimation(modal);
  state.editingCardId = null;
  state.currentColumnId = null;
  state.isModalDirty = false;
}
function closePrivateTaskModal() {
  const modal = document.getElementById("privateTaskModal");
  if (state.editingCardId && state.isModalDirty) {
    autoSavePrivate.cancel();
    savePrivateCardChanges();
  }
  _performCloseAnimation(modal);
  state.editingCardId = null;
  state.currentColumnId = null;
  state.isModalDirty = false;
}
function getFormData() {
  const form = document.getElementById("taskForm");
  const formData = new FormData(form);
  let description;
  if (state.editingCardId) {
    description = JSON.stringify({
      observacoes: getComments("observacoes-comments"),
      tentativas: getComments("tentativas-comments"),
      resolucao: getComments("resolucao-comments"),
    });
  } else {
    const descText = formData.get("description") || "";
    const loggedInUser = state.users.find((u) => u.id === state.user.id);
    const authorName = loggedInUser
      ? userDisplayNameMap[loggedInUser.email] || loggedInUser.username
      : "Desconhecido";
    description = JSON.stringify({
      observacoes: descText
        ? [
            {
              text: descText,
              author: authorName,
              timestamp: new Date().toLocaleString("pt-BR"),
            },
          ]
        : [],
      tentativas: [],
      resolucao: [],
    });
  }
  const dateValue = formData.get("date");
  let dueDate = dateValue ? new Date(dateValue).toISOString() : null;
  return {
    title: formData.get("title"),
    description,
    assigned_to: formData.get("assignee"),
    priority: formData.get("priority"),
    due_date: dueDate,
  };
}
function getPrivateFormData() {
  const form = document.getElementById("privateTaskForm");
  const formData = new FormData(form);
  let description;
  if (state.editingCardId) {
    description = JSON.stringify({ comments: getPrivateComments() });
  } else {
    const descText = formData.get("description") || "";
    const loggedInUser = state.boardMembers.find((u) => u.id === state.user.id);
    const authorName = loggedInUser
      ? userDisplayNameMap[loggedInUser.email] || loggedInUser.username
      : "Desconhecido";
    description = JSON.stringify({
      comments: descText
        ? [
            {
              text: descText,
              author: authorName,
              timestamp: new Date().toLocaleString("pt-BR"),
            },
          ]
        : [],
    });
  }
  const dateValue = formData.get("date");
  let dueDate = dateValue ? new Date(dateValue).toISOString() : null;
  return {
    title: formData.get("title"),
    description,
    assigned_to: formData.get("assignee"),
    priority: formData.get("priority"),
    due_date: dueDate,
  };
}
const autoSave = debounce(saveCardChanges, 500);
const autoSavePrivate = debounce(savePrivateCardChanges, 500);
async function saveCardChanges() {
  if (!state.editingCardId || !state.isModalDirty) return;
  const cardData = getFormData();
  try {
    await cardService.updateCard(state.editingCardId, cardData);
    state.isModalDirty = false;
  } catch (error) {
    console.error("Autosave público falhou", error);
  }
}
async function savePrivateCardChanges() {
  if (!state.editingCardId || !state.isModalDirty) return;
  const cardData = getPrivateFormData();
  try {
    await cardService.updateCard(state.editingCardId, cardData);
    state.isModalDirty = false;
  } catch (error) {
    console.error("Autosave privado falhou", error);
  }
}
async function openColumnModal(columnId = null) {
  await loadModalHTML("columnModal");
  elements.columnModal = document.getElementById("columnModal");
  elements.columnForm = document.getElementById("columnForm");
  elements.columnForm.onsubmit = handleColumnSubmit;
  elements.columnForm.reset();
  state.editingColumnId = columnId;
  if (columnId) {
    const column = state.columns.find((c) => c.id === columnId);
    if (column) {
      document.getElementById("columnId").value = column.id;
      document.getElementById("columnTitle").value = column.title;
      document.getElementById("columnColor").value = column.color;
      document
        .getElementById("columnModalTitle")
        .querySelector("span").textContent = "Editar Coluna";
    }
  } else {
    document.getElementById("columnId").value = "";
    document.getElementById("columnTitle").value = "";
    document.getElementById("columnColor").value = "#e4e6ea";
    document
      .getElementById("columnModalTitle")
      .querySelector("span").textContent = "Nova Coluna";
  }
  elements.columnModal.style.display = "flex";
}
function closeColumnModal() {
  _performCloseAnimation(document.getElementById("columnModal"));
  state.editingColumnId = null;
}
async function handleColumnSubmit(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const columnData = {
    board_id: state.board.id,
    title: formData.get("title"),
    color: formData.get("color"),
  };
  if (!columnData.title) {
    showError("O título da coluna é obrigatório.");
    return;
  }
  try {
    let response;
    if (state.editingColumnId) {
      /* Lógica de edição aqui */
    } else {
      response = await columnService.createColumn(columnData);
    }
    if (response?.ok) {
      closeColumnModal();
    } else {
      const err = await response.json();
      showError(err.error || "Erro ao salvar coluna.");
    }
  } catch (error) {
    showError("Erro de conexão ao salvar a coluna.");
  }
}
async function openPrivateBoardModal() {
  await loadModalHTML("privateBoardModal");
  document.getElementById("privateBoardForm").onsubmit =
    handlePrivateBoardSubmit;
  const modal = document.getElementById("privateBoardModal");
  if (modal) {
    modal.style.display = "flex";
    document.getElementById("boardTitle").focus();
  }
}
function closePrivateBoardModal() {
  _performCloseAnimation(document.getElementById("privateBoardModal"));
}
async function handlePrivateBoardSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const title = formData.get("title");
  if (!title || title.trim() === "") {
    showError("O título do quadro é obrigatório.");
    return;
  }
  const boardData = {
    title: title.trim(),
    description: formData.get("description").trim(),
    is_public: false,
    color: "#3498db",
  };
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
  try {
    const response = await boardService.createBoard(boardData);
    if (response?.ok) {
      closePrivateBoardModal();
      await loadAndShowPrivateBoards();
    } else {
      const errorData = await response.json();
      showError(errorData.error || "Erro ao criar o quadro privado.");
    }
  } catch (error) {
    showError("Erro de conexão ao criar o quadro.");
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML =
      '<i class="fas fa-check-circle"></i> <span>Salvar Quadro</span>';
  }
}
async function handleDeleteBoard(boardId, event) {
    event.stopPropagation();
    const boardTitle = state.privateBoards.find((b) => b.id === boardId)?.title || "este quadro";
    
    showToast({
        message: `Tem certeza que deseja excluir "${boardTitle}"? Todas as colunas e tarefas serão permanentemente excluídas.`,
        type: 'confirm',
        onConfirm: async () => {
            try {
                const response = await boardService.deleteBoard(boardId);
                if (response?.ok) {
                    await loadAndShowPrivateBoards();
                    showToast({ message: `Quadro "${boardTitle}" excluído.`, type: 'success' });
                } else {
                    const errorData = await response.json();
                    showError(errorData.error || "Falha ao excluir o quadro.");
                }
            } catch (error) {
                showError("Erro de conexão ao tentar excluir o quadro.");
            }
        }
    });
}
async function deleteCard(cardId) {
    showToast({
        message: "Tem certeza que deseja excluir esta tarefa?",
        type: 'confirm',
        onConfirm: async () => {
            try {
                await cardService.deleteCard(cardId);
            } catch (error) {
                showError("Erro ao excluir a tarefa");
            }
        }
    });
}
async function moveCardToSolved(solved) {
  if (!state.editingCardId) return;

  const targetId = solved ? state.solucionadoId : state.naoSolucionadoId;
  if (!targetId) {
    showError(
      `Coluna '${
        solved ? "Solucionado" : "Não Solucionado"
      }' não encontrada. Verifique os nomes das colunas no banco de dados.`
    );
    return;
  }

  if (state.isModalDirty) {
    autoSave.cancel();
    await saveCardChanges();
  }

  try {
    await cardService.moveCard(state.editingCardId, targetId, 0); 

    const cardToMove = state.cards.find((c) => c.id === state.editingCardId);
    if (cardToMove) {
      cardToMove.column_id = targetId;
    }

    renderCards();
    updateStats();

    closeModal();
  } catch (error) {
    console.error("Erro ao mover o card:", error);
    showError("Não foi possível mover a tarefa. Tente novamente.");
  }
}

async function returnCardToBoard() {
  if (!state.editingCardId) return;

  const firstActiveColumn = state.columns.find(
    (c) => c.id !== state.solucionadoId && c.id !== state.naoSolucionadoId
  );
  if (!firstActiveColumn) {
    showError("Nenhuma coluna de trabalho ativa encontrada.");
    return;
  }

  if (state.isModalDirty) {
    autoSave.cancel();
    await saveCardChanges();
  }

  try {
    await cardService.moveCard(state.editingCardId, firstActiveColumn.id, 0); 

    const cardToMove = state.cards.find((c) => c.id === state.editingCardId);
    if (cardToMove) {
      cardToMove.column_id = firstActiveColumn.id;
    }

    renderCards();
    updateStats();

    closeModal();
  } catch (error) {
    console.error("Erro ao retornar o card:", error);
    showError("Não foi possível retornar a tarefa ao quadro. Tente novamente.");
  }
}

function getDragAfterElement(container, y) {
  const draggableElements = [
    ...container.querySelectorAll(".task:not(.dragging)"),
  ];
  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset)
        return { offset: offset, element: child };
      else return closest;
    },
    { offset: Number.NEGATIVE_INFINITY }
  ).element;
}

function handleDrop(e) {
    e.preventDefault();
    const targetList = e.target.closest(".task-list");
    if (!targetList) return;
    
    targetList.classList.remove("drag-over");
    
    const cardId = parseInt(e.dataTransfer.getData("text/plain"));
    const cardElement = document.querySelector(`.task[data-card-id="${cardId}"]`);
    if (!cardElement) return;

    const afterElement = getDragAfterElement(targetList, e.clientY);
    if (afterElement) {
        targetList.insertBefore(cardElement, afterElement);
    } else {
        targetList.appendChild(cardElement);
    }
    
    const newColumnId = parseInt(targetList.dataset.columnId);
    
    const cardsInNewColumn = Array.from(targetList.querySelectorAll('.task'));
    const newPosition = cardsInNewColumn.findIndex(card => card.dataset.cardId == cardId);

    const movedCard = state.cards.find(c => c.id === cardId);
    if (movedCard) {
        movedCard.column_id = newColumnId;
        movedCard.position = newPosition;
    }

    cardService.moveCard(cardId, newColumnId, newPosition).catch(err => {
        showError("Falha ao sincronizar a ordem dos cards.");
        loadData().then(() => {
            renderColumns();
            renderCards();
        });
    });
}

function connectWS() {
    if (state.ws && state.ws.readyState < 2) {
        state.ws.close();
    }
    
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${location.host}/ws/board/${state.board.id}`;
    
    console.log("Tentando conectar ao WebSocket em:", wsUrl);
    
    try {
        state.ws = new WebSocket(wsUrl);
    } catch (error) {
        console.error("Falha ao criar o WebSocket. Verifique a URL:", error);
        showError("Não foi possível conectar ao servidor para atualizações em tempo real.");
        return;
    }


    state.ws.onmessage = async (e) => {
        const { type, payload, sender_id } = JSON.parse(e.data);

        if (sender_id && sender_id === state.user.id) {
            return;
        }

        if (type === 'CARD_MOVED') {
            const { card_id, new_column_id, new_position } = payload;
            
            const cardElement = document.querySelector(`.task[data-card-id="${card_id}"]`);
            const newColumnElement = document.querySelector(`.task-list[data-column-id="${new_column_id}"]`);
            
            if (cardElement && newColumnElement) {
                const cardsInNewColumn = Array.from(newColumnElement.querySelectorAll('.task'));
                newColumnElement.insertBefore(cardElement, cardsInNewColumn[new_position] || null);
                
                const cardInState = state.cards.find(c => c.id === card_id);
                if (cardInState) {
                    cardInState.column_id = new_column_id;
                    cardInState.position = new_position;
                }
            }
        } else if (type === "BOARD_STATE_UPDATED" || type.includes("CARD") || type.includes("COLUMN")) {
            await loadData();
            renderColumns();
            renderCards();
            updateStats();
        }
    };

    state.ws.onopen = () => {
        console.log(`Conexão WebSocket para o board ${state.board.id} estabelecida com sucesso.`);
    };

    state.ws.onclose = () => {
        console.log(`Conexão WebSocket para o board ${state.board.id} fechada.`);
    };

    state.ws.onerror = (err) => {
        console.error("Erro no WebSocket:", err);
        showError("A conexão para atualizações em tempo real falhou.");
    };
}
function updateStats() {
  if (!state.cards || !state.board.is_public) return;
  const publicBoardStats = document.getElementById("publicBoardStats");
  if (!publicBoardStats) return;
  publicBoardStats.style.display = "flex";
  if (!state.solucionadoId || !state.naoSolucionadoId) {
    document.getElementById("pendingTasks").textContent = state.cards.length;
    document.getElementById("completedTasks").textContent = "0";
    document.getElementById("failedTasks").textContent = "0";
    return;
  }
  const completed = state.cards.filter(
    (c) => c.column_id === state.solucionadoId
  ).length;
  const failed = state.cards.filter(
    (c) => c.column_id === state.naoSolucionadoId
  ).length;
  const pending = state.cards.length - completed - failed;
  document.getElementById("pendingTasks").textContent = pending;
  document.getElementById("completedTasks").textContent = completed;
  document.getElementById("failedTasks").textContent = failed;
}
function renderComments(descJson) {
  clearComments();
  if (!descJson) return;
  try {
    const desc = JSON.parse(descJson);
    ["observacoes", "tentativas", "resolucao"].forEach((section) => {
      const container = document.getElementById(`${section}-comments`);
      if (desc[section]?.length && container) {
        const fragment = document.createDocumentFragment();
        desc[section].forEach((comment) =>
          fragment.appendChild(createCommentElement(comment))
        );
        container.appendChild(fragment);
      }
    });
  } catch (e) {
    console.error("Erro ao parsear comentários:", e);
  }
}
function renderPrivateComments(descJson) {
  const container = document.getElementById("private-comments-list");
  if (!container) return;
  container.innerHTML = "";
  if (!descJson) return;
  try {
    const desc = JSON.parse(descJson);
    if (desc.comments?.length) {
      const fragment = document.createDocumentFragment();
      desc.comments.forEach((comment) =>
        fragment.appendChild(createCommentElement(comment))
      );
      container.appendChild(fragment);
    }
  } catch (e) {
    console.error("Erro ao parsear comentários privados:", e);
  }
}
function createCommentElement(comment) {
  const div = document.createElement("div");
  div.className = "comment-item";
  const text = typeof comment === "object" ? comment.text || "" : comment;
  const authorName =
    typeof comment === "object" && comment.author
      ? comment.author
      : "Desconhecido";
  const time =
    typeof comment === "object"
      ? comment.timestamp || new Date().toLocaleString("pt-BR")
      : new Date().toLocaleString("pt-BR");
  let userSource = state.board.is_public ? state.users : state.boardMembers;
  const authorUser = userSource.find(
    (u) => (userDisplayNameMap[u.email] || u.username) === authorName
  );
  const authorAvatarElement = createUserAvatar(authorUser);
  authorAvatarElement.classList.add("comment-avatar");
  div.dataset.author = authorName;
  div.innerHTML = ` <div class="comment-content">${text}</div> <div class="comment-meta"> <span class="comment-author">${authorAvatarElement.outerHTML}${authorName}</span> <span class="comment-timestamp">${time}</span> </div> <div class="comment-item-actions"> <button class="edit-comment-btn" onclick="editComment(this)"><i class="fas fa-pencil-alt"></i></button> <button class="delete-comment-btn" onclick="deleteComment(this)"><i class="fas fa-trash"></i></button> </div>`;
  return div;
}
function getComments(sectionId) {
  const section = document.getElementById(sectionId);
  return Array.from(section?.querySelectorAll(".comment-item") || []).map(
    (item) => ({
      text: item.querySelector(".comment-content").textContent,
      author: item.dataset.author,
      timestamp:
        item.querySelector(".comment-timestamp")?.textContent ||
        new Date().toLocaleString("pt-BR"),
    })
  );
}
function getPrivateComments() {
  return getComments("private-comments-list");
}
function clearComments() {
  ["observacoes", "tentativas", "resolucao"].forEach((section) => {
    const container = document.getElementById(`${section}-comments`);
    const inputContainer = document.getElementById(`${section}-input`);
    if (container) container.innerHTML = "";
    if (inputContainer) {
      inputContainer.style.display = "none";
      inputContainer.querySelector("textarea").value = "";
    }
  });
}
function populateStatsUserFilter() {
  const select = document.getElementById("statsFilterUser");
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = '<option value="all">Todos os Colaboradores</option>';
  state.users.forEach((user) => {
    const userIdentifier = user.username || user.email;
    if (!userIdentifier) return;
    const displayName = userDisplayNameMap[user.email] || userIdentifier;
    const option = document.createElement("option");
    option.value = userIdentifier;
    option.textContent = displayName;
    select.appendChild(option);
  });
  select.value = currentValue || "all";
}
function updateStatsView() {
  const statsModal = document.getElementById("statsModal");
  const status = statsModal.dataset.status;
  const selectedUser = document.getElementById("statsFilterUser").value;
  const body = document.getElementById("statsModalBody");
  const totalElement = document.getElementById("statsTotalCount");
  let cards;
  if (status === "pendente") {
    cards = state.cards.filter(
      (c) =>
        c.column_id !== state.solucionadoId &&
        c.column_id !== state.naoSolucionadoId
    );
  } else {
    const targetColumnId =
      status === "solucionado" ? state.solucionadoId : state.naoSolucionadoId;
    cards = state.cards.filter((c) => c.column_id === targetColumnId);
  }
  if (selectedUser !== "all") {
    cards = cards.filter((card) => card.assigned_to === selectedUser);
  }
  if (totalElement) totalElement.textContent = `Total: ${cards.length}`;
  if (body)
    body.innerHTML =
      cards.length === 0
        ? '<p style="text-align: center; color: var(--text-muted);">Nenhuma tarefa encontrada.</p>'
        : cards
            .map((card) => {
              const assignedUser = state.users.find(
                (u) =>
                  u.username === card.assigned_to ||
                  u.email === card.assigned_to
              );
              const assigneeDisplayName = assignedUser
                ? userDisplayNameMap[assignedUser.email] ||
                  assignedUser.username
                : "N/A";
              const avatarHTML = createUserAvatar(assignedUser).outerHTML;
              return ` <div class="stats-list-item" onclick="closeStatsModal(); editCard(${card.id})"> <div class="task-title">${card.title}</div> <div class="task-meta"><div class="task-assignee">${avatarHTML} ${assigneeDisplayName}</div></div> </div>`;
            })
            .join("");
}
async function openStatsModal(status) {
  await loadModalHTML("statsModal");
  elements.statsModal = document.getElementById("statsModal");
  elements.statsFilterUser = document.getElementById("statsFilterUser");
  if (!elements.statsModal || !elements.statsFilterUser) return;
  elements.statsFilterUser.onchange = updateStatsView;
  const title = document.getElementById("statsModalTitle");
  elements.statsModal.dataset.status = status;
  title.innerHTML =
    status === "solucionado"
      ? '<i class="fas fa-check-circle"></i> Tarefas Solucionadas'
      : status === "nao-solucionado"
      ? '<i class="fas fa-times-circle"></i> Tarefas Não Solucionadas'
      : '<i class="fa-solid fa-spinner"></i> Tarefas Pendentes';
  populateStatsUserFilter();
  updateStatsView();
  elements.statsModal.style.display = "flex";
}
function closeStatsModal() {
  _performCloseAnimation(document.getElementById("statsModal"));
}
async function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  elements.loader.style.display = "flex";
  const formData = new FormData();
  formData.append("avatar", file);
  try {
    const response = await userService.uploadAvatar(formData);
    if (response?.ok) {
      const result = await response.json();
      const userIndex = state.users.findIndex((u) => u.id === state.user.id);
      if (userIndex > -1) state.users[userIndex].avatar = result.avatar_url;
      updateSidebarUser();
      renderCards();
    } else {
      const errorData = await response.json();
      showError(errorData.error || "Falha no upload do avatar.");
    }
  } catch (error) {
    showError("Erro de conexão ao fazer upload.");
  } finally {
    elements.loader.style.display = "none";
    event.target.value = "";
  }
}
async function fetchNotifications() {
  try {
    const res = await notificationService.getNotifications();
    if (res?.ok) {
      state.notifications = await res.json();
      updateNotificationsUI();
    }
  } catch (error) {
    console.error("Erro ao buscar notificações", error);
  }
}
function updateNotificationsUI() {
  const unreadCount = state.notifications.filter((n) => !n.is_read).length;
  elements.invitationsCount.textContent = unreadCount;
  elements.invitationsCount.style.display = unreadCount > 0 ? "flex" : "none";
  renderNotificationsDropdown();
}
function renderNotificationsDropdown() {
  const unreadContainer = document.getElementById(
    "unreadNotificationsContainer"
  );
  const readContainer = document.getElementById("readNotificationsContainer");
  const toggle = document.getElementById("readNotificationsToggle");
  if (!unreadContainer || !readContainer || !toggle) return;
  unreadContainer.innerHTML = "";
  readContainer.innerHTML = "";
  const unreadNotifications = state.notifications.filter((n) => !n.is_read);
  const readNotifications = state.notifications.filter((n) => n.is_read);
  if (state.notifications.length === 0 || unreadNotifications.length === 0) {
    unreadContainer.innerHTML =
      '<div class="invitation-item"><p>Nenhuma notificação nova.</p></div>';
  } else {
    unreadNotifications.forEach((n) =>
      unreadContainer.appendChild(createNotificationElement(n))
    );
  }
  if (readNotifications.length > 0) {
    toggle.style.display = "flex";
    readNotifications.forEach((n) =>
      readContainer.appendChild(createNotificationElement(n))
    );
  } else {
    toggle.style.display = "none";
  }
  const clickListener = () => {
    toggle.classList.toggle("active");
    readContainer.classList.toggle("active");
  };
  toggle.removeEventListener("click", toggle._clickListener);
  toggle.addEventListener("click", clickListener);
  toggle._clickListener = clickListener;
}
function createNotificationElement(n) {
  const item = document.createElement("div");
  item.className = "invitation-item";
  if (n.is_read) item.classList.add("read");
  let finalMessage = n.message;
  if (n.type === "board_invitation") {
    const emailMatch = finalMessage.match(
      /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/
    );
    if (emailMatch) {
      const email = emailMatch[0];
      const displayName = userDisplayNameMap[email] || email;
      finalMessage = finalMessage.replace(email, displayName);
    }
  }
  switch (n.type) {
    case "board_invitation":
      item.innerHTML = `<p>${finalMessage}</p><div class="invitation-actions"><button class="btn btn-secondary btn-reject" onclick="respondToInvitation(this, ${n.invitation_id}, ${n.id}, false)">Rejeitar</button><button class="btn btn-primary btn-accept" onclick="respondToInvitation(this, ${n.invitation_id}, ${n.id}, true)">Aceitar</button></div>`;
      break;
    case "new_task_assigned":
    case "invitation_accepted":
      item.innerHTML = `<p>${finalMessage}</p>`;
      item.classList.add("clickable");
      item.onclick = () => handleGenericNotificationClick(n);
      break;
    default:
      item.innerHTML = `<p>${finalMessage}</p>`;
  }
  return item;
}
async function handleGenericNotificationClick(notification) {
  await notificationService.markNotificationAsRead(notification.id);
  const notifInState = state.notifications.find(
    (n) => n.id === notification.id
  );
  if (notifInState) notifInState.is_read = true;
  updateNotificationsUI();
  if (notification.related_board_id) {
    const boardToLoad = state.privateBoards.find(
      (b) => b.id === notification.related_board_id
    );
    if (boardToLoad) {
      await selectPrivateBoard(boardToLoad.id);
      if (notification.related_card_id) editCard(notification.related_card_id);
    }
  }
}

async function handleLeaveBoard() {
    const boardTitle = state.board.title;
    showToast({
        message: `Tem certeza que deseja sair do quadro "${boardTitle}"? Você perderá o acesso a ele.`,
        type: 'confirm',
        onConfirm: async () => {
            elements.loader.style.display = "flex";
            try {
                const result = await boardService.leaveBoard(state.board.id);
                if (result.ok) {
                    await loadAndShowPrivateBoards();
                    showToast({ message: "Você saiu do quadro.", type: 'success' });
                } else {
                    const errorData = await result.json();
                    showError(errorData.error || "Não foi possível sair do quadro.");
                }
            } catch (error) {
                showError("Erro de conexão ao tentar sair do quadro.");
            } finally {
                elements.loader.style.display = "none";
            }
        }
    });
}

async function handleTaskNotificationClick(notification) {
  await notificationService.markNotificationAsRead(notification.id);
  await fetchNotifications();
  const publicBoardsRes = await boardService.getPublicBoards();
  const publicBoards = publicBoardsRes.ok ? await publicBoardsRes.json() : [];
  const boardToLoad =
    state.privateBoards.find((b) => b.id === notification.related_board_id) ||
    publicBoards.find((b) => b.id === notification.related_board_id);
  if (boardToLoad) {
    state.board = boardToLoad;
    await loadBoardData();
    showSection("kanbanSection");
    if (!boardToLoad.is_public) updateUIForPrivateBoard();
    else updateUIForPublicBoard();
    editCard(notification.related_card_id);
  }
}
async function toggleNotificationsDropdown() {
  const dropdown = elements.invitationsDropdown;
  const isOpening = dropdown.style.display !== "block";
  if (isOpening) {
    if (elements.invitationsCount.style.display !== "none") {
      state.notificationsNeedUpdate = true;
      elements.invitationsCount.style.display = "none";
    }
    dropdown.style.display = "block";
    await fetchNotifications();
  } else {
    await handleMarkNotificationsAsRead();
    dropdown.style.display = "none";
  }
}
async function respondToInvitation(
  button,
  invitationId,
  notificationId,
  accept
) {
  button.closest(".invitation-actions").innerHTML = "Processando...";
  try {
    const res = await notificationService.respondToInvitation(
      invitationId,
      notificationId,
      accept
    );
    if (res?.ok) {
      await fetchNotifications();
      if (accept) {
        showToast({ message: "Convite aceito! Bem-vindo ao novo quadro.", type: 'success' });
        await loadAndShowPrivateBoards();
      }
    } else {
      showError("Falha ao responder ao convite.");
    }
  } catch (e) {
    showError("Erro de conexão ao responder ao convite.");
  }
}
async function handleMarkNotificationsAsRead() {
  if (state.notificationsNeedUpdate) {
    try {
      await notificationService.markAllNotificationsAsRead();
      state.notificationsNeedUpdate = false;
      await fetchNotifications();
    } catch (error) {
      console.error(
        "Falha ao marcar notificações como lidas no backend:",
        error
      );
    }
  }
}
async function openInviteUserModal() {
  await loadModalHTML("inviteUserModal");
  elements.inviteUserModal = document.getElementById("inviteUserModal");
  if (!elements.inviteUserModal) return;
  document.getElementById("inviteUserSearch").oninput = debounce(
    filterInvitableUsers,
    300
  );
  elements.inviteUserModal.style.display = "flex";
  const list = document.getElementById("invitableUsersList");
  list.innerHTML = '<div class="loader-small"></div>';
  try {
    const res = await boardService.getInvitableUsers(state.board.id);
    if (res?.ok) {
      const users = await res.json();
      renderInvitableUsers(users);
    } else {
      list.innerHTML = "<p>Erro ao carregar usuários.</p>";
    }
  } catch (e) {
    list.innerHTML = "<p>Erro de conexão.</p>";
  }
}
function closeInviteUserModal() {
  _performCloseAnimation(document.getElementById("inviteUserModal"));
}
function renderInvitableUsers(users) {
  const list = document.getElementById("invitableUsersList");
  if (!list) return;
  list.className = "invitable-users-grid";
  list.innerHTML = "";
  if (users.length === 0) {
    list.innerHTML =
      '<p class="text-muted text-center" style="grid-column: 1 / -1;">Nenhum usuário para convidar.</p>';
    return;
  }
  users.forEach((user) => {
    const item = document.createElement("div");
    item.className = "invitable-user-item";
    item.dataset.userId = user.id;
    item.dataset.userName = userDisplayNameMap[user.email] || user.username;
    item.dataset.userEmail = user.email;
    const avatarHTML = user.avatar
      ? `<div class="user-avatar" style="background-image: url(${user.avatar})"></div>`
      : `<div class="user-avatar">${(
          userDisplayNameMap[user.email] || user.username
        ).charAt(0)}</div>`;
    item.innerHTML = ` ${avatarHTML} <div class="user-name">${
      userDisplayNameMap[user.email] || user.username
    }</div> <button class="btn btn-primary btn-invite" onclick="inviteUser(this, '${
      user.id
    }')"><i class="fas fa-paper-plane"></i> <span>Convidar</span></button>`;
    list.appendChild(item);
  });
}
async function inviteUser(button, inviteeId) {
  button.disabled = true;
  button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  try {
    const res = await boardService.inviteUserToBoard(state.board.id, inviteeId);
    if (res?.ok) {
      button.innerHTML = '<i class="fas fa-check"></i> Convidado';
      button.classList.add("invited");
    } else {
      showError("Falha ao convidar usuário.");
      button.innerHTML =
        '<i class="fas fa-paper-plane"></i> <span>Convidar</span>';
      button.disabled = false;
    }
  } catch (e) {
    showError("Erro de conexão.");
    button.innerHTML =
      '<i class="fas fa-paper-plane"></i> <span>Convidar</span>';
    button.disabled = false;
  }
}
function filterInvitableUsers() {
  const searchTerm = document
    .getElementById("inviteUserSearch")
    .value.toLowerCase();
  const users = document.querySelectorAll(".invitable-user-item");
  users.forEach((user) => {
    const name = user.dataset.userName.toLowerCase();
    const email = user.dataset.userEmail.toLowerCase();
    if (name.includes(searchTerm) || email.includes(searchTerm)) {
      user.style.display = "flex";
    } else {
      user.style.display = "none";
    }
  });
}
async function loadBoardMembers() {
  try {
    const res = await boardService.getBoardMembers(state.board.id);
    state.boardMembers = res?.ok ? await res.json() : [];
  } catch (e) {
    console.error("Erro ao carregar membros do quadro", e);
    state.boardMembers = [];
  }
}
function renderBoardMembers() {
  const container = document.getElementById("boardMembers");
  if (!container) return;
  container.innerHTML = "";
  state.boardMembers.forEach((member) => {
    const displayName = userDisplayNameMap[member.email] || member.username;
    const avatar = document.createElement("div");
    avatar.className = "board-member-avatar";
    avatar.title = `${displayName} ${member.is_owner ? "(Dono)" : ""}`;
    if (member.avatar) avatar.style.backgroundImage = `url(${member.avatar})`;
    else avatar.textContent = displayName.charAt(0).toUpperCase();
    container.appendChild(avatar);
  });
}
function populateAssigneeSelector(currentAssignee, type = "public") {
  const isPrivate = type === "private";
  const container = document.getElementById(
    isPrivate ? "private-assignee-selector" : "assignee-selector"
  );
  const hiddenInput = document.getElementById(
    isPrivate ? "privateTaskAssignee" : "taskAssignee"
  );
  const userSource = isPrivate ? state.boardMembers : state.users;
  if (!container || !hiddenInput) return;
  hiddenInput.value = "";
  container.innerHTML = userSource
    .map((user) => {
      const userIdentifier = user.username || user.email;
      const displayName =
        userDisplayNameModalMap[user.email] ||
        userDisplayNameMap[user.email] ||
        userIdentifier;
      const isSelected = userIdentifier === currentAssignee;
      if (isSelected) hiddenInput.value = userIdentifier;
      const avatarHTML = user.avatar
        ? `<div class="assignee-item-avatar" style="background-image: url(${user.avatar})"></div>`
        : `<div class="assignee-item-avatar">${displayName
            .charAt(0)
            .toUpperCase()}</div>`;
      return ` <div class="assignee-item ${
        isSelected ? "selected" : ""
      }" data-value="${userIdentifier}"> ${avatarHTML} <span class="assignee-item-name">${displayName}</span> </div>`;
    })
    .join("");
}
async function openManageMembersModal() {
  if (state.board.is_public) return;
  await loadModalHTML("manageMembersModal");
  elements.manageMembersModal = document.getElementById("manageMembersModal");
  if (!elements.manageMembersModal) return;
  elements.manageMembersModal.style.display = "flex";
  renderManageMembersList();
}
function closeManageMembersModal() {
  _performCloseAnimation(document.getElementById("manageMembersModal"));
}
function renderManageMembersList() {
  const list = document.getElementById("boardMembersList");
  if (!list) return;
  list.innerHTML = "";
  const isOwner = state.user.id === state.board.owner_id;
  state.boardMembers.forEach((member) => {
    const item = document.createElement("div");
    item.className = "member-list-item";
    const displayName = userDisplayNameMap[member.email] || member.username;
    const avatar = member.avatar
      ? `<div class="user-avatar" style="background-image: url(${member.avatar})"></div>`
      : `<div class="user-avatar">${displayName.charAt(0)}</div>`;
    let removeButtonHTML = "";
    if (isOwner && !member.is_owner) {
      removeButtonHTML = `<button class="btn btn-sm btn-remove-member" onclick="removeMember('${member.id}')" title="Remover membro"><i class="fas fa-times"></i></button>`;
    }
    item.innerHTML = ` <div class="member-info"> ${avatar} <div class="member-details"> <span class="user-name">${displayName}</span> ${
      member.is_owner ? '<span class="user-role-tag">Dono</span>' : ""
    } </div> </div> ${removeButtonHTML}`;
    list.appendChild(item);
  });
}
async function removeMember(memberId) {
    const member = state.boardMembers.find((m) => m.id === memberId);
    if (!member) return;
    const memberName = userDisplayNameMap[member.email] || member.username;

    showToast({
        message: `Tem certeza que deseja remover "${memberName}" do quadro?`,
        type: 'confirm',
        onConfirm: async () => {
            try {
                const response = await boardService.removeMemberFromBoard(state.board.id, memberId);
                if (response.ok) {
                    state.boardMembers = state.boardMembers.filter((m) => m.id !== memberId);
                    renderManageMembersList();
                    renderBoardMembers();
                    showToast({ message: `${memberName} removido.`, type: 'success' });
                } else {
                    const err = await response.json();
                    showError(err.error || "Falha ao remover o membro.");
                }
            } catch (error) {
                showError("Erro de conexão ao remover membro.");
            }
        }
    });
}
function showError(message) {
    showToast({ message: message, type: 'error' });
}
function showToast({
    message,
    type = 'info',
    duration = 4000,
    onConfirm = null,
    onCancel = null
}) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        info: 'fa-info-circle',
        confirm: 'fa-question-circle',
    };

    let toastHTML = `
        <div class="toast-icon"><i class="fas ${icons[type]}"></i></div>
        <div class="toast-content">
            <div class="toast-message">${message}</div>
    `;

    if (type === 'confirm') {
        toastHTML += `
            <div class="toast-actions">
                <button class="btn btn-secondary btn-cancel-toast">Não</button>
                <button class="btn btn-primary btn-confirm-toast">Sim</button>
            </div>
        `;
    }

    toastHTML += `</div>`;
    toast.innerHTML = toastHTML;
    container.appendChild(toast);

    toast.getBoundingClientRect();
    toast.classList.add('show');

    const removeToast = () => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        toast.addEventListener('transitionend', () => toast.remove());
    };

    if (type === 'confirm') {
        toast.querySelector('.btn-confirm-toast').onclick = () => {
            if (onConfirm) onConfirm();
            removeToast();
        };
        toast.querySelector('.btn-cancel-toast').onclick = () => {
            if (onCancel) onCancel();
            removeToast();
        };
    } else {
        setTimeout(removeToast, duration);
    }
}
window.openModal = openModal;
window.editCard = editCard;
window.closeModal = closeModal;
window.closePrivateTaskModal = closePrivateTaskModal;
window.openStatsModal = openStatsModal;
window.closeStatsModal = closeStatsModal;
window.openColumnModal = openColumnModal;
window.closeColumnModal = closeColumnModal;
window.deleteColumn = deleteColumn;
window.openPrivateBoardModal = openPrivateBoardModal;
window.closePrivateBoardModal = closePrivateBoardModal;
window.openInviteUserModal = openInviteUserModal;
window.closeInviteUserModal = closeInviteUserModal;
window.inviteUser = inviteUser;
window.openManageMembersModal = openManageMembersModal;
window.closeManageMembersModal = closeManageMembersModal;
window.removeMember = removeMember;
window.respondToInvitation = respondToInvitation;
window.handleTaskNotificationClick = handleTaskNotificationClick;
window.toggleCommentInput = (section) => {
  const allInputs = document.querySelectorAll(".comment-input-container");
  const targetInput = document.getElementById(`${section}-input`);
  if (!targetInput) return;
  const isVisible = targetInput.style.display === "block";
  allInputs.forEach((c) => (c.style.display = "none"));
  if (!isVisible) {
    targetInput.style.display = "block";
    targetInput.querySelector("textarea").focus();
  }
};
window.saveComment = (section) => {
  const inputContainer = document.getElementById(`${section}-input`);
  const textarea = inputContainer.querySelector("textarea");
  const text = textarea.value.trim();
  if (text) {
    const container = document.getElementById(`${section}-comments`);
    const loggedInUser = state.users.find((u) => u.id === state.user.id);
    const authorName = loggedInUser
      ? userDisplayNameMap[loggedInUser.email] || loggedInUser.username
      : "Desconhecido";
    const newComment = {
      text: text,
      author: authorName,
      timestamp: new Date().toLocaleString("pt-BR"),
    };
    container.appendChild(createCommentElement(newComment));
    inputContainer.style.display = "none";
    textarea.value = "";
    handleFormInput();
  }
};
window.cancelComment = (section) => {
  const input = document.getElementById(`${section}-input`);
  input.style.display = "none";
  input.querySelector("textarea").value = "";
};
window.togglePrivateCommentInput = () => {
  const targetInput = document.getElementById("private-comment-input");
  if (!targetInput) return;
  const isVisible = targetInput.style.display === "block";
  targetInput.style.display = isVisible ? "none" : "block";
  if (!isVisible) targetInput.querySelector("textarea").focus();
};
window.savePrivateComment = () => {
  const inputContainer = document.getElementById("private-comment-input");
  const textarea = inputContainer.querySelector("textarea");
  const text = textarea.value.trim();
  if (text) {
    const container = document.getElementById("private-comments-list");
    const loggedInUser = state.boardMembers.find((u) => u.id === state.user.id);
    const authorName = loggedInUser
      ? userDisplayNameMap[loggedInUser.email] || loggedInUser.username
      : "Desconhecido";
    const newComment = {
      text,
      author: authorName,
      timestamp: new Date().toLocaleString("pt-BR"),
    };
    container.appendChild(createCommentElement(newComment));
    inputContainer.style.display = "none";
    textarea.value = "";
    handlePrivateFormInput();
  }
};
window.cancelPrivateComment = () => {
  const input = document.getElementById("private-comment-input");
  input.style.display = "none";
  input.querySelector("textarea").value = "";
};
window.deleteComment = (button) => {
    showToast({
        message: "Excluir este comentário?",
        type: 'confirm',
        onConfirm: () => {
            const isPrivate = !!button.closest("#privateTaskModal");
            button.closest(".comment-item").remove();
            if (isPrivate) handlePrivateFormInput();
            else handleFormInput();
        }
    });
};
window.editComment = (button) => {
  const commentItem = button.closest(".comment-item");
  const commentContent = commentItem.querySelector(".comment-content");
  const originalText = commentContent.textContent;
  const isPrivate = !!button.closest("#privateTaskModal");
  const editContainer = document.createElement("div");
  editContainer.className = "comment-edit-container";
  editContainer.innerHTML = ` <textarea class="comment-edit-textarea">${originalText}</textarea> <div class="comment-actions"> <button type="button" class="btn-save"><i class="fas fa-check"></i> Salvar</button> <button type="button" class="btn-cancel"><i class="fas fa-times"></i></button> </div>`;
  commentItem.style.display = "none";
  commentItem.after(editContainer);
  editContainer.querySelector("textarea").focus();
  editContainer.querySelector(".btn-save").onclick = () => {
    const newText = editContainer
      .querySelector(".comment-edit-textarea")
      .value.trim();
    if (newText) {
      commentContent.textContent = newText;
      if (isPrivate) handlePrivateFormInput();
      else handleFormInput();
    }
    editContainer.remove();
    commentItem.style.display = "block";
  };
  editContainer.querySelector(".btn-cancel").onclick = () => {
    editContainer.remove();
    commentItem.style.display = "block";
  };
};