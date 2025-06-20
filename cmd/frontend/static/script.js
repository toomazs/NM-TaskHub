const SUPABASE_URL = 'https://lzjunqtkldknjynsyhbi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6anVucXRrbGRrbmp5bnN5aGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAyMDQ0NjksImV4cCI6MjA2NTc4MDQ2OX0.wEN5Y4ls43fQOjHtLjTv85GuIEdFRR5mL5HD4ZTNBTc';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

 // escopo global de estado
const state = {
    user: null,
    board: null,
    columns: [],
    cards: [],
    users: [],
    editingCardId: null,
    editingColumnId: null,
    currentColumnId: null,
    ws: null,
    columnMapping: {},
    solucionadoId: null,
    naoSolucionadoId: null,
    isModalDirty: false,
    privateBoards: [],
    activeSection: 'suporte',
};

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
    };

    addEventListeners();
    await checkAuth();
});

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

    document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        const section = item.dataset.section;
        
        if (section === 'suporte') {
            location.reload(); 
        } else if (section === 'private-boards') {
            loadAndShowPrivateBoards();
        } else {
            showSection(`${section}Section`);
        }
    });
});

    document.getElementById('btnCreatePrivateBoard').addEventListener('click', openPrivateBoardModal);

    document.getElementById('privateBoardForm').addEventListener('submit', handlePrivateBoardSubmit);

    document.getElementById('btnBackToBoards').addEventListener('click', () => {
    state.ws?.close();
    
    loadAndShowPrivateBoards();

    document.getElementById('btnBackToBoards').style.display = 'none';
    document.querySelector('.header-main h2').innerHTML = '<i class="fas fa-headset"></i> Suporte';
});

    window.addEventListener('click', e => {
        if (e.target.classList.contains('modal')) {
            closeModal();
            closeStatsModal();
            closeColumnModal();
        }
    });
    
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeModal();
            closeStatsModal();
            closeColumnModal();
        }
    });

    document.getElementById('avatarUpload')?.addEventListener('change', handleAvatarUpload);
}

// verifica a autenticação do usuário
async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        state.user = session.user;
        await initApp();
    } else {
        showLogin();
    }
}

// exibe a tela de login
function showLogin() {
    elements.kanbanSection.style.display = 'none';
    elements.sidebar.style.display = 'none';
    document.body.classList.add('login-page');

    elements.loginSection.style.opacity = 0;
    elements.loginSection.style.display = 'flex';
    elements.loginSection.classList.remove('fade-out');
    elements.loginSection.classList.add('fade-in');
}

// lida com o submit do formulário de login
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

// realiza o logout do usuário
async function logout() {
    state.ws?.close();
    await supabaseClient.auth.signOut();
    location.reload();
}

// atualiza as informações do usuário na sidebar
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

// inicializa a aplicação principal
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
                connectWS();

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

// carrega os dados do quadro (colunas e cards)
async function loadData() {
    const columnsResponse = await api(`/boards/${state.board.id}/columns`);
    if (!columnsResponse?.ok) throw new Error('Erro ao carregar colunas');
    state.columns = await columnsResponse.json();
    state.columns.sort((a,b) => a.position - b.position);
    
    state.columnMapping = {};
    const titleMap = {
        'casos suporte': 'casos-suporte',
        'upgrades/retenção': 'upgrades-retencao',
        'escallo': 'escallo',
        'solucionado': 'solucionado',
        'não solucionado': 'nao-solucionado'
    };
    
    state.columns.forEach(col => {
        const key = titleMap[col.title.trim().toLowerCase()];
        if (key) {
            state.columnMapping[key] = col.id;
        }
        if (col.title.trim().toLowerCase() === 'solucionado') state.solucionadoId = col.id;
        if (col.title.trim().toLowerCase() === 'não solucionado') state.naoSolucionadoId = col.id;
    });

    const cardPromises = state.columns.map(col => api(`/columns/${col.id}/cards`).then(res => res?.ok ? res.json() : []));
    state.cards = (await Promise.all(cardPromises)).flat();
}

// carrega a lista de usuários
async function loadUsers() {
    try {
        const response = await api('/users');
        state.users = response?.ok ? await response.json() : [];
    } catch (error) {
        state.users = [];
    }
}

// função para controlar a visibilidade das seções
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

// carrega e exibe os quadros privados
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

// renderiza a lista de quadros privados
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
            <button class="delete-board-btn" title="Excluir quadro">
                <i class="fas fa-times"></i>
            </button>
            <div>
                <h3><i class="fas fa-user-lock" style="color:${board.color || '#3498db'}"></i>   ${board.title}</h3>
                <p>${board.description || 'Sem descrição.'}</p>
            </div>
            <div class="board-footer">
                Criado em: ${new Date(board.created_at).toLocaleDateString()}
            </div>
        `;
        
        card.addEventListener('click', () => selectPrivateBoard(board.id));
        
        const deleteBtn = card.querySelector('.delete-board-btn');
        deleteBtn.addEventListener('click', (event) => handleDeleteBoard(board.id, event));

        container.appendChild(card);
    });
}

async function selectPrivateBoard(boardId) {
    const selectedBoard = state.privateBoards.find(b => b.id === boardId);
    if (!selectedBoard) return;

    document.getElementById('btnBackToBoards').style.display = 'inline-flex';
    elements.loader.style.display = 'none';
    elements.loader.style.display = 'flex';
    state.board = selectedBoard; 
    
    await loadData(); 
    
    renderColumns();
    renderCards();
    updateStats(); 
    connectWS();
    
    showSection('kanbanSection'); 
    document.querySelector('.header-main h2').innerHTML = `<i class="fas fa-user-lock"></i> ${state.board.title}`;
    
    elements.loader.style.display = 'none';
}

// lida com a criação de um novo quadro privado
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

// renderiza as colunas no quadro
function renderColumns() {
    const kanbanContainer = elements.kanbanContainer;
    kanbanContainer.innerHTML = '';
    
    state.columns.forEach(col => {
        if (col.id === state.solucionadoId || col.id === state.naoSolucionadoId) {
            return;
        }
        kanbanContainer.appendChild(createColumnElement(col));
    });
    
    const addColumnPlaceholder = document.createElement('div');
    addColumnPlaceholder.className = 'add-column-placeholder';
    addColumnPlaceholder.innerHTML = `
        <button class="add-column-btn" onclick="openColumnModal()">
            <i class="fas fa-plus"></i> Adicionar Coluna
        </button>
    `;
    kanbanContainer.appendChild(addColumnPlaceholder);

    addDragAndDropListenersToColumns();
}

// cria o elemento HTML para uma coluna
function createColumnElement(column) {
    const columnEl = document.createElement('div');
    columnEl.className = 'column';
    columnEl.dataset.columnId = column.id;

    const iconMap = {
        'casos suporte': 'fas fa-headset',
        'upgrades/retenção': 'fas fa-arrow-up',
        'escallo': 'fas fa-phone',
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
        <div class="task-list" data-column-id="${column.id}"></div>
    `;
    return columnEl;
}

// deleta uma coluna
async function deleteColumn(columnId) {
    if (!confirm('Tem certeza que deseja excluir esta coluna?\n\nATENÇÃO: A coluna deve estar vazia.')) return;

    try {
        const response = await api(`/columns/${columnId}`, { method: 'DELETE' });

        if (!response.ok) {
            const errorData = await response.json();
            showError(errorData.error || 'Não foi possível excluir a coluna.');
        }
    } catch (error) {
        showError('Erro de conexão ao excluir a coluna.');
    }
}

// adiciona listeners de arrastar e soltar às colunas
function addDragAndDropListenersToColumns() {
    document.querySelectorAll('.task-list').forEach(taskList => {
        taskList.addEventListener('dragover', e => {
            e.preventDefault();
            e.currentTarget.classList.add('drag-over');
        });
        taskList.addEventListener('dragleave', e => {
            e.currentTarget.classList.remove('drag-over');
        });
        taskList.addEventListener('drop', e => {
            e.currentTarget.classList.remove('drag-over');
            handleDrop(e);
        });
    });
}

// renderiza os cards nas colunas
function renderCards() {
    document.querySelectorAll('.task-list').forEach(list => list.innerHTML = '');
    let activeCards = state.cards.filter(card => 
        card.column_id !== state.solucionadoId && 
        card.column_id !== state.naoSolucionadoId
    );
    activeCards.sort((a, b) => a.position - b.position);
    activeCards.forEach(card => {
        const list = document.querySelector(`.task-list[data-column-id="${card.column_id}"]`);
        if (list) list.appendChild(createCardElement(card));
    });
}

// cria o elemento de avatar do usuário
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

// cria o elemento HTML para um card
function createCardElement(card) {
    let isOverdue = false;
    let isDueToday = false;
    const isCompleted = card.column_id === state.solucionadoId || card.column_id === state.naoSolucionadoId;

    if (card.due_date && !isCompleted) {
        const now = new Date();
        const dueDate = new Date(card.due_date);
        if (now > dueDate) {
            isOverdue = true;
        } else {
            const warningTime = new Date(dueDate.getTime());
            warningTime.setHours(warningTime.getHours() - 1);
            if (now >= warningTime) {
                isDueToday = true;
            }
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
        <div class="task-actions">
            <button class="action-btn delete-btn"><i class="fas fa-trash"></i></button>
        </div>
        <div class="task-header">
            <div class="task-title">${card.title}</div>
        </div>
        <div class="task-meta">
            <div class="task-assignee">
                ${assigneeAvatarElement.outerHTML}
                <span>${assigneeDisplayName}</span>
            </div>
            <div class="task-due-info">
                <span class="task-date-text">
                    ${card.due_date ? new Date(card.due_date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
                <div class="task-status-icons">${statusIconHTML}</div>
            </div>
        </div>
    `;
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

// lida com a entrada de dados no formulário do modal
function handleFormInput() {
    if (state.editingCardId) {
        state.isModalDirty = true;
        autoSave();
    }
}

// preenche o seletor de responsáveis
function populateAssigneeSelector(currentAssignee) {
    const container = document.getElementById('assignee-selector');
    const hiddenInput = document.getElementById('taskAssignee');
    if (!container || !hiddenInput) return;

    container.innerHTML = '';
    hiddenInput.value = '';

    state.users.forEach(user => {
        const userIdentifier = user.username || user.email;
        const displayName = userDisplayNameModalMap[user.email] || userDisplayNameMap[user.email] || userIdentifier;

        const item = document.createElement('div');
        item.className = 'assignee-item';
        item.dataset.value = userIdentifier;

        const avatar = document.createElement('div');
        avatar.className = 'assignee-item-avatar';
        if (user.avatar) {
            avatar.style.backgroundImage = `url(${user.avatar})`;
        } else {
            avatar.textContent = displayName.charAt(0).toUpperCase();
        }

        const name = document.createElement('span');
        name.className = 'assignee-item-name';
        name.textContent = displayName;

        item.appendChild(avatar);
        item.appendChild(name);

        item.addEventListener('click', () => {
            container.querySelectorAll('.assignee-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            hiddenInput.value = userIdentifier;
            handleFormInput();
        });

        if (userIdentifier === currentAssignee) {
            item.classList.add('selected');
            hiddenInput.value = userIdentifier;
        }

        container.appendChild(item);
    });
}

// abre o modal para criar ou editar uma tarefa
async function openModal(columnName, columnId) {
    const targetColumnId = columnId || state.columnMapping[columnName];
    if (!targetColumnId) return;
    
    state.isModalDirty = false;
    state.editingCardId = null;
    state.currentColumnId = targetColumnId;
    elements.taskForm.reset();
    
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('taskDate').value = now.toISOString().slice(0, 16);
    document.querySelector('input[name="priority"][value="media"]').checked = true;
    
    const modalContent = elements.taskModal.querySelector('.modal-content');
    modalContent.classList.remove('priority-baixa', 'priority-media', 'priority-alta');
    modalContent.classList.add('priority-media');
    
    elements.modalTitle.querySelector('span').textContent = 'Nova Tarefa';
    document.getElementById('new-task-description-group').style.display = 'block';
    document.querySelector('.modal-comments').style.display = 'none';
    elements.btnSolve.style.display = 'none';
    elements.btnUnsolve.style.display = 'none';
    elements.btnReturnToScale.style.display = 'none';
    elements.btnConfirm.style.display = 'inline-flex';
    
    populateAssigneeSelector(null);

    elements.taskModal.style.display = 'flex';
    document.getElementById('taskTitle').focus();
}

function openPrivateBoardModal() {
    const form = document.getElementById('privateBoardForm');
    if (form) {
        form.reset(); // Limpa o formulário antes de abrir
    }
    const modal = document.getElementById('privateBoardModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('boardTitle').focus(); // Foca no campo de título
    }
}

function closePrivateBoardModal() {
    const modal = document.getElementById('privateBoardModal');
    if (modal) {
        _performCloseAnimation(modal); // Reutiliza a animação de fechamento
    }
}

// abre o modal para editar um card existente
async function editCard(cardId) {
    const card = state.cards.find(c => c.id === cardId);
    if (!card) return;
    
    state.isModalDirty = false;
    state.editingCardId = cardId;
    elements.taskForm.reset();
    
    const priority = card.priority || 'media';
    document.querySelector(`input[name="priority"][value="${priority}"]`).checked = true;

    const modalContent = elements.taskModal.querySelector('.modal-content');
    modalContent.classList.remove('priority-baixa', 'priority-media', 'priority-alta');
    modalContent.classList.add(`priority-${priority}`);

    elements.modalTitle.querySelector('span').textContent = 'Editar Tarefa';
    document.getElementById('new-task-description-group').style.display = 'none';
    document.querySelector('.modal-comments').style.display = 'flex';
    elements.btnConfirm.style.display = 'none';
    
    const isArchived = card.column_id === state.solucionadoId || card.column_id === state.naoSolucionadoId;
    elements.btnSolve.style.display = isArchived ? 'none' : 'inline-flex';
    elements.btnUnsolve.style.display = isArchived ? 'none' : 'inline-flex';
    elements.btnReturnToScale.style.display = isArchived ? 'inline-flex' : 'none';
    
    document.getElementById('taskTitle').value = card.title;
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
    
    elements.taskModal.style.display = 'flex';
}

// salva as alterações do card (usado no auto-save)
async function saveCardChanges() {
    if (!state.editingCardId || !state.isModalDirty) return;

    try {
        await api(`/cards/${state.editingCardId}`, {
            method: 'PUT',
            body: JSON.stringify(getFormData())
        });
        state.isModalDirty = false;
    } catch (error) {
    }
}

// função de auto-save com debounce
const autoSave = debounce(saveCardChanges, 500);

// realiza a animação de fechamento do modal
function _performCloseAnimation(modalElement) {
    if (modalElement.style.display === 'flex' && !modalElement.classList.contains('closing')) {
        modalElement.classList.add('closing');
        setTimeout(() => {
            modalElement.style.display = 'none';
            modalElement.classList.remove('closing');
        }, 300);
    }
}

// fecha o modal da tarefa
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

// abre o modal da coluna
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

// fecha o modal da coluna
function closeColumnModal() {
    _performCloseAnimation(elements.columnModal);
    state.editingColumnId = null;
}

// lida com o submit do formulário de criação/edição de tarefa
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
        } else {
            showError('Erro ao criar tarefa');
        }
    } catch (error) {
        showError('Erro de conexão');
    }
}

// lida com o submit do formulário de criação/edição de coluna
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

// função para deletar um quadro
async function handleDeleteBoard(boardId, event) {
    event.stopPropagation();

    const boardTitle = state.privateBoards.find(b => b.id === boardId)?.title || "este quadro";
    if (!confirm(`Tem certeza que deseja excluir "${boardTitle}"?\n\nATENÇÃO: Todas as colunas e tarefas dentro deste quadro serão permanentemente excluídas.`)) {
        return;
    }

    try {
        const response = await api(`/boards/${boardId}`, {
            method: 'DELETE',
        });

        if (response?.ok) {
            const boardCardElement = document.querySelector(`.private-board-card[data-board-id="${boardId}"]`);
            if (boardCardElement) {
                boardCardElement.remove();
            }
            state.privateBoards = state.privateBoards.filter(b => b.id !== boardId);

        } else {
            const errorData = await response.json();
            showError(errorData.error || "Falha ao excluir o quadro.");
        }
    } catch (error) {
        showError("Erro de conexão ao tentar excluir o quadro.");
    }
}

// deleta um card
async function deleteCard(cardId) {
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;
    try {
        await api(`/cards/${cardId}`, { method: 'DELETE' });
    } catch (error) {
        showError('Erro ao excluir a tarefa');
    }
}

// move um card para outra coluna ou posição
async function moveCard(cardId, columnId, position = 0) {
    try {
        await api(`/cards/${cardId}/move`, {
            method: 'PUT',
            body: JSON.stringify({ column_id: columnId, position })
        });
    } catch (error) {
        showError('Erro ao mover a tarefa');
    }
}

// move um card para a coluna de solucionado ou não solucionado
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

// retorna um card arquivado para o quadro
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

// obtém o elemento após o qual o card arrastado deve ser inserido
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.task:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// lida com o evento de soltar um card
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
    if (oldColumnId === newColumnId && oldPosition < newPosition) {
        newPosition--;
    }

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

// conecta ao WebSocket para atualizações em tempo real
function connectWS() {
   
    state.ws?.close(); 
    
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    state.ws = new WebSocket(`${protocol}://${location.host}/ws/board/${state.board.id}`);
    
    state.ws.onmessage = async (e) => {
        const { type, payload } = JSON.parse(e.data);
        let needsFullRender = false;

        switch(type) {
            case 'BOARD_STATE_UPDATED':
                await loadData();
                renderColumns(); 
                needsFullRender = true;
                break;
            case 'CARD_CREATED':
                if (!state.cards.some(c => c.id === payload.id)) state.cards.push(payload);
                needsFullRender = true;
                break;
            case 'CARD_DELETED':
                state.cards = state.cards.filter(c => c.id !== payload.card_id);
                needsFullRender = true;
                break;
            case 'CARD_UPDATED':
                const index = state.cards.findIndex(c => c.id === payload.id);
                if (index > -1) state.cards[index] = { ...state.cards[index], ...payload };
                needsFullRender = true;
                break;
            case 'COLUMN_CREATED':
                 if (!state.columns.some(c => c.id === payload.id)) {
                    state.columns.push(payload);
                    state.columns.sort((a,b) => a.position - b.position);
                    renderColumns();
                
                 }
                break;
        }
        
        if(needsFullRender) {
            renderCards();
            updateStats();
        }
    };
    
    state.ws.onclose = () => {
        // Não tenta reconectar automaticamente para evitar loops indesejados
        console.log(`WebSocket para o board ${state.board.id} fechado.`);
    };

    state.ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        state.ws.close();
    };
}

// obtém os dados do formulário da tarefa
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

// atualiza as estatísticas gerais
function updateStats() {
    const completed = state.cards.filter(c => c.column_id === state.solucionadoId).length;
    const failed = state.cards.filter(c => c.column_id === state.naoSolucionadoId).length;
    const total = state.cards.length;
    const pending = total - completed - failed;

    document.getElementById('pendingTasks').textContent = pending;
    document.getElementById('completedTasks').textContent = completed;
    document.getElementById('failedTasks').textContent = failed;
}

// atualiza a contagem de cards em cada coluna
function updateColumnCounts() {
    state.columns.forEach(column => {
        const colElement = document.querySelector(`.column[data-column-id="${column.id}"]`);
        if (colElement) {
            const count = state.cards.filter(c => c.column_id == column.id).length;
            const countElement = colElement.querySelector('.column-count');
            if(countElement) countElement.textContent = count;
        }
    });
}

// exibe uma mensagem de erro
function showError(message) {
    const errorDiv = document.getElementById('loginError');
    if (errorDiv && elements.loginSection.style.display !== 'none') {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    } else {
        alert(`Erro: ${message}`);
    }
}

// renderiza os comentários de um card
function renderComments(descJson) {
    clearComments();
    if (!descJson) return;
    try {
        const desc = JSON.parse(descJson);
        ['observacoes', 'tentativas', 'resolucao'].forEach(section => {
            const container = document.getElementById(`${section}-comments`);
            if (desc[section]?.length && container) {
                desc[section].forEach(comment => {
                    container.appendChild(createCommentElement(comment));
                });
            }
        });
    } catch (e) { }
}

// cria um elemento HTML para um comentário
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
            <span class="comment-author">
                ${authorAvatarElement.outerHTML}
                ${authorName}
            </span>
            <span class="comment-timestamp">${time}</span>
        </div>
        <div class="comment-item-actions">
            <button class="edit-comment-btn" onclick="editComment(this)"><i class="fas fa-pencil-alt"></i></button>
            <button class="delete-comment-btn" onclick="deleteComment(this)"><i class="fas fa-trash"></i></button>
        </div>
    `;
    return div;
}

// obtém os comentários de uma seção específica
function getComments(sectionId) {
    const section = document.getElementById(sectionId);
    return Array.from(section?.querySelectorAll('.comment-item') || []).map(item => ({
        text: item.querySelector('.comment-content').textContent,
        author: item.dataset.author,
        timestamp: item.querySelector('.comment-timestamp')?.textContent || new Date().toLocaleString('pt-BR')
    }));
}

// limpa a área de comentários no modal
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

// preenche o filtro de usuário no modal de estatísticas
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

// atualiza a visualização no modal de estatísticas
function updateStatsView() {
    const status = elements.statsModal.dataset.status;
    const selectedUser = elements.statsFilterUser.value;
    const body = document.getElementById('statsModalBody');
    const totalElement = document.getElementById('statsTotalCount');

    const isSolucionado = status === 'solucionado';
    const isPendente = status === 'pendente';
    const isNaoSolucionado = status === 'nao-solucionado';

    let cards;
    if (isPendente) {
        cards = state.cards.filter(c => c.column_id !== state.solucionadoId && c.column_id !== state.naoSolucionadoId);
    } else {
        const targetColId = isSolucionado ? state.solucionadoId : state.naoSolucionadoId;
        cards = state.cards.filter(c => c.column_id === targetColId);
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
                    <div class="task-meta">
                        <div class="task-assignee">${avatarHTML} ${assigneeDisplayName}</div>
                    </div>
                </div>
            `;
        }).join('');
}

// abre o modal de estatísticas
function openStatsModal(status) {
    const title = document.getElementById('statsModalTitle');
    elements.statsModal.dataset.status = status;
    const isSolucionado = status === 'solucionado';
    const isNaoSolucionado = status === 'nao-solucionado';
    title.innerHTML = isSolucionado
        ? '<i class="fas fa-check-circle"></i> Tarefas Solucionadas'
        : isNaoSolucionado
            ? '<i class="fas fa-times-circle"></i> Tarefas Não Solucionadas'
            : '<i class="fa-solid fa-spinner"></i> Tarefas Pendentes';
    
    populateStatsUserFilter();
    updateStatsView();
    elements.statsModal.style.display = 'flex';
}

// fecha o modal de estatísticas
function closeStatsModal() {
    _performCloseAnimation(elements.statsModal);
}

// lida com o upload de avatar do usuário
async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    elements.loader.style.display = 'flex';
    const formData = new FormData();
    formData.append('avatar', file);

    try {
        const response = await api('/user/avatar', {
            method: 'POST',
            body: formData,
        });

        if (response?.ok) {
            const result = await response.json();
            const userIndex = state.users.findIndex(u => u.id === state.user.id);
            if(userIndex > -1) {
                state.users[userIndex].avatar = result.avatar_url;
            }
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


// funções globais para serem chamadas pelo HTML
window.openModal = openModal;
window.openStatsModal = openStatsModal;
window.closeModal = closeModal;
window.closeStatsModal = closeStatsModal;
window.openColumnModal = openColumnModal;
window.closeColumnModal = closeColumnModal;
window.deleteColumn = deleteColumn; 

// função global para alternar a visibilidade do input de comentário
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

// função global para salvar um novo comentário
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

// função global para cancelar a adição de um comentário
window.cancelComment = section => {
    const input = document.getElementById(`${section}-input`);
    input.style.display = 'none';
    input.querySelector('textarea').value = '';
};

// função global para deletar um comentário
window.deleteComment = button => {
    if (confirm('Excluir este comentário?')) {
        button.closest('.comment-item').remove();
        handleFormInput();
    }
};

// função global para editar um comentário existente
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
        </div>
    `;

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