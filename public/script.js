const SUPABASE_URL = 'https://lzjunqtkldknjynsyhbi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6anVucXRrbGRrbmp5bnN5aGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAyMDQ0NjksImV4cCI6MjA2NTc4MDQ2OX0.wEN5Y4ls43fQOjHtLjTv85GuIEdFRR5mL5HD4ZTNBTc';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
    user: null,
    board: null,
    columns: [],
    cards: [],
    solucionadoId: null,
    naoSolucionadoId: null,
    users: [],
    editingCardId: null,
    editingColumnId: null,
    currentColumnId: null,
    pollingInterval: null, // Para controlar o nosso polling
    isModalDirty: false,
    privateBoards: [],
    activeSection: 'suporte',
};

// ... (COLE AQUI O RESTANTE DO SEU SCRIPT.JS - Mapeamentos de usuário, etc.) ...
// O CONTEÚDO ABAIXO É O RESTANTE DO ARQUIVO COM AS FUNÇÕES DE POLLING IMPLEMENTADAS

// mapeamento global de nomes de usuário
const userDisplayNameMap = {
    'eduardo@kanban.local': 'Eduardo Tomaz',
    'alison@kanban.local': 'Alison Silva',
    'marques@kanban.local': 'Gabriel Marques',
    'rosa@kanban.local': 'Gabriel Rosa',
    'miyake@kanban.local': 'João Miyake',
    'gomes@kanban.local': 'João Gomes',
    'rodrigo@kanban.local': 'Rodrigo Akira',
    'rubens@kanban.local': 'Rubens Leite',
    'kaiky@kanban.local': 'Kaiky Leandro',
    'pedro@kanban.local': 'Pedro Santos',
};

// mapeamento de nomes curtos para o modal
const userDisplayNameModalMap = {
    'eduardo@kanban.local': 'Eduardo',
    'alison@kanban.local': 'Alison',
    'marques@kanban.local': 'Marques',
    'rosa@kanban.local': 'Rosa',
    'miyake@kanban.local': 'Miyake',
    'gomes@kanban.local': 'Gomes',
    'rodrigo@kanban.local': 'Rodrigo',
    'rubens@kanban.local': 'Rubens',
    'kaiky@kanban.local': 'Kaiky',
    'pedro@kanban.local': 'Pedro',
};


// elementos DOM
let elements = {};

// utilitário de sleep
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// utilitário de debounce
const debounce = (func, wait) => {
    let timeout;
    const debounced = (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
    debounced.cancel = () => {
        clearTimeout(timeout);
    };
    return debounced;
};

// função para chamadas de API com retry
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

// inicialização ao carregar o DOM
document.addEventListener('DOMContentLoaded', async () => {
    elements = {
        loginSection: document.getElementById('loginSection'),
        kanbanSection: document.getElementById('kanbanSection'),
        kanbanContainer: document.querySelector('.kanban-container'),
        sidebar: document.getElementById('sidebar'),
        loader: document.getElementById('loader'),
        taskModal: document.getElementById('taskModal'),
        columnModal: document.getElementById('columnModal'),
        statsModal: document.getElementById('statsModal'),
        taskForm: document.getElementById('taskForm'),
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
    };

    addEventListeners();
    await checkAuth();
});

// lida com o clique na lista de responsáveis (delegação de eventos)
function handleAssigneeClick(event) {
    const item = event.target.closest('.assignee-item');
    if (!item) return;

    const container = elements.assigneeSelector;
    const hiddenInput = document.getElementById('taskAssignee');

    container.querySelectorAll('.assignee-item').forEach(el => el.classList.remove('selected'));
    item.classList.add('selected');
    hiddenInput.value = item.dataset.value;
    handleFormInput();
}

// adiciona event listeners aos elementos
function addEventListeners() {
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    elements.btnLogoutSidebar?.addEventListener('click', logout);
    elements.taskForm?.addEventListener('submit', handleSubmit);
    elements.columnForm?.addEventListener('submit', handleColumnSubmit);
    elements.btnSolve?.addEventListener('click', () => moveCardToSolved(true));
    elements.btnUnsolve?.addEventListener('click', () => moveCardToSolved(false));
    elements.btnReturnToScale?.addEventListener('click', returnCardToBoard);
    elements.statsFilterUser?.addEventListener('change', updateStatsView);
    elements.assigneeSelector?.addEventListener('click', handleAssigneeClick);

    document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        const section = item.dataset.section;
        
        if (section === 'suporte') {
            stopPolling();
            location.reload(); 
        } else if (section === 'private-boards') {
            stopPolling();
            loadAndShowPrivateBoards();
        } else {
            stopPolling();
            showSection(`${section}Section`);
        }
    });
});

    document.getElementById('btnCreatePrivateBoard').addEventListener('click', openPrivateBoardModal);
    document.getElementById('privateBoardForm').addEventListener('submit', handlePrivateBoardSubmit);
    document.getElementById('btnBackToBoards').addEventListener('click', () => {
        stopPolling();
        loadAndShowPrivateBoards();
        document.getElementById('btnBackToBoards').style.display = 'none';
        document.querySelector('.header-main h2').innerHTML = '<i class="fas fa-headset"></i> Suporte';
    });

    window.addEventListener('click', e => {
        if (e.target.classList.contains('modal')) {
            closeModal();
            closeStatsModal();
            closeColumnModal();
            closePrivateBoardModal();
        }
    });
    
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeModal();
            closeStatsModal();
            closeColumnModal();
            closePrivateBoardModal();
        }
    });

    document.getElementById('avatarUpload')?.addEventListener('change', handleAvatarUpload);
}

async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        state.user = session.user;
        await initApp();
    } else {
        showLogin();
    }
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

    const { data: { session }, error } = await supabaseClient.auth.signInWithPassword({
        email: formData.get('email'),
        password: formData.get('password')
    });
    
    if (error) {
        showError(error.message);
        submitButton.disabled = false;
        submitButton.innerHTML = 'Entrar';
    } else if (session) {
        elements.loginSection.classList.add('fade-out');
        setTimeout(async () => {
            await checkAuth();
        }, 500);
    }
}

async function logout() {
    stopPolling();
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
    document.getElementById('btnBackToBoards').style.display = 'none';
    document.querySelector('.header-main h2').innerHTML = '<i class="fas fa-headset"></i> Suporte'; 
    elements.kanbanSection.style.opacity = 0;
    elements.loginSection.style.display = 'none';
    elements.kanbanSection.style.display = 'block';
    elements.sidebar.style.display = 'flex';

    try {
        const boardsResponse = await api('/boards/public'); 
        if (boardsResponse?.ok) {
            const boards = await boardsResponse.json();
            if (boards.length > 0) {
                state.board = boards[0];
                await loadUsers();
                await loadData(); 

                updateSidebarUser();
                renderColumns();
                renderCards();
                updateStats(); 
                startPolling(); // Inicia o polling no lugar do WebSocket
                elements.loader.style.display = 'none';
                elements.kanbanSection.classList.add('fade-in');
            } else {
                 elements.loader.style.display = 'none';
                 showError("Nenhum quadro Kanban encontrado.");
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

async function loadData() {
    const columnsResponse = await api(`/boards/${state.board.id}/columns`);
    if (!columnsResponse?.ok) throw new Error('Erro ao carregar colunas');
    state.columns = await columnsResponse.json();
    state.columns.sort((a,b) => a.position - b.position);
    
    state.solucionadoId = null;
    state.naoSolucionadoId = null;

    state.columns.forEach(col => {
        const titleLower = col.title.trim().toLowerCase();
        if (titleLower === 'solucionado') state.solucionadoId = col.id;
        if (titleLower === 'não solucionado') state.naoSolucionadoId = col.id;
    });

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
    if (sectionElement) sectionElement.style.display = 'block';
    state.activeSection = sectionId;
}

async function loadAndShowPrivateBoards() {
    showSection('privateBoardsSection');
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
    }
}

function renderPrivateBoardsList() {
    const container = document.getElementById('privateBoardsList');
    container.innerHTML = ''; 
    if (state.privateBoards.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted);">Você ainda não tem quadros privados. Crie um!</p>`;
        return;
    }
    state.privateBoards.forEach(board => {
        const card = document.createElement('div');
        card.className = 'private-board-card';
        card.dataset.boardId = board.id;
        card.innerHTML = `
            <button class="delete-board-btn" title="Excluir quadro"><i class="fas fa-times"></i></button>
            <div>
                <h3><i class="fas fa-user-lock" style="color:${board.color || '#3498db'}"></i> ${board.title}</h3>
                <p>${board.description || 'Sem descrição.'}</p>
            </div>
            <div class="board-footer">Criado em: ${new Date(board.created_at).toLocaleDateString()}</div>`;
        card.addEventListener('click', () => selectPrivateBoard(board.id));
        card.querySelector('.delete-board-btn').addEventListener('click', (event) => handleDeleteBoard(board.id, event));
        container.appendChild(card);
    });
}

async function selectPrivateBoard(boardId) {
    const selectedBoard = state.privateBoards.find(b => b.id === boardId);
    if (!selectedBoard) return;

    document.getElementById('btnBackToBoards').style.display = 'inline-flex';
    elements.loader.style.display = 'flex';
    state.board = selectedBoard; 
    await loadData(); 
    renderColumns();
    renderCards();
    updateStats();
    startPolling(); // Inicia o polling para o quadro privado
    showSection('kanbanSection'); 
    document.querySelector('.header-main h2').innerHTML = `<i class="fas fa-user-lock"></i> ${state.board.title}`;
    elements.loader.style.display = 'none';
}

// ----- LÓGICA DE POLLING (Substituindo WebSockets) -----

function stopPolling() {
    if (state.pollingInterval) {
        clearInterval(state.pollingInterval);
        state.pollingInterval = null;
    }
}

async function pollForUpdates() {
    if (!state.board) {
        stopPolling();
        return;
    }
    // Salva o card que está sendo editado para não fechar o modal
    const currentlyEditing = state.editingCardId;
    
    await loadData();
    renderColumns();
    renderCards();
    updateStats();
    
    // Se um card estava sendo editado, reabre o modal com os dados atualizados
    if (currentlyEditing) {
        const updatedCard = state.cards.find(c => c.id === currentlyEditing);
        if (updatedCard) {
            editCard(currentlyEditing);
        } else {
            // O card foi deletado por outro usuário, então fecha o modal
            closeModal();
        }
    }
}

function startPolling() {
    stopPolling(); // Para qualquer polling anterior antes de iniciar um novo
    // Busca atualizações a cada 15 segundos (15000 ms)
    state.pollingInterval = setInterval(pollForUpdates, 15000);
}


// ... (O restante do arquivo JS continua aqui, sem a função `connectWS`)
// ... (Copie e cole o resto do seu script.js a partir da função handlePrivateBoardSubmit)

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
        const response = await api('/boards', { method: 'POST', body: JSON.stringify(boardData) });
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

function renderColumns() {
    const kanbanContainer = elements.kanbanContainer;
    kanbanContainer.innerHTML = '';
    
    state.columns.forEach(col => {
        if (col.id === state.solucionadoId || col.id === state.naoSolucionadoId) return;
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
        const response = await api(`/columns/${columnId}`, { method: 'DELETE' });
        if (!response.ok) {
            const errorData = await response.json();
            showError(errorData.error || 'Não foi possível excluir a coluna.');
        } else {
            pollForUpdates();
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
    let activeCards = state.cards.filter(c => c.column_id !== state.solucionadoId && c.column_id !== state.naoSolucionadoId);
    activeCards.sort((a, b) => a.position - b.position);
    activeCards.forEach(card => {
        const list = document.querySelector(`.task-list[data-column-id="${card.column_id}"]`);
        if (list) list.appendChild(createCardElement(card));
    });
}

function createUserAvatar(user) {
    const avatarElement = document.createElement('div');
    avatarElement.className = 'assignee-avatar';
    if (user && user.avatar) {
        avatarElement.style.backgroundImage = `url(${user.avatar})`;
    } else {
        const icon = document.createElement('i');
        icon.className = 'fas fa-user';
        avatarElement.appendChild(icon);
    }
    return avatarElement;
}

function createCardElement(card) {
    let isOverdue = false;
    let isDueToday = false;
    const isCompleted = card.column_id === state.solucionadoId || card.column_id === state.naoSolucionadoId;
    if (card.due_date && !isCompleted) {
        const now = new Date();
        const dueDate = new Date(card.due_date);
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
    const assignedUser = state.users.find(u => u.username === card.assigned_to || u.email === card.assigned_to);
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

function handleFormInput() {
    if (state.editingCardId) {
        state.isModalDirty = true;
        autoSave();
    }
}

function populateAssigneeSelector(currentAssignee) {
    const container = elements.assigneeSelector;
    const hiddenInput = document.getElementById('taskAssignee');
    if (!container || !hiddenInput) return;

    hiddenInput.value = '';

    const itemsHTML = state.users.map(user => {
        const userIdentifier = user.username || user.email;
        const displayName = userDisplayNameModalMap[user.email] || userDisplayNameMap[user.email] || userIdentifier;
        const isSelected = userIdentifier === currentAssignee;
        if (isSelected) hiddenInput.value = userIdentifier;

        const avatarHTML = user.avatar 
            ? `<div class="assignee-item-avatar" style="background-image: url(${user.avatar})"></div>`
            : `<div class="assignee-item-avatar">${displayName.charAt(0).toUpperCase()}</div>`;

        return `
            <div class="assignee-item ${isSelected ? 'selected' : ''}" data-value="${userIdentifier}">
                ${avatarHTML}
                <span class="assignee-item-name">${displayName}</span>
            </div>
        `;
    }).join('');

    container.innerHTML = itemsHTML;
}

async function openModal(columnName, columnId) {
    const targetColumnId = columnId;
    if (!targetColumnId) return;
    
    state.isModalDirty = false;
    state.editingCardId = null;
    state.currentColumnId = targetColumnId;
    elements.taskForm.reset();
    
    elements.modalTitle.querySelector('span').textContent = 'Nova Tarefa';
    document.getElementById('new-task-description-group').style.display = 'block';
    document.querySelector('.modal-comments').style.display = 'none';
    elements.btnSolve.style.display = 'none';
    elements.btnUnsolve.style.display = 'none';
    elements.btnReturnToScale.style.display = 'none';
    elements.btnConfirm.style.display = 'inline-flex';
    elements.assigneeSelector.innerHTML = '<div style="text-align:center; color: var(--text-muted);">Carregando...</div>';
    clearComments();
    
    elements.taskModal.style.display = 'flex';
    document.getElementById('taskTitle').focus();

    setTimeout(() => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('taskDate').value = now.toISOString().slice(0, 16);
        document.querySelector('input[name="priority"][value="media"]').checked = true;
        
        const modalContent = elements.taskModal.querySelector('.modal-content');
        modalContent.classList.remove('priority-baixa', 'priority-media', 'priority-alta');
        modalContent.classList.add('priority-media');
        
        populateAssigneeSelector(null);
    }, 10);
}

function openPrivateBoardModal() {
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

async function editCard(cardId) {
    const card = state.cards.find(c => c.id === cardId);
    if (!card) return;
    
    state.isModalDirty = false;
    state.editingCardId = cardId;
    elements.taskForm.reset();
    
    elements.modalTitle.querySelector('span').textContent = 'Editar Tarefa';
    document.getElementById('taskTitle').value = card.title;
    document.getElementById('new-task-description-group').style.display = 'none';
    document.querySelector('.modal-comments').style.display = 'flex';
    elements.btnConfirm.style.display = 'none';
    
    elements.assigneeSelector.innerHTML = '<div style="text-align:center; color: var(--text-muted);">Carregando...</div>';
    clearComments();

    elements.taskModal.style.display = 'flex';

    setTimeout(() => {
        const priority = card.priority || 'media';
        document.querySelector(`input[name="priority"][value="${priority}"]`).checked = true;

        const modalContent = elements.taskModal.querySelector('.modal-content');
        modalContent.classList.remove('priority-baixa', 'priority-media', 'priority-alta');
        modalContent.classList.add(`priority-${priority}`);

        const isArchived = card.column_id === state.solucionadoId || card.column_id === state.naoSolucionadoId;
        elements.btnSolve.style.display = isArchived ? 'none' : 'inline-flex';
        elements.btnUnsolve.style.display = isArchived ? 'none' : 'inline-flex';
        elements.btnReturnToScale.style.display = isArchived ? 'inline-flex' : 'none';
        
        populateAssigneeSelector(card.assigned_to);

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
        document.querySelectorAll('input[name="priority"]').forEach(radio => {
            radio.removeEventListener('change', handleFormInput);
            radio.addEventListener('change', handleFormInput);
        });
    }, 10);
}


async function saveCardChanges() {
    if (!state.editingCardId || !state.isModalDirty) return;
    try {
        await api(`/cards/${state.editingCardId}`, {
            method: 'PUT',
            body: JSON.stringify(getFormData())
        });
        state.isModalDirty = false;
        pollForUpdates();
    } catch (error) { /* possivel futuro log */ }
}

const autoSave = debounce(saveCardChanges, 500);

function _performCloseAnimation(modalElement) {
    if (modalElement && modalElement.style.display === 'flex' && !modalElement.classList.contains('closing')) {
        modalElement.classList.add('closing');
        setTimeout(() => {
            modalElement.style.display = 'none';
            modalElement.classList.remove('closing');
        }, 300);
    }
}

async function closeModal() {
    if (state.editingCardId && state.isModalDirty) {
        autoSave.cancel();
        await saveCardChanges();
    }
    _performCloseAnimation(elements.taskModal);
    state.editingCardId = null;
    state.currentColumnId = null;
    state.isModalDirty = false;
    clearComments();
    elements.taskForm.removeEventListener('input', handleFormInput);
}

function openColumnModal(columnId = null) {
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

async function handleSubmit(e) {
    e.preventDefault();
    if (state.editingCardId) return; 
    const cardData = getFormData();
    if (!cardData.title) {
        showError('O ID e Nome do Cliente é obrigatório');
        return;
    }
    try {
        const response = await api(`/columns/${state.currentColumnId}/cards`, {
            method: 'POST',
            body: JSON.stringify(cardData)
        });
        if (response?.ok) {
            closeModal();
            pollForUpdates();
        } else showError('Erro ao criar tarefa');
    } catch (error) { showError('Erro de conexão'); }
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
        if (state.editingColumnId) { /* baianei */ }
        else {
            response = await api('/columns', {
                method: 'POST',
                body: JSON.stringify(columnData)
            });
        }
        if (response?.ok) {
            closeColumnModal();
            pollForUpdates();
        }
        else {
            const err = await response.json();
            showError(err.error || 'Erro ao salvar coluna.');
        }
    } catch (error) {
        showError('Erro de conexão ao salvar a coluna.');
    }
}

async function handleDeleteBoard(boardId, event) {
    event.stopPropagation();
    const boardTitle = state.privateBoards.find(b => b.id === boardId)?.title || "este quadro";
    if (!confirm(`Tem certeza que deseja excluir "${boardTitle}"?\n\nATENÇÃO: Todas as colunas e tarefas dentro deste quadro serão permanentemente excluídas.`)) return;
    try {
        const response = await api(`/boards/${boardId}`, { method: 'DELETE' });
        if (response?.ok) {
            const boardCardElement = document.querySelector(`.private-board-card[data-board-id="${boardId}"]`);
            boardCardElement?.remove();
            state.privateBoards = state.privateBoards.filter(b => b.id !== boardId);
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
        await api(`/cards/${cardId}`, { method: 'DELETE' });
        pollForUpdates();
    } catch (error) { showError('Erro ao excluir a tarefa'); }
}

async function moveCard(cardId, columnId, position = 0) {
    try {
        await api(`/cards/${cardId}/move`, {
            method: 'PUT',
            body: JSON.stringify({ column_id: columnId, position })
        });
        pollForUpdates();
    } catch (error) { showError('Erro ao mover a tarefa'); }
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
    await moveCard(state.editingCardId, targetId);
    closeModal();
}

async function returnCardToBoard() {
    if (!state.editingCardId) return;
    const firstActiveColumn = state.columns.find(c => c.id !== state.solucionadoId && c.id !== state.naoSolucionadoId);
    if (!firstActiveColumn) {
        showError("Nenhuma coluna de trabalho ativa encontrada para retornar o card.");
        return;
    }
    if (state.isModalDirty) {
        autoSave.cancel();
        await saveCardChanges();
    }
    const position = state.cards.filter(c => c.column_id === firstActiveColumn.id).length;
    await moveCard(state.editingCardId, firstActiveColumn.id, position);
    closeModal();
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.task:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
        else return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function handleDrop(e) {
    e.preventDefault();
    const targetList = e.target.closest('.task-list');
    if (!targetList) return;
    targetList.classList.remove('drag-over');
    const cardId = parseInt(e.dataTransfer.getData('text/plain'));
    const cardToMove = state.cards.find(c => c.id === cardId);
    if (!cardToMove) return;
    const newColumnId = parseInt(targetList.dataset.columnId);
    const oldColumnId = cardToMove.column_id;
    const oldPosition = cardToMove.position;
    const afterElement = getDragAfterElement(targetList, e.clientY);
    let newPosition;
    if (afterElement) {
        const afterCard = state.cards.find(c => c.id === parseInt(afterElement.dataset.cardId));
        newPosition = afterCard.position;
    } else {
        newPosition = state.cards.filter(c => c.column_id === newColumnId).length;
    }
    if (oldColumnId === newColumnId && oldPosition === newPosition) return;
    if (oldColumnId === newColumnId && oldPosition < newPosition) newPosition--;
    const cardIndex = state.cards.findIndex(c => c.id === cardId);
    const [movedCard] = state.cards.splice(cardIndex, 1);
    state.cards.forEach(c => {
        if (c.column_id === oldColumnId && c.position > oldPosition) c.position--;
    });
    state.cards.forEach(c => {
        if (c.column_id === newColumnId && c.position >= newPosition) c.position++;
    });
    movedCard.column_id = newColumnId;
    movedCard.position = newPosition;
    state.cards.push(movedCard);
    renderCards();
    moveCard(cardId, newColumnId, newPosition);
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
        due_date: dueDate
    };
}

function updateStats() {
    if (!state.cards) { 
        return;
    }
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
    } catch (e) {}
}

function createCommentElement(comment) {
    const div = document.createElement('div');
    div.className = 'comment-item';
    const text = typeof comment === 'object' ? (comment.text || '') : comment;
    const authorName = typeof comment === 'object' && comment.author ? comment.author : 'Desconhecido';
    const time = typeof comment === 'object' ? (comment.timestamp || new Date().toLocaleString('pt-BR')) : new Date().toLocaleString('pt-BR');
    const authorUser = state.users.find(u => (userDisplayNameMap[u.email] || u.username) === authorName);
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
    body.innerHTML = cards.length === 0 
        ? '<p style="text-align: center; color: var(--text-muted);">Nenhuma tarefa encontrada.</p>'
        : cards.map(card => {
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
    title.innerHTML = status === 'solucionado' ? '<i class="fas fa-check-circle"></i> Tarefas Solucionadas'
        : status === 'nao-solucionado' ? '<i class="fas fa-times-circle"></i> Tarefas Não Solucionadas'
        : '<i class="fa-solid fa-spinner"></i> Tarefas Pendentes';
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
        const response = await api('/user/avatar', { method: 'POST', body: formData });
        if (response?.ok) {
            const result = await response.json();
            const userIndex = state.users.findIndex(u => u.id === state.user.id);
            if(userIndex > -1) state.users[userIndex].avatar = result.avatar_url;
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

// Funções globais
window.openModal = openModal;
window.openStatsModal = openStatsModal;
window.closeModal = closeModal;
window.closeStatsModal = closeStatsModal;
window.openColumnModal = openColumnModal;
window.closeColumnModal = closeColumnModal;
window.deleteColumn = deleteColumn; 
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
window.openPrivateBoardModal = openPrivateBoardModal;
window.closePrivateBoardModal = closePrivateBoardModal;
window.cancelComment = section => {
    const input = document.getElementById(`${section}-input`);
    input.style.display = 'none';
    input.querySelector('textarea').value = '';
};
window.deleteComment = button => {
    if (confirm('Excluir este comentário?')) {
        button.closest('.comment-item').remove();
        handleFormInput();
    }
};
window.editComment = button => {
    const commentItem = button.closest('.comment-item');
    const commentContent = commentItem.querySelector('.comment-content');
    const originalText = commentContent.textContent;
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
            handleFormInput();
        }
        editContainer.remove();
        commentItem.style.display = 'block';
    };
    editContainer.querySelector('.btn-cancel').onclick = () => {
        editContainer.remove();
        commentItem.style.display = 'block';
    };
};