const SUPABASE_URL = 'https://lzjunqtkldknjynsyhbi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6anVucXRrbGRrbmp5bnN5aGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAyMDQ0NjksImV4cCI6MjA2NTc4MDQ2OX0.wEN5Y4ls43fQOjHtLjTv85GuIEdFRR5mL5HD4ZTNBTc';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    activeSection: 'suporte',
};

const userDisplayNameMap = {
    'eduardo@kanban.local': 'Eduardo Tomaz', 'alison@kanban.local': 'Alison Silva',
    'marques@kanban.local': 'Gabriel Marques', 'rosa@kanban.local': 'Gabriel Rosa',
    'miyake@kanban.local': 'João Miyake', 'gomes@kanban.local': 'João Gomes',
    'rodrigo@kanban.local': 'Rodrigo Akira', 'rubens@kanban.local': 'Rubens Leite',
    'kaiky@kanban.local': 'Kaiky Leandro', 'pedro@kanban.local': 'Pedro Santos',
};

const userDisplayNameModalMap = {
    'eduardo@kanban.local': 'Eduardo', 'alison@kanban.local': 'Alison',
    'marques@kanban.local': 'Marques', 'rosa@kanban.local': 'Rosa',
    'miyake@kanban.local': 'Miyake', 'gomes@kanban.local': 'Gomes',
    'rodrigo@kanban.local': 'Rodrigo', 'rubens@kanban.local': 'Rubens',
    'kaiky@kanban.local': 'Kaiky', 'pedro@kanban.local': 'Pedro',
};

let elements = {};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

const columnReorderDebouncers = {};

async function reorderColumnAPI(columnId, orderedCardIDs) {
    try {
        await api('/cards/reorder', {
            method: 'POST',
            body: JSON.stringify({
                column_id: parseInt(columnId, 10),
                ordered_card_ids: orderedCardIDs
            })
        });
    } catch (error) {
        showError(`Falha ao salvar a ordem da coluna ${columnId}.`);
    }
}

async function api(path, options = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            const headers = { ...options.headers };
            if (!(options.body instanceof FormData)) {
                headers['Content-Type'] = 'application/json';
            }
            if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
            const response = await fetch(`/api${path}`, { ...options, headers });
            if (response.status === 401) {
                await logout();
                return null;
            }
            if (response.status >= 500 && i < retries - 1) {
                await sleep(1000 * (i + 1));
                continue;
            }
            return response;
        } catch (error) {
            if (i === retries - 1) throw error;
            await sleep(500 * (i + 1));
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    elements = {
        loginSection: document.getElementById('loginSection'),
        kanbanSection: document.getElementById('kanbanSection'),
        kanbanContainer: document.querySelector('.kanban-container'),
        sidebar: document.getElementById('sidebar'),
        loader: document.getElementById('loader'),
        taskModal: document.getElementById('taskModal'),
        manageMembersModal: document.getElementById('manageMembersModal'),
        privateTaskModal: document.getElementById('privateTaskModal'),
        columnModal: document.getElementById('columnModal'),
        statsModal: document.getElementById('statsModal'),
        inviteUserModal: document.getElementById('inviteUserModal'),
        taskForm: document.getElementById('taskForm'),
        privateTaskForm: document.getElementById('privateTaskForm'),
        columnForm: document.getElementById('columnForm'),
        modalTitle: document.getElementById('modalTitle'),
        btnSolve: document.getElementById('btn-solve'),
        btnUnsolve: document.getElementById('btn-unsolve'),
        btnReturnToScale: document.getElementById('btn-return-to-scale'),
        btnConfirm: document.getElementById('btn-confirm-task'),
        btnLogoutSidebar: document.getElementById('btnLogoutSidebar'),
        statsFilterUser: document.getElementById('statsFilterUser'),
        userName: document.getElementById('userName'),
        userAvatar: document.getElementById('userAvatar'),
        assigneeSelector: document.getElementById('assignee-selector'),
        privateAssigneeSelector: document.getElementById('private-assignee-selector'),
        invitationsBell: document.getElementById('invitationsBell'),
        invitationsCount: document.getElementById('invitationsCount'),
        invitationsDropdown: document.getElementById('invitationsDropdown'),
    };
    addEventListeners();
    await checkAuth();
});

function addEventListeners() {
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    elements.btnLogoutSidebar?.addEventListener('click', logout);
    elements.taskForm?.addEventListener('submit', handleSubmit);
    elements.privateTaskForm?.addEventListener('submit', handlePrivateSubmit);
    elements.columnForm?.addEventListener('submit', handleColumnSubmit);
    elements.btnSolve?.addEventListener('click', () => moveCardToSolved(true));
    elements.btnUnsolve?.addEventListener('click', () => moveCardToSolved(false));
    elements.btnReturnToScale?.addEventListener('click', returnCardToBoard);
    elements.statsFilterUser?.addEventListener('change', updateStatsView);
    elements.assigneeSelector?.addEventListener('click', handleAssigneeClick);
    elements.privateAssigneeSelector?.addEventListener('click', handlePrivateAssigneeClick);
    elements.invitationsBell?.addEventListener('click', toggleNotificationsDropdown);

    document.getElementById('boardMembers')?.addEventListener('click', openManageMembersModal);

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            if (state.activeSection === section && section !== 'suporte') return;
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            state.ws?.close();

            if (section === 'suporte') {
                initApp();
            } else if (section === 'private-boards') {
                loadAndShowPrivateBoards();
            } else {
                showSection(`${section}Section`);
            }
        });
    });

    document.getElementById('btnCreatePrivateBoard').addEventListener('click', () => openPrivateBoardModal());
    document.getElementById('privateBoardForm').addEventListener('submit', handlePrivateBoardSubmit);
    document.getElementById('btnBackToBoards').addEventListener('click', () => {
        state.ws?.close();
        loadAndShowPrivateBoards();
    });
    document.getElementById('btnInviteUser')?.addEventListener('click', openInviteUserModal);
    document.getElementById('inviteUserSearch')?.addEventListener('input', debounce(filterInvitableUsers, 300));


    window.addEventListener('click', e => {
        if (e.target.classList.contains('modal')) {
            closeAllModals();
        }
        if (!elements.invitationsBell?.contains(e.target) && !elements.invitationsDropdown?.contains(e.target)) {
            if (elements.invitationsDropdown) elements.invitationsDropdown.style.display = 'none';
        }
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeAllModals();
            if (elements.invitationsDropdown) elements.invitationsDropdown.style.display = 'none';
        }
    });

    document.getElementById('avatarUpload')?.addEventListener('change', handleAvatarUpload);
}

function closeAllModals() {
    closeModal();
    closePrivateTaskModal();
    closeStatsModal();
    closeColumnModal();
    closePrivateBoardModal();
    closeInviteUserModal();
}

async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
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
    elements.kanbanSection.style.display = 'none';
    elements.sidebar.style.display = 'none';
    document.body.classList.add('login-page');
    elements.loginSection.style.opacity = 0;
    elements.loginSection.style.display = 'flex';
    elements.loginSection.classList.remove('fade-out');
    elements.loginSection.classList.add('fade-in');
}

async function handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const submitButton = e.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
    
    const { error } = await supabaseClient.auth.signInWithPassword({
        email: formData.get('email'),
        password: formData.get('password')
    });

    if (error) {
        showError(error.message);
        submitButton.disabled = false;
        submitButton.innerHTML = 'Entrar';
    } else {
        location.reload();
    }
}

async function logout() {
    state.ws?.close();
    await supabaseClient.auth.signOut();
    location.reload();
}

function updateSidebarUser() {
    if (!state.user || !state.users.length) return;
    const loggedInUser = state.users.find(u => u.id === state.user.id);
    if (!loggedInUser) return;
    const displayName = userDisplayNameMap[loggedInUser.email] || loggedInUser.username;
    const avatarUrl = loggedInUser.avatar;
    elements.userName.textContent = displayName;
    if (avatarUrl) {
        elements.userAvatar.innerHTML = '';
        elements.userAvatar.style.backgroundImage = `url(${avatarUrl}?t=${new Date().getTime()})`;
    } else {
        const initial = displayName.charAt(0).toUpperCase();
        elements.userAvatar.style.backgroundImage = 'none';
        elements.userAvatar.innerHTML = initial;
    }
}

async function initApp() {
    elements.loader.style.display = 'flex';
    document.body.classList.remove('login-page');
    showSection('kanbanSection');
    elements.kanbanSection.style.opacity = 0;
    elements.sidebar.style.display = 'flex';

    updateSidebarUser();
    updateUIForPublicBoard();

    try {
        const boardsResponse = await api('/boards/public');
        if (boardsResponse?.ok) {
            const boards = await boardsResponse.json();
            if (boards.length > 0) {
                state.board = boards[0];
                await loadBoardData();
                elements.loader.style.display = 'none';
                elements.kanbanSection.classList.add('fade-in');
            } else {
                elements.loader.style.display = 'none';
                showError("Nenhum quadro Kanban público encontrado.");
            }
        } else {
            elements.loader.style.display = 'none';
            showError("Não foi possível carregar os quadros Kanban.");
        }
    } catch (error) {
        elements.loader.style.display = 'none';
        showError('Erro fatal ao carregar dados. Tente recarregar a página.');
    }
}

async function loadBoardData() {
    await loadData();
    renderColumns();
    renderCards();
    updateStats();
    connectWS();
    if (!state.board.is_public) {
        await loadBoardMembers();
        updateUIForPrivateBoard();
    }
}

async function loadData() {
    const columnsResponse = await api(`/boards/${state.board.id}/columns`);
    if (!columnsResponse?.ok) throw new Error('Erro ao carregar colunas');
    state.columns = await columnsResponse.json();
    state.columns.sort((a, b) => a.position - b.position);
    state.solucionadoId = null;
    state.naoSolucionadoId = null;

    if (state.board.is_public) {
        state.columns.forEach(col => {
            const titleLower = col.title.trim().toLowerCase();
            if (titleLower === 'solucionado') state.solucionadoId = col.id;
            if (titleLower === 'não solucionado') state.naoSolucionadoId = col.id;
        });
    }

    const cardPromises = state.columns.map(col => api(`/columns/${col.id}/cards`).then(res => res?.ok ? res.json() : []));
    state.cards = (await Promise.all(cardPromises)).flat();
}

async function loadUsers() {
    try {
        const response = await api('/users');
        state.users = response?.ok ? await response.json() : [];
    } catch (error) {
        state.users = [];
    }
}

function showSection(sectionId) {
    document.querySelectorAll('.content-section, #kanbanSection').forEach(section => {
        section.style.display = 'none';
    });
    const sectionElement = document.getElementById(sectionId);
    if (sectionElement) {
        sectionElement.style.display = 'block';
    }
    state.activeSection = sectionId;
}

function updateUIForPublicBoard() {
    document.getElementById('btnBackToBoards').style.display = 'none';
    document.getElementById('boardTitleHeader').innerHTML = `<i class="fas fa-headset"></i> Suporte`;
    document.getElementById('btnInviteUser').style.display = 'none';
    document.getElementById('boardMembers').style.display = 'none';
    document.getElementById('publicBoardStats').style.display = 'flex';
}

function updateUIForPrivateBoard() {
    document.getElementById('btnBackToBoards').style.display = 'inline-flex';
    document.getElementById('boardTitleHeader').innerHTML = `<i class="fas fa-user-lock"></i> ${state.board.title}`;
    document.getElementById('publicBoardStats').style.display = 'none';

    const isOwner = state.board.owner_id === state.user.id;
    document.getElementById('btnInviteUser').style.display = isOwner ? 'inline-flex' : 'none';
    document.getElementById('boardMembers').style.display = 'flex';
    renderBoardMembers();
}

async function loadAndShowPrivateBoards() {
    showSection('privateBoardsSection');
    elements.loader.style.display = 'flex';
    try {
        const response = await api('/boards/private');
        if (response?.ok) {
            state.privateBoards = await response.json();
            renderPrivateBoardsList();
        } else {
            showError("Não foi possível carregar seus quadros privados.");
        }
    } catch (error) {
        showError("Erro de conexão ao buscar quadros privados.");
    } finally {
        elements.loader.style.display = 'none';
    }
}

function renderPrivateBoardsList() {
    const container = document.getElementById('privateBoardsList');
    container.innerHTML = '';
    if (state.privateBoards.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted);">Você ainda não tem quadros privados. Crie um ou aguarde um convite!</p>`;
        return;
    }
    state.privateBoards.forEach(board => {
        const isOwner = board.owner_id === state.user.id;
        const card = document.createElement('div');
        card.className = 'private-board-card';
        card.dataset.boardId = board.id;
        let ownerTagHTML = '';

        if (!isOwner) {
            const ownerDisplayName = userDisplayNameMap[board.owner_name] || board.owner_name;
            ownerTagHTML = `<div class="board-owner-tag">Quadro de ${ownerDisplayName}</div>`;
        }

        card.innerHTML = `
            <div class="private-board-header">
                <h3><i class="fas fa-user-lock" style="color:${board.color || '#3498db'}"></i> ${board.title}</h3>
            </div>
            ${ownerTagHTML}
            <p>${board.description || 'Sem descrição.'}</p>
            <div class="private-board-actions">
                 <button class="btn btn-primary btn-view-board"><i class="fas fa-arrow-right"></i> Acessar</button>
                 ${isOwner ? `<button class="btn btn-secondary btn-delete-board"><i class="fas fa-times"></i> Excluir</button>` : ''}
            </div>`;

        card.querySelector('.btn-view-board').addEventListener('click', () => selectPrivateBoard(board.id));
        if (isOwner) {
            card.querySelector('.btn-delete-board').addEventListener('click', (event) => handleDeleteBoard(board.id, event));
        }
        container.appendChild(card);
    });
}

async function selectPrivateBoard(boardId) {
    const selectedBoard = state.privateBoards.find(b => b.id === boardId);
    if (!selectedBoard) return;
    elements.loader.style.display = 'flex';
    state.board = selectedBoard;
    await loadBoardData();
    showSection('kanbanSection');
    elements.loader.style.display = 'none';
}

function handleAssigneeClick(event) {
    const item = event.target.closest('.assignee-item');
    if (!item) return;
    document.getElementById('taskAssignee').value = item.dataset.value;
    item.parentElement.querySelectorAll('.assignee-item').forEach(el => el.classList.remove('selected'));
    item.classList.add('selected');
    handleFormInput();
}

function handlePrivateAssigneeClick(event) {
    const item = event.target.closest('.assignee-item');
    if (!item) return;
    document.getElementById('privateTaskAssignee').value = item.dataset.value;
    item.parentElement.querySelectorAll('.assignee-item').forEach(el => el.classList.remove('selected'));
    item.classList.add('selected');
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
    kanbanContainer.innerHTML = '';
    let columnsToRender = state.columns;
    if (state.board.is_public) {
        columnsToRender = state.columns.filter(col => col.id !== state.solucionadoId && col.id !== state.naoSolucionadoId);
    }
    columnsToRender.forEach(col => {
        kanbanContainer.appendChild(createColumnElement(col));
    });
    const addColumnPlaceholder = document.createElement('div');
    addColumnPlaceholder.className = 'add-column-placeholder';
    addColumnPlaceholder.innerHTML = `<button class="add-column-btn" onclick="openColumnModal()"><i class="fas fa-plus"></i> Adicionar Coluna</button>`;
    kanbanContainer.appendChild(addColumnPlaceholder);
    addDragAndDropListenersToColumns();
}

function createColumnElement(column) {
    const columnEl = document.createElement('div');
    columnEl.className = 'column';
    columnEl.dataset.columnId = column.id;
    const iconMap = {
        'casos suporte': 'fas fa-headset',
        'upgrades/retenção': 'fas fa-arrow-up',
        'escallo': 'fas fa-phone',
        'a fazer': 'fas fa-list-alt',
        'em andamento': 'fas fa-tasks'
    };
    const iconClass = iconMap[column.title.toLowerCase()] || "fas fa-columns";
    columnEl.innerHTML = `
        <div class="column-header">
            <div class="column-title" style="color: ${column.color};">
                <i class="${iconClass}"></i>
                <span>${column.title}</span>
                <button class="delete-column-btn" onclick="deleteColumn(${column.id})"><i class="fas fa-times"></i></button>
            </div>
            <div class="column-actions">
                <button class="add-task-btn" onclick="openModal(null, ${column.id})"><i class="fas fa-plus"></i></button>
            </div>
        </div>
        <div class="task-list" data-column-id="${column.id}"></div>`;
    return columnEl;
}

async function deleteColumn(columnId) {
    if (!confirm('Tem certeza que deseja excluir esta coluna?\n\nATENÇÃO: A coluna deve estar vazia.')) return;
    try {
        const response = await api(`/columns/${columnId}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            const errorData = await response.json();
            showError(errorData.error || 'Não foi possível excluir a coluna.');
        }
    } catch (error) {
        showError('Erro de conexão ao excluir a coluna.');
    }
}

function addDragAndDropListenersToColumns() {
    document.querySelectorAll('.task-list').forEach(taskList => {
        taskList.addEventListener('dragover', e => {
            e.preventDefault();
            e.currentTarget.classList.add('drag-over');
        });
        taskList.addEventListener('dragleave', e => e.currentTarget.classList.remove('drag-over'));
        taskList.addEventListener('drop', e => {
            e.currentTarget.classList.remove('drag-over');
            handleDrop(e);
        });
    });
}

function renderCards() {
    document.querySelectorAll('.task-list').forEach(list => list.innerHTML = '');
    let cardsToRender = state.cards;
    if (state.board.is_public) {
        cardsToRender = state.cards.filter(c => c.column_id !== state.solucionadoId && c.column_id !== state.naoSolucionadoId);
    }
    cardsToRender.sort((a, b) => a.position - b.position);
    cardsToRender.forEach(card => {
        const list = document.querySelector(`.task-list[data-column-id="${card.column_id}"]`);
        if (list) list.appendChild(createCardElement(card));
    });
}

function createUserAvatar(user) {
    const avatarElement = document.createElement('div');
    avatarElement.className = 'assignee-avatar';
    if (user && user.avatar) {
        avatarElement.style.backgroundImage = `url(${user.avatar})`;
    } else if (user) {
        const displayName = userDisplayNameMap[user.email] || user.username || 'U';
        avatarElement.textContent = displayName.charAt(0).toUpperCase();
    } else {
        const icon = document.createElement('i');
        icon.className = 'fas fa-user';
        avatarElement.appendChild(icon);
    }
    return avatarElement;
}

function createCardElement(card) {
    let isOverdue = false,
        isDueToday = false;
    const isCompleted = state.board.is_public && (card.column_id === state.solucionadoId || card.column_id === state.naoSolucionadoId);
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
    const div = document.createElement('div');
    let taskClasses = `task priority-${card.priority || 'media'}`;
    if (isOverdue) taskClasses += ' overdue';
    if (isDueToday) taskClasses += ' due-today';
    div.className = taskClasses;
    div.draggable = true;
    div.dataset.cardId = card.id;

    let userSource = state.board.is_public ? state.users : state.boardMembers;
    const assignedUser = userSource.find(u => u.username === card.assigned_to || u.email === card.assigned_to);
    const assigneeDisplayName = assignedUser ? (userDisplayNameMap[assignedUser.email] || assignedUser.username) : 'N/A';
    const assigneeAvatarElement = createUserAvatar(assignedUser);

    let statusIconHTML = '';
    if (isOverdue) statusIconHTML = '<i class="fas fa-exclamation-triangle overdue-icon"></i>';
    else if (isDueToday) statusIconHTML = '<i class="fas fa-clock due-today-icon"></i>';
    else if (card.due_date) statusIconHTML = '<i class="fas fa-calendar"></i>';

    div.innerHTML = `
        <div class="task-actions"><button class="action-btn delete-btn"><i class="fas fa-trash"></i></button></div>
        <div class="task-header"><div class="task-title" style="word-break: break-word;">${card.title}</div></div>
        <div class="task-meta">
            <div class="task-assignee">${assigneeAvatarElement.outerHTML}<span>${assigneeDisplayName}</span></div>
            <div class="task-due-info">
                <span class="task-date-text">${card.due_date ? new Date(card.due_date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                <div class="task-status-icons">${statusIconHTML}</div>
            </div>
        </div>`;
    div.addEventListener('click', () => editCard(card.id));
    div.addEventListener('dragstart', e => {
        e.target.classList.add('dragging');
        e.dataTransfer.setData('text/plain', card.id);
    });
    div.addEventListener('dragend', e => e.target.classList.remove('dragging'));
    div.querySelector('.delete-btn').addEventListener('click', e => {
        e.stopPropagation();
        deleteCard(card.id);
    });
    return div;
}

function openModal(columnName, columnId) {
    if (!state.board.is_public) {
        openPrivateTaskModal(columnId);
        return;
    }
    const targetColumnId = columnId;
    if (!targetColumnId) return;
    state.isModalDirty = false;
    state.editingCardId = null;
    state.currentColumnId = targetColumnId;
    elements.taskForm.reset();
    elements.modalTitle.querySelector('span').textContent = 'Nova Tarefa';
    document.getElementById('new-task-description-group').style.display = 'block';
    document.querySelector('#taskModal .modal-comments').style.display = 'none';
    elements.btnSolve.style.display = 'none';
    elements.btnUnsolve.style.display = 'none';
    elements.btnReturnToScale.style.display = 'none';
    elements.btnConfirm.style.display = 'inline-flex';
    elements.assigneeSelector.innerHTML = '<div style="text-align:center; color: var(--text-muted);">Carregando...</div>';
    clearComments();
    elements.taskModal.style.display = 'flex';
    document.getElementById('taskTitle').focus();
    setTimeout(() => {
        populateAssigneeSelector(null, 'public');
    }, 10);
}

async function editCard(cardId) {
    if (!state.board.is_public) {
        await editPrivateTask(cardId);
        return;
    }

    const card = state.cards.find(c => c.id === cardId);
    if (!card) return;
    state.isModalDirty = false;
    state.editingCardId = cardId;
    elements.taskForm.reset();
    elements.modalTitle.querySelector('span').textContent = 'Editar Tarefa';
    document.getElementById('taskTitle').value = card.title;
    document.getElementById('new-task-description-group').style.display = 'none';
    document.querySelector('#taskModal .modal-comments').style.display = 'flex';
    elements.btnConfirm.style.display = 'none';
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
        showError('O ID e Nome do Cliente é obrigatório.');
        return;
    }
    try {
        const response = await api(`/columns/${state.currentColumnId}/cards`, {
            method: 'POST',
            body: JSON.stringify(cardData)
        });
        if (response?.ok) {
            closeModal();
        } else {
            showError('Erro ao criar tarefa.');
        }
    } catch (error) {
        showError('Erro de conexão ao criar tarefa.');
    }
}

async function handlePrivateSubmit(e) {
    e.preventDefault();
    if (state.editingCardId) return;
    const cardData = getPrivateFormData();
    if (!cardData.title) {
        showError('O título da tarefa é obrigatório.');
        return;
    }
    try {
        const response = await api(`/columns/${state.currentColumnId}/cards`, {
            method: 'POST',
            body: JSON.stringify(cardData)
        });
        if (response?.ok) {
            closePrivateTaskModal();
        } else {
            showError('Erro ao criar tarefa privada.');
        }
    } catch (error) {
        showError('Erro de conexão ao criar tarefa privada.');
    }
}

function openPrivateTaskModal(columnId) {
    state.isModalDirty = false;
    state.editingCardId = null;
    state.currentColumnId = columnId;
    elements.privateTaskForm.reset();
    document.getElementById('privateModalTitle').querySelector('span').textContent = 'Nova Tarefa';
    document.getElementById('private-new-task-description-group').style.display = 'block';
    document.querySelector('#privateTaskModal .modal-comments').style.display = 'none';
    document.getElementById('btn-confirm-private-task').style.display = 'inline-flex';
    elements.privateAssigneeSelector.innerHTML = '';
    document.getElementById('private-comments-list').innerHTML = '';
    elements.privateTaskModal.style.display = 'flex';
    document.getElementById('privateTaskTitle').focus();

    setTimeout(() => {
        populateAssigneeSelector(null, 'private');
    }, 10);
}

async function editPrivateTask(cardId) {
    const card = state.cards.find(c => c.id === cardId);
    if (!card) return;

    if (!state.boardMembers || state.boardMembers.length === 0) {
        await loadBoardMembers();
    }
    
    state.isModalDirty = false;
    state.editingCardId = cardId;
    elements.privateTaskForm.reset();
    document.getElementById('privateModalTitle').querySelector('span').textContent = 'Editar Tarefa';
    document.getElementById('privateTaskTitle').value = card.title;
    document.getElementById('private-new-task-description-group').style.display = 'none';
    document.querySelector('#privateTaskModal .modal-comments').style.display = 'flex';
    document.getElementById('btn-confirm-private-task').style.display = 'none';

    elements.privateTaskModal.style.display = 'flex';
    setTimeout(() => {
        populateAssigneeSelector(card.assigned_to, 'private');
        if (card.due_date) {
            const localDate = new Date(card.due_date);
            localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
            document.getElementById('privateTaskDate').value = localDate.toISOString().slice(0, 16);
        } else {
            document.getElementById('privateTaskDate').value = '';
        }
        renderPrivateComments(card.description);
        elements.privateTaskForm.removeEventListener('input', handlePrivateFormInput);
        elements.privateTaskForm.addEventListener('input', handlePrivateFormInput);
    }, 10);
}

function closeModal() {
    if (state.editingCardId && state.isModalDirty) {
        autoSave.cancel();
        saveCardChanges();
    }
    _performCloseAnimation(elements.taskModal);
    state.editingCardId = null;
    state.currentColumnId = null;
    state.isModalDirty = false;
    clearComments();
    elements.taskForm.removeEventListener('input', handleFormInput);
}

function closePrivateTaskModal() {
    if (state.editingCardId && state.isModalDirty) {
        autoSavePrivate.cancel();
        savePrivateCardChanges();
    }
    _performCloseAnimation(elements.privateTaskModal);
    state.editingCardId = null;
    state.currentColumnId = null;
    state.isModalDirty = false;
}

function getFormData() {
    const form = elements.taskForm;
    const formData = new FormData(form);
    let description;
    if (state.editingCardId) {
        description = JSON.stringify({
            observacoes: getComments('observacoes-comments'),
            tentativas: getComments('tentativas-comments'),
            resolucao: getComments('resolucao-comments')
        });
    } else {
        const descText = formData.get('description') || '';
        const loggedInUser = state.users.find(u => u.id === state.user.id);
        const authorName = loggedInUser ? (userDisplayNameMap[loggedInUser.email] || loggedInUser.username) : 'Desconhecido';
        description = JSON.stringify({
            observacoes: descText ? [{ text: descText, author: authorName, timestamp: new Date().toLocaleString('pt-BR') }] : [],
            tentativas: [],
            resolucao: []
        });
    }

    const dateValue = formData.get('date');
    let dueDate = dateValue ? new Date(dateValue).toISOString() : null;

    return {
        title: formData.get('title'),
        description,
        assigned_to: formData.get('assignee'),
        priority: formData.get('priority'),
        due_date: dueDate,
    };
}

function getPrivateFormData() {
    const form = elements.privateTaskForm;
    const formData = new FormData(form);
    let description;
    if (state.editingCardId) {
        description = JSON.stringify({
            comments: getPrivateComments()
        });
    } else {
        const descText = formData.get('description') || '';
        const loggedInUser = state.boardMembers.find(u => u.id === state.user.id);
        const authorName = loggedInUser ? (userDisplayNameMap[loggedInUser.email] || loggedInUser.username) : 'Desconhecido';
        description = JSON.stringify({
            comments: descText ? [{ text: descText, author: authorName, timestamp: new Date().toLocaleString('pt-BR') }] : []
        });
    }

    const dateValue = formData.get('date');
    let dueDate = dateValue ? new Date(dateValue).toISOString() : null;

    return {
        title: formData.get('title'),
        description,
        assigned_to: formData.get('assignee'),
        priority: formData.get('priority'),
        due_date: dueDate,
    };
}


const autoSave = debounce(saveCardChanges, 500);
const autoSavePrivate = debounce(savePrivateCardChanges, 500);

async function saveCardChanges() {
    if (!state.editingCardId || !state.isModalDirty) return;
    const cardData = getFormData();
    try {
        await api(`/cards/${state.editingCardId}`, {
            method: 'PUT',
            body: JSON.stringify(cardData)
        });
        state.isModalDirty = false;
    } catch (error) {
        console.error("Autosave público falhou", error);
    }
}

async function savePrivateCardChanges() {
    if (!state.editingCardId || !state.isModalDirty) return;
    const cardData = getPrivateFormData();
    try {
        await api(`/cards/${state.editingCardId}`, {
            method: 'PUT',
            body: JSON.stringify(cardData)
        });
        state.isModalDirty = false;
    } catch (error) {
        console.error("Autosave privado falhou", error);
    }
}

function _performCloseAnimation(modalElement) {
    if (modalElement && modalElement.style.display === 'flex' && !modalElement.classList.contains('closing')) {
        modalElement.classList.add('closing');
        setTimeout(() => {
            modalElement.style.display = 'none';
            modalElement.classList.remove('closing');
        }, 300);
    }
}

async function openColumnModal(columnId = null) {
    elements.columnForm.reset();
    state.editingColumnId = columnId;
    if (columnId) {
        const column = state.columns.find(c => c.id === columnId);
        if (column) {
            document.getElementById('columnId').value = column.id;
            document.getElementById('columnTitle').value = column.title;
            document.getElementById('columnColor').value = column.color;
            document.getElementById('columnModalTitle').querySelector('span').textContent = 'Editar Coluna';
        }
    } else {
        document.getElementById('columnId').value = '';
        document.getElementById('columnTitle').value = '';
        document.getElementById('columnColor').value = '#e4e6ea';
        document.getElementById('columnModalTitle').querySelector('span').textContent = 'Nova Coluna';
    }
    elements.columnModal.style.display = 'flex';
}

function closeColumnModal() {
    _performCloseAnimation(elements.columnModal);
    state.editingColumnId = null;
}

async function handleColumnSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const columnData = {
        board_id: state.board.id,
        title: formData.get('title'),
        color: formData.get('color'),
    };
    if (!columnData.title) {
        showError("O título da coluna é obrigatório.");
        return;
    }
    try {
        let response;
        if (state.editingColumnId) {
        } else {
            response = await api('/columns', {
                method: 'POST',
                body: JSON.stringify(columnData)
            });
        }
        if (response?.ok) {
            closeColumnModal();
        } else {
            const err = await response.json();
            showError(err.error || 'Erro ao salvar coluna.');
        }
    } catch (error) {
        showError('Erro de conexão ao salvar a coluna.');
    }
}

async function openPrivateBoardModal() {
    const form = document.getElementById('privateBoardForm');
    form?.reset();
    const modal = document.getElementById('privateBoardModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('boardTitle').focus();
    }
}

function closePrivateBoardModal() {
    _performCloseAnimation(document.getElementById('privateBoardModal'));
}

async function handlePrivateBoardSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const title = formData.get('title');
    if (!title || title.trim() === '') {
        showError("O título do quadro é obrigatório.");
        return;
    }
    const boardData = {
        title: title.trim(),
        description: formData.get('description').trim(),
        is_public: false,
        color: '#3498db'
    };
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    try {
        const response = await api('/boards', {
            method: 'POST',
            body: JSON.stringify(boardData)
        });
        if (response?.ok) {
            closePrivateBoardModal();
            await loadAndShowPrivateBoards();
        } else {
            const errorData = await response.json();
            showError(errorData.error || 'Erro ao criar o quadro privado.');
        }
    } catch (error) {
        showError('Erro de conexão ao criar o quadro.');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-check-circle"></i> <span>Salvar Quadro</span>';
    }
}

async function handleDeleteBoard(boardId, event) {
    event.stopPropagation();
    const boardTitle = state.privateBoards.find(b => b.id === boardId)?.title || "este quadro";
    if (!confirm(`Tem certeza que deseja excluir "${boardTitle}"?\n\nATENÇÃO: Todas as colunas e tarefas dentro deste quadro serão permanentemente excluídas.`)) return;
    try {
        const response = await api(`/boards/${boardId}`, {
            method: 'DELETE'
        });
        if (response?.ok) {
            await loadAndShowPrivateBoards();
        } else {
            const errorData = await response.json();
            showError(errorData.error || "Falha ao excluir o quadro.");
        }
    } catch (error) {
        showError("Erro de conexão ao tentar excluir o quadro.");
    }
}

async function deleteCard(cardId) {
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;
    try {
        await api(`/cards/${cardId}`, {
            method: 'DELETE'
        });
    } catch (error) {
        showError('Erro ao excluir a tarefa');
    }
}

async function moveCardToSolved(solved) {
    if (!state.editingCardId) return;
    const targetId = solved ? state.solucionadoId : state.naoSolucionadoId;
    if (!targetId) {
        showError(`Coluna '${solved ? "Solucionado" : "Não Solucionado"}' não encontrada.`);
        return;
    }
    if (state.isModalDirty) {
        autoSave.cancel();
        await saveCardChanges();
    }
    reorderColumnAPI(targetId, [state.editingCardId]);
    renderCards();
    updateStats();
    closeModal();
}

async function returnCardToBoard() {
    if (!state.editingCardId) return;
    const firstActiveColumn = state.columns.find(c => c.id !== state.solucionadoId && c.id !== state.naoSolucionadoId);
    if (!firstActiveColumn) {
        showError("Nenhuma coluna de trabalho ativa encontrada.");
        return;
    }
    if (state.isModalDirty) {
        autoSave.cancel();
        await saveCardChanges();
    }
    reorderColumnAPI(firstActiveColumn.id, [state.editingCardId]);
    renderCards();
    updateStats();
    closeModal();
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.task:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return {
            offset: offset,
            element: child
        };
        else return closest;
    }, {
        offset: Number.NEGATIVE_INFINITY
    }).element;
}

function handleDrop(e) {
    e.preventDefault();
    const targetList = e.target.closest('.task-list');
    if (!targetList) return;
    targetList.classList.remove('drag-over');

    const cardId = parseInt(e.dataTransfer.getData('text/plain'));
    const cardToMove = state.cards.find(c => c.id === cardId);
    if (!cardToMove) return;

    const oldColumnId = cardToMove.column_id;
    const newColumnId = parseInt(targetList.dataset.columnId);

    const cardElement = document.querySelector(`.task[data-card-id="${cardId}"]`);
    const afterElement = getDragAfterElement(targetList, e.clientY);
    if (afterElement) {
        targetList.insertBefore(cardElement, afterElement);
    } else {
        targetList.appendChild(cardElement);
    }

    const newColumnElements = Array.from(document.querySelectorAll(`.task-list[data-column-id="${newColumnId}"] .task`));
    const newColumnOrder = newColumnElements.map(el => parseInt(el.dataset.cardId));

    if (!columnReorderDebouncers[newColumnId]) {
        columnReorderDebouncers[newColumnId] = debounce(reorderColumnAPI, 400);
    }
    columnReorderDebouncers[newColumnId](newColumnId, newColumnOrder);

    if (oldColumnId !== newColumnId) {
        const oldColumnElements = Array.from(document.querySelectorAll(`.task-list[data-column-id="${oldColumnId}"] .task`));
        const oldColumnOrder = oldColumnElements.map(el => parseInt(el.dataset.cardId));

        if (!columnReorderDebouncers[oldColumnId]) {
            columnReorderDebouncers[oldColumnId] = debounce(reorderColumnAPI, 400);
        }
        columnReorderDebouncers[oldColumnId](oldColumnId, oldColumnOrder);
    }

    const allTaskElements = Array.from(document.querySelectorAll('.kanban-container .task'));
    allTaskElements.forEach((el) => {
        const id = parseInt(el.dataset.cardId);
        const colId = parseInt(el.closest('.column').dataset.columnId);
        const cardInState = state.cards.find(c => c.id === id);
        if (cardInState) {
            cardInState.column_id = colId;
        }
    });
}

function connectWS() {
    if (state.ws && state.ws.readyState < 2) {
        state.ws.close();
    }
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    state.ws = new WebSocket(`${protocol}://${location.host}/ws/board/${state.board.id}`);
    state.ws.onmessage = async (e) => {
        const { type, payload } = JSON.parse(e.data);
        if (type === 'BOARD_STATE_UPDATED' || type.includes('CARD') || type.includes('COLUMN')) {
            await loadData();
            renderColumns();
            renderCards();
            updateStats();
        }
    };
    state.ws.onclose = () => console.log(`WebSocket para o board ${state.board.id} fechado.`);
    state.ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        state.ws.close();
    };
}

function updateStats() {
    if (!state.cards) return;

    if (!state.board.is_public) {
        document.getElementById('publicBoardStats').style.display = 'none';
        return;
    }
    document.getElementById('publicBoardStats').style.display = 'flex';

    if (!state.solucionadoId || !state.naoSolucionadoId) {
        document.getElementById('pendingTasks').textContent = state.cards.length;
        document.getElementById('completedTasks').textContent = '0';
        document.getElementById('failedTasks').textContent = '0';
        return;
    }
    const completed = state.cards.filter(c => c.column_id === state.solucionadoId).length;
    const failed = state.cards.filter(c => c.column_id === state.naoSolucionadoId).length;
    const total = state.cards.length;
    const pending = total - completed - failed;
    document.getElementById('pendingTasks').textContent = pending;
    document.getElementById('completedTasks').textContent = completed;
    document.getElementById('failedTasks').textContent = failed;
}

function showError(message) {
    const errorDiv = document.getElementById('loginError');
    if (errorDiv && elements.loginSection.style.display !== 'none') {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    } else {
        alert(`Erro: ${message}`);
    }
}

function renderComments(descJson) {
    clearComments();
    if (!descJson) return;
    try {
        const desc = JSON.parse(descJson);
        ['observacoes', 'tentativas', 'resolucao'].forEach(section => {
            const container = document.getElementById(`${section}-comments`);
            if (desc[section]?.length && container) {
                const fragment = document.createDocumentFragment();
                desc[section].forEach(comment => {
                    fragment.appendChild(createCommentElement(comment));
                });
                container.appendChild(fragment);
            }
        });
    } catch (e) { console.error("Erro ao parsear comentários:", e); }
}

function renderPrivateComments(descJson) {
    const container = document.getElementById('private-comments-list');
    container.innerHTML = '';
    if (!descJson) return;
    try {
        const desc = JSON.parse(descJson);
        if (desc.comments?.length) {
            const fragment = document.createDocumentFragment();
            desc.comments.forEach(comment => {
                fragment.appendChild(createCommentElement(comment));
            });
            container.appendChild(fragment);
        }
    } catch (e) { console.error("Erro ao parsear comentários privados:", e); }
}

function createCommentElement(comment) {
    const div = document.createElement('div');
    div.className = 'comment-item';
    const text = typeof comment === 'object' ? (comment.text || '') : comment;
    const authorName = typeof comment === 'object' && comment.author ? comment.author : 'Desconhecido';
    const time = typeof comment === 'object' ? (comment.timestamp || new Date().toLocaleString('pt-BR')) : new Date().toLocaleString('pt-BR');

    let userSource = state.board.is_public ? state.users : state.boardMembers;
    const authorUser = userSource.find(u => (userDisplayNameMap[u.email] || u.username) === authorName);
    const authorAvatarElement = createUserAvatar(authorUser);
    authorAvatarElement.classList.add('comment-avatar');
    div.dataset.author = authorName;
    div.innerHTML = `
        <div class="comment-content">${text}</div>
        <div class="comment-meta">
            <span class="comment-author">${authorAvatarElement.outerHTML}${authorName}</span>
            <span class="comment-timestamp">${time}</span>
        </div>
        <div class="comment-item-actions">
            <button class="edit-comment-btn" onclick="editComment(this)"><i class="fas fa-pencil-alt"></i></button>
            <button class="delete-comment-btn" onclick="deleteComment(this)"><i class="fas fa-trash"></i></button>
        </div>`;
    return div;
}

function getComments(sectionId) {
    const section = document.getElementById(sectionId);
    return Array.from(section?.querySelectorAll('.comment-item') || []).map(item => ({
        text: item.querySelector('.comment-content').textContent,
        author: item.dataset.author,
        timestamp: item.querySelector('.comment-timestamp')?.textContent || new Date().toLocaleString('pt-BR')
    }));
}

function getPrivateComments() {
    return getComments('private-comments-list');
}

function clearComments() {
    ['observacoes', 'tentativas', 'resolucao'].forEach(section => {
        const container = document.getElementById(`${section}-comments`);
        const inputContainer = document.getElementById(`${section}-input`);
        if (container) container.innerHTML = '';
        if (inputContainer) {
            inputContainer.style.display = 'none';
            inputContainer.querySelector('textarea').value = '';
        }
    });
}

function populateStatsUserFilter() {
    const select = elements.statsFilterUser;
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="all">Todos os Colaboradores</option>';
    state.users.forEach(user => {
        const userIdentifier = user.username || user.email;
        if (!userIdentifier) return;
        const displayName = userDisplayNameMap[user.email] || userIdentifier;
        const option = document.createElement('option');
        option.value = userIdentifier;
        option.textContent = displayName;
        select.appendChild(option);
    });
    select.value = currentValue || 'all';
}

function updateStatsView() {
    const status = elements.statsModal.dataset.status;
    const selectedUser = elements.statsFilterUser.value;
    const body = document.getElementById('statsModalBody');
    const totalElement = document.getElementById('statsTotalCount');
    const cardsToFilter = state.cards;
    const currentSolucionadoId = state.solucionadoId;
    const currentNaoSolucionadoId = state.naoSolucionadoId;
    let cards;
    if (status === 'pendente') {
        cards = cardsToFilter.filter(c => c.column_id !== currentSolucionadoId && c.column_id !== currentNaoSolucionadoId);
    } else {
        const targetColumnId = status === 'solucionado' ? currentSolucionadoId : currentNaoSolucionadoId;
        cards = cardsToFilter.filter(c => c.column_id === targetColumnId);
    }
    if (selectedUser !== 'all') {
        cards = cards.filter(card => card.assigned_to === selectedUser);
    }
    if (totalElement) totalElement.textContent = `Total: ${cards.length}`;
    body.innerHTML = cards.length === 0 ? '<p style="text-align: center; color: var(--text-muted);">Nenhuma tarefa encontrada.</p>' : cards.map(card => {
        const assignedUser = state.users.find(u => u.username === card.assigned_to || u.email === card.assigned_to);
        const assigneeDisplayName = assignedUser ? (userDisplayNameMap[assignedUser.email] || assignedUser.username) : 'N/A';
        const avatarHTML = createUserAvatar(assignedUser).outerHTML;
        return `
                <div class="stats-list-item" onclick="closeStatsModal(); editCard(${card.id})">
                    <div class="task-title">${card.title}</div>
                    <div class="task-meta"><div class="task-assignee">${avatarHTML} ${assigneeDisplayName}</div></div>
                </div>`;
    }).join('');
}

function openStatsModal(status) {
    const title = document.getElementById('statsModalTitle');
    elements.statsModal.dataset.status = status;
    title.innerHTML = status === 'solucionado' ? '<i class="fas fa-check-circle"></i> Tarefas Solucionadas' : status === 'nao-solucionado' ? '<i class="fas fa-times-circle"></i> Tarefas Não Solucionadas' : '<i class="fa-solid fa-spinner"></i> Tarefas Pendentes';
    populateStatsUserFilter();
    updateStatsView();
    elements.statsModal.style.display = 'flex';
}

function closeStatsModal() {
    _performCloseAnimation(elements.statsModal);
}

async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    elements.loader.style.display = 'flex';
    const formData = new FormData();
    formData.append('avatar', file);
    try {
        const response = await api('/user/avatar', {
            method: 'POST',
            body: formData
        });
        if (response?.ok) {
            const result = await response.json();
            const userIndex = state.users.findIndex(u => u.id === state.user.id);
            if (userIndex > -1) state.users[userIndex].avatar = result.avatar_url;
            updateSidebarUser();
            renderCards();
        } else {
            const errorData = await response.json();
            showError(errorData.error || 'Falha no upload do avatar.');
        }
    } catch (error) {
        showError('Erro de conexão ao fazer upload.');
    } finally {
        elements.loader.style.display = 'none';
        event.target.value = '';
    }
}

async function fetchNotifications() {
    try {
        const res = await api('/notifications');
        if (res?.ok) {
            state.notifications = await res.json();
            updateNotificationsUI();
        }
    } catch (error) {
        console.error("Erro ao buscar notificações", error);
    }
}

function updateNotificationsUI() {
    const unreadCount = state.notifications.filter(n => !n.is_read).length;
    
    if (unreadCount > 0) {
        elements.invitationsCount.textContent = unreadCount;
        elements.invitationsCount.style.display = 'flex';
    } else {
        elements.invitationsCount.style.display = 'none';
    }
    
    renderNotificationsDropdown();
}

function renderNotificationsDropdown() {
    const unreadContainer = document.getElementById('unreadNotificationsContainer');
    const readContainer = document.getElementById('readNotificationsContainer');
    const toggle = document.getElementById('readNotificationsToggle');
    
    unreadContainer.innerHTML = '';
    readContainer.innerHTML = '';

    const unreadNotifications = state.notifications.filter(n => !n.is_read);
    const readNotifications = state.notifications.filter(n => n.is_read);

    if (state.notifications.length === 0) {
        unreadContainer.innerHTML = '<div class="invitation-item"><p>Nenhuma notificação nova.</p></div>';
    } else {
        if (unreadNotifications.length === 0) {
            unreadContainer.innerHTML = '<div class="invitation-item"><p>Nenhuma notificação nova.</p></div>';
        } else {
            unreadNotifications.forEach(n => {
                unreadContainer.appendChild(createNotificationElement(n));
            });
        }
    }

    if (readNotifications.length > 0) {
        toggle.style.display = 'flex';
        readNotifications.forEach(n => {
            readContainer.appendChild(createNotificationElement(n));
        });
    } else {
        toggle.style.display = 'none';
    }

    const clickListener = () => {
        toggle.classList.toggle('active');
        readContainer.classList.toggle('active');
    };

    toggle.removeEventListener('click', toggle._clickListener);
    toggle.addEventListener('click', clickListener);
    toggle._clickListener = clickListener; 
}

function createNotificationElement(n) {
    const item = document.createElement('div');
    item.className = 'invitation-item';
    if (n.is_read) {
        item.classList.add('read');
    }

    let finalMessage = n.message;

    if (n.type === 'board_invitation') {
        const emailMatch = finalMessage.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
        if (emailMatch) {
            const email = emailMatch[0];
            const displayName = userDisplayNameMap[email] || email;
            finalMessage = finalMessage.replace(email, displayName);
        }
    }

    switch(n.type) {
        case 'board_invitation':
            item.innerHTML = `
                <p>${finalMessage}</p>
                <div class="invitation-actions">
                    <button class="btn btn-secondary btn-reject" onclick="respondToInvitation(this, ${n.invitation_id}, ${n.id}, false)">Rejeitar</button>
                    <button class="btn btn-primary btn-accept" onclick="respondToInvitation(this, ${n.invitation_id}, ${n.id}, true)">Aceitar</button>
                </div>`;
            break;
        case 'new_task_assigned':
        case 'invitation_accepted':
             item.innerHTML = `<p>${finalMessage}</p>`;
             item.classList.add('clickable');
             item.onclick = () => handleGenericNotificationClick(n);
            break;
        default:
            item.innerHTML = `<p>${finalMessage}</p>`;
    }
    return item;
}

async function handleGenericNotificationClick(notification) {
    await api(`/notifications/${notification.id}/read`, { method: 'POST' });
    const notifInState = state.notifications.find(n => n.id === notification.id);
    if (notifInState) notifInState.is_read = true;
    updateNotificationsUI();

    if (notification.related_board_id) {
        const boardToLoad = state.privateBoards.find(b => b.id === notification.related_board_id);
        if (boardToLoad) {
            await selectPrivateBoard(boardToLoad.id);
            if (notification.related_card_id) {
                editCard(notification.related_card_id);
            }
        }
    }
}

async function handleTaskNotificationClick(notification) {
    await api(`/notifications/${notification.id}/read`, { method: 'POST' });
    await fetchNotifications();
    
    const boardToLoad = state.privateBoards.find(b => b.id === notification.related_board_id) || (await api(`/boards/public`).then(res => res.ok ? res.json() : []).then(boards => boards.find(b => b.id === notification.related_board_id)));

    if (boardToLoad) {
        state.board = boardToLoad;
        await loadBoardData();
        showSection('kanbanSection');
        if (!boardToLoad.is_public) {
            updateUIForPrivateBoard();
        } else {
            updateUIForPublicBoard();
        }
        editCard(notification.related_card_id);
    }
}


function toggleNotificationsDropdown() {
    const dropdown = elements.invitationsDropdown;
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    if (dropdown.style.display === 'block') {
        fetchNotifications();
    }
}

async function respondToInvitation(button, invitationId, notificationId, accept) {
    button.closest('.invitation-actions').innerHTML = 'Processando...';
    try {
        const res = await api(`/invitations/${invitationId}/respond?notification_id=${notificationId}`, {
            method: 'POST',
            body: JSON.stringify({ accept })
        });
        if (res?.ok) {
            await fetchNotifications();
            if (accept) {
                await loadAndShowPrivateBoards();
            }
        } else {
            showError('Falha ao responder ao convite.');
        }
    } catch (e) {
        showError('Erro de conexão ao responder ao convite.');
    }
}

async function openInviteUserModal() {
    elements.inviteUserModal.style.display = 'flex';
    const list = document.getElementById('invitableUsersList');
    list.innerHTML = '<div class="loader-small"></div>';
    try {
        const res = await api(`/boards/${state.board.id}/invitable-users`);
        if (res?.ok) {
            const users = await res.json();
            renderInvitableUsers(users);
        } else {
            list.innerHTML = '<p>Erro ao carregar usuários.</p>';
        }
    } catch (e) {
        list.innerHTML = '<p>Erro de conexão.</p>';
    }
}

function closeInviteUserModal() {
    _performCloseAnimation(elements.inviteUserModal);
}

function renderInvitableUsers(users) {
    const list = document.getElementById('invitableUsersList');
    list.className = 'invitable-users-grid';
    list.innerHTML = '';
    if (users.length === 0) {
        list.innerHTML = '<p class="text-muted text-center" style="grid-column: 1 / -1;">Nenhum usuário para convidar.</p>';
        return;
    }
    users.forEach(user => {
        const item = document.createElement('div');
        item.className = 'invitable-user-item';
        item.dataset.userId = user.id;
        item.dataset.userName = userDisplayNameMap[user.email] || user.username;
        item.dataset.userEmail = user.email;

        const avatarHTML = user.avatar 
            ? `<div class="user-avatar" style="background-image: url(${user.avatar})"></div>`
            : `<div class="user-avatar">${(userDisplayNameMap[user.email] || user.username).charAt(0)}</div>`;

        item.innerHTML = `
            ${avatarHTML}
            <div class="user-name">${userDisplayNameMap[user.email] || user.username}</div>
            <button class="btn btn-primary btn-invite" onclick="inviteUser(this, '${user.id}')">
                <i class="fas fa-paper-plane"></i> <span>Convidar</span>
            </button>
        `;
        list.appendChild(item);
    });
}

async function inviteUser(button, inviteeId) {
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    try {
        const res = await api(`/boards/${state.board.id}/invite`, {
            method: 'POST',
            body: JSON.stringify({
                invitee_id: inviteeId
            })
        });
        if (res?.ok) {
            button.innerHTML = '<i class="fas fa-check"></i> Convidado';
            button.classList.add('invited');
        } else {
            showError('Falha ao convidar usuário.');
            button.innerHTML = '<i class="fas fa-paper-plane"></i>';
            button.disabled = false;
        }
    } catch (e) {
        showError('Erro de conexão.');
        button.innerHTML = '<i class="fas fa-paper-plane"></i>';
        button.disabled = false;
    }
}

function filterInvitableUsers() {
    const searchTerm = document.getElementById('inviteUserSearch').value.toLowerCase();
    const users = document.querySelectorAll('.invitable-user-item');
    users.forEach(user => {
        const name = user.dataset.userName.toLowerCase();
        const email = user.dataset.userEmail.toLowerCase();
        if (name.includes(searchTerm) || email.includes(searchTerm)) {
            user.style.display = 'flex';
        } else {
            user.style.display = 'none';
        }
    });
}


async function loadBoardMembers() {
    try {
        const res = await api(`/boards/${state.board.id}/members`);
        if (res?.ok) {
            state.boardMembers = await res.json();
        } else {
            state.boardMembers = [];
        }
    } catch (e) {
        console.error("Erro ao carregar membros do quadro", e);
        state.boardMembers = [];
    }
}

function renderBoardMembers() {
    const container = document.getElementById('boardMembers');
    container.innerHTML = '';
    state.boardMembers.forEach(member => {
        const displayName = userDisplayNameMap[member.email] || member.username;
        const avatar = document.createElement('div');
        avatar.className = 'board-member-avatar';
        avatar.title = `${displayName} ${member.is_owner ? '(Dono)' : ''}`;
        if (member.avatar) {
            avatar.style.backgroundImage = `url(${member.avatar})`;
        } else {
            avatar.textContent = displayName.charAt(0).toUpperCase();
        }
        container.appendChild(avatar);
    });
}

function populateAssigneeSelector(currentAssignee, type = 'public') {
    const isPrivate = type === 'private';
    const container = isPrivate ? elements.privateAssigneeSelector : elements.assigneeSelector;
    const hiddenInput = document.getElementById(isPrivate ? 'privateTaskAssignee' : 'taskAssignee');
    const userSource = isPrivate ? state.boardMembers : state.users;

    if (!container || !hiddenInput) return;
    hiddenInput.value = '';

    container.innerHTML = userSource.map(user => {
        const userIdentifier = user.username || user.email;
        const displayName = userDisplayNameModalMap[user.email] || userDisplayNameMap[user.email] || userIdentifier;
        const isSelected = userIdentifier === currentAssignee;
        if (isSelected) hiddenInput.value = userIdentifier;

        const avatarHTML = user.avatar ?
            `<div class="assignee-item-avatar" style="background-image: url(${user.avatar})"></div>` :
            `<div class="assignee-item-avatar">${displayName.charAt(0).toUpperCase()}</div>`;

        return `
            <div class="assignee-item ${isSelected ? 'selected' : ''}" data-value="${userIdentifier}">
                ${avatarHTML}
                <span class="assignee-item-name">${displayName}</span>
            </div>`;
    }).join('');
}

function openManageMembersModal() {
    if (state.board.is_public) return; 
    const modal = elements.manageMembersModal;
    modal.style.display = 'flex';
    renderManageMembersList();
}

function closeManageMembersModal() {
    _performCloseAnimation(elements.manageMembersModal);
}

function renderManageMembersList() {
    const list = document.getElementById('boardMembersList');
    if (!list) return;

    list.innerHTML = '';
    const isOwner = state.user.id === state.board.owner_id;

    state.boardMembers.forEach(member => {
        const item = document.createElement('div');
        item.className = 'member-list-item';
        const displayName = userDisplayNameMap[member.email] || member.username;

        const avatar = member.avatar ? `<div class="user-avatar" style="background-image: url(${member.avatar})"></div>`
                                     : `<div class="user-avatar">${displayName.charAt(0)}</div>`;

        let removeButtonHTML = '';
        if (isOwner && !member.is_owner) {
            removeButtonHTML = `<button class="btn btn-sm btn-remove-member" onclick="removeMember('${member.id}')" title="Remover membro"><i class="fas fa-times"></i></button>`;
        }
        
        item.innerHTML = `
            <div class="member-info">
                ${avatar}
                <div class="member-details">
                    <span class="user-name">${displayName}</span>
                    ${member.is_owner ? '<span class="user-role-tag">Dono</span>' : ''}
                </div>
            </div>
            ${removeButtonHTML}
        `;
        list.appendChild(item);
    });
}

async function removeMember(memberId) {
    const member = state.boardMembers.find(m => m.id === memberId);
    if (!member) return;

    const memberName = userDisplayNameMap[member.email] || member.username;
    if (!confirm(`Tem certeza que deseja remover "${memberName}" do quadro?`)) return;

    try {
        const response = await api(`/boards/${state.board.id}/members/${memberId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            state.boardMembers = state.boardMembers.filter(m => m.id !== memberId);
            renderManageMembersList(); 
            renderBoardMembers();  
        } else {
            const err = await response.json();
            showError(err.error || 'Falha ao remover o membro.');
        }
    } catch (error) {
        showError('Erro de conexão ao remover membro.');
    }
}

// Global scope
window.openManageMembersModal = openManageMembersModal;
window.closeManageMembersModal = closeManageMembersModal;
window.removeMember = removeMember;
window.openModal = openModal; window.editCard = editCard;
window.closeModal = closeModal; window.closePrivateTaskModal = closePrivateTaskModal;
window.closeStatsModal = closeStatsModal; window.openStatsModal = openStatsModal;
window.openColumnModal = openColumnModal; window.closeColumnModal = closeColumnModal;
window.deleteColumn = deleteColumn; window.openPrivateBoardModal = openPrivateBoardModal;
window.closePrivateBoardModal = closePrivateBoardModal; window.respondToInvitation = respondToInvitation;
window.closeInviteUserModal = closeInviteUserModal; window.inviteUser = inviteUser;
window.handleTaskNotificationClick = handleTaskNotificationClick;

window.toggleCommentInput = section => {
    const allInputs = document.querySelectorAll('.comment-input-container');
    const targetInput = document.getElementById(`${section}-input`);
    const isVisible = targetInput.style.display === 'block';
    allInputs.forEach(c => c.style.display = 'none');
    if (!isVisible) {
        targetInput.style.display = 'block';
        targetInput.querySelector('textarea').focus();
    }
};

window.saveComment = section => {
    const inputContainer = document.getElementById(`${section}-input`);
    const textarea = inputContainer.querySelector('textarea');
    const text = textarea.value.trim();
    if (text) {
        const container = document.getElementById(`${section}-comments`);
        const loggedInUser = state.users.find(u => u.id === state.user.id);
        const authorName = loggedInUser ? (userDisplayNameMap[loggedInUser.email] || loggedInUser.username) : 'Desconhecido';
        const newComment = { text: text, author: authorName, timestamp: new Date().toLocaleString('pt-BR') };
        container.appendChild(createCommentElement(newComment));
        inputContainer.style.display = 'none';
        textarea.value = '';
        handleFormInput();
    }
};

window.cancelComment = section => {
    const input = document.getElementById(`${section}-input`);
    input.style.display = 'none';
    input.querySelector('textarea').value = '';
};

window.togglePrivateCommentInput = () => {
    const targetInput = document.getElementById('private-comment-input');
    const isVisible = targetInput.style.display === 'block';
    targetInput.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
        targetInput.querySelector('textarea').focus();
    }
};
window.savePrivateComment = () => {
    const inputContainer = document.getElementById('private-comment-input');
    const textarea = inputContainer.querySelector('textarea');
    const text = textarea.value.trim();
    if (text) {
        const container = document.getElementById('private-comments-list');
        const loggedInUser = state.boardMembers.find(u => u.id === state.user.id);
        const authorName = loggedInUser ? (userDisplayNameMap[loggedInUser.email] || loggedInUser.username) : 'Desconhecido';
        const newComment = { text, author: authorName, timestamp: new Date().toLocaleString('pt-BR') };
        container.appendChild(createCommentElement(newComment));
        inputContainer.style.display = 'none';
        textarea.value = '';
        handlePrivateFormInput();
    }
};
window.cancelPrivateComment = () => {
    const input = document.getElementById('private-comment-input');
    input.style.display = 'none';
    input.querySelector('textarea').value = '';
};


window.deleteComment = button => {
    if (confirm('Excluir este comentário?')) {
        const isPrivate = !!button.closest('#privateTaskModal');
        button.closest('.comment-item').remove();
        if (isPrivate) {
            handlePrivateFormInput();
        } else {
            handleFormInput();
        }
    }
};

window.editComment = button => {
    const commentItem = button.closest('.comment-item');
    const commentContent = commentItem.querySelector('.comment-content');
    const originalText = commentContent.textContent;
    const isPrivate = !!button.closest('#privateTaskModal');

    const editContainer = document.createElement('div');
    editContainer.className = 'comment-edit-container';
    editContainer.innerHTML = `
        <textarea class="comment-edit-textarea">${originalText}</textarea>
        <div class="comment-actions">
            <button type="button" class="btn-save"><i class="fas fa-check"></i> Salvar</button>
            <button type="button" class="btn-cancel"><i class="fas fa-times"></i></button>
        </div>`;
    commentItem.style.display = 'none';
    commentItem.after(editContainer);
    editContainer.querySelector('textarea').focus();

    editContainer.querySelector('.btn-save').onclick = () => {
        const newText = editContainer.querySelector('.comment-edit-textarea').value.trim();
        if (newText) {
            commentContent.textContent = newText;
            if (isPrivate) {
                handlePrivateFormInput();
            } else {
                handleFormInput();
            }
        }
        editContainer.remove();
        commentItem.style.display = 'block';
    };
    editContainer.querySelector('.btn-cancel').onclick = () => {
        editContainer.remove();
        commentItem.style.display = 'block';
    };
};