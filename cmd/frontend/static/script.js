let currentUser = null;
let currentBoard = null;
let columns = [];
let cards = [];
let editingCardId = null;
let currentColumnId = null;

const API_BASE = '/api';
let columnMapping = {};

document.addEventListener('DOMContentLoaded', function() {
    checkAuthAndInitialize();
});



// check auth
async function checkAuthAndInitialize() {
    try {
        const response = await fetch(`${API_BASE}/boards`);
        if (response.ok) {
            let boards = await response.json();
            if (boards.length === 0) {
                currentBoard = await createDefaultBoard();
                if (!currentBoard) {
                    showLoginForm();
                    return;
                }
            } else {
                currentBoard = boards[0];
            }
            
            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('kanbanSection').style.display = 'block';
            await initializeApp();
        } else {
            showLoginForm();
        }
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        showLoginForm();
    }
}


// logica de login e logout
function showLoginForm() {
    document.getElementById('kanbanSection').style.display = 'none';
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const loginData = Object.fromEntries(formData.entries());

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(loginData)
        });

        if (response.ok) {
            window.location.reload();
        } else {
            const data = await response.json();
            showError(data.error || 'Erro no login');
        }
    } catch (error) {
        console.error('Erro na requisição de login:', error);
        showError('Erro de conexão.');
    }
}

async function logout() {
    try {
        await fetch(`${API_BASE}/logout`, { method: 'POST' });
        window.location.reload();
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
    }
}



// logica board
async function createDefaultBoard() {
    const boardData = { title: 'Suporte N-MULTIFIBRA', description: 'Board principal' };
    const response = await fetch(`${API_BASE}/boards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(boardData)
    });
    if (response.ok) {
        return await response.json();
    }
    throw new Error('Não foi possível criar o board padrão.');
}

async function loadBoardData() {
    const columnsResponse = await fetch(`${API_BASE}/boards/${currentBoard.id}/columns`);
    columns = await columnsResponse.json();

    const columnNames = ['validacoes', 'escallo', 'casos-suporte', 'upgrades-retencao', 'reagendamentos'];
    columns.forEach((col, index) => {
        if (columnNames[index]) {
            columnMapping[columnNames[index]] = col.id;
        }
    });

    cards = [];
    for (const col of columns) {
        const cardsResponse = await fetch(`${API_BASE}/columns/${col.id}/cards`);
        if (cardsResponse.ok) {
            const columnCards = await cardsResponse.json();
            const mappedName = Object.keys(columnMapping).find(key => columnMapping[key] === col.id);
            cards.push(...columnCards.map(card => ({ ...card, column_name: mappedName })));
        }
    }
}



// logica cards
function renderInterface() {
    renderCards();
    updateStats();
}

function renderCards() {
    document.querySelectorAll('.task-list').forEach(list => list.innerHTML = '');
    cards.forEach(card => {
        const cardElement = createCardElement(card);
        const columnElement = document.querySelector(`[data-column="${card.column_name}"] .task-list`);
        if (columnElement) {
            columnElement.appendChild(cardElement);
        }
    });
    updateColumnCounts();
}

function createCardElement(card) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'task';
    cardDiv.draggable = true;
    cardDiv.dataset.cardId = card.id;

    const priorityClass = `priority-${card.priority || 'media'}`;
    const priorityText = (card.priority || 'media').charAt(0).toUpperCase() + (card.priority || 'media').slice(1);

    cardDiv.innerHTML = `
        <div class="task-actions">
            <button class="action-btn edit-btn" onclick="editCard(${card.id})"><i class="fas fa-edit"></i></button>
            <button class="action-btn delete-btn" onclick="deleteCard(${card.id})"><i class="fas fa-trash"></i></button>
        </div>
        <div class="task-header">
            <div class="task-title">${card.title}</div>
            <div class="task-priority ${priorityClass}">${priorityText}</div>
        </div>
        <div class="task-description">${card.description || ''}</div>
        <div class="task-meta">
            <div class="task-assignee"><i class="fas fa-user"></i> ${card.assigned_to || 'N/A'}</div>
            <div class="task-date">${card.due_date ? new Date(card.due_date).toLocaleDateString('pt-BR') : ''}</div>
        </div>
    `;
    cardDiv.addEventListener('dragstart', dragStart);
    cardDiv.addEventListener('dragend', dragEnd);
    return cardDiv;
}



// logica modals
function openModal(columnName) {
    currentColumnId = columnMapping[columnName];
    editingCardId = null;
    document.getElementById('modalTitle').textContent = 'Nova Tarefa';
    document.getElementById('taskForm').reset();
    document.getElementById('taskModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('taskModal').style.display = 'none';
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const dateValue = formData.get('date');
    const cardData = {
        title: formData.get('title'),
        description: formData.get('description'),
        assigned_to: formData.get('assignee'),
        priority: formData.get('priority'),
        due_date: dateValue ? new Date(dateValue).toISOString() : null,
    };

    const url = editingCardId ? `${API_BASE}/cards/${editingCardId}` : `${API_BASE}/columns/${currentColumnId}/cards`;
    const method = editingCardId ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cardData)
        });
        if (response.ok) {
            closeModal();
            await loadBoardData();
            renderInterface();
        } else {
            showError('Erro ao salvar tarefa.');
        }
    } catch (error) {
        console.error('Erro ao salvar card:', error);
        showError('Erro de conexão.');
    }
}



// logica editar card e deletar card
function editCard(cardId) {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    editingCardId = cardId;
    currentColumnId = card.column_id;

    document.getElementById('modalTitle').textContent = 'Editar Tarefa';
    document.getElementById('taskTitle').value = card.title;
    document.getElementById('taskDescription').value = card.description;
    document.getElementById('taskAssignee').value = card.assigned_to || '';
    document.getElementById('taskPriority').value = card.priority || 'media';
    document.getElementById('taskDate').value = card.due_date ? card.due_date.split('T')[0] : '';
    document.getElementById('taskModal').style.display = 'block';
}

async function deleteCard(cardId) {
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;
    try {
        const response = await fetch(`${API_BASE}/cards/${cardId}`, { method: 'DELETE' });
        if (response.ok) {
            await loadBoardData();
            renderInterface();
        } else {
            showError('Erro ao excluir tarefa.');
        }
    } catch (error) {
        showError('Erro de conexão.');
    }
}



// logica drag and drop
let draggedElement = null;

function dragStart(e) {
    draggedElement = e.target;
    e.target.classList.add('dragging');
}

function dragEnd(e) {
    e.target.classList.remove('dragging');
    draggedElement = null;
}

function allowDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

async function drop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    if (draggedElement) {
        const cardId = parseInt(draggedElement.dataset.cardId);
        const newColumnName = e.target.closest('.column').dataset.column;
        const newColumnId = columnMapping[newColumnName];

        try {
            const response = await fetch(`${API_BASE}/cards/${cardId}/move`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ column_id: newColumnId, position: 0 }) 
            });
            if (response.ok) {
                await loadBoardData();
                renderInterface();
            } else {
                showError('Erro ao mover tarefa.');
            }
        } catch (error) {
            showError('Erro de conexão.');
        }
    }
}


// bla bla o resto 
function updateStats() {
    const totalTasks = cards.length;
    // logica baseada no nome da coluna xd
    const completedColumn = columns.find(col => col.title.toLowerCase().includes('concluíd') || col.title.toLowerCase().includes('feito'));
    const completedTasks = completedColumn ? cards.filter(card => card.column_id === completedColumn.id).length : 0;
    const pendingTasks = totalTasks - completedTasks;

    document.getElementById('totalTasks').textContent = totalTasks;
    document.getElementById('pendingTasks').textContent = pendingTasks;
    document.getElementById('completedTasks').textContent = completedTasks;
}

function updateColumnCounts() {
    columns.forEach(column => {
        const count = cards.filter(card => card.column_id === column.id).length;
        const mappedName = Object.keys(columnMapping).find(key => columnMapping[key] === column.id);
        if (mappedName) {
            const countElement = document.querySelector(`[data-column="${mappedName}"] .column-count`);
            if (countElement) {
                countElement.textContent = count;
            }
        }
    });
}

function showError(message) {
    const errorDiv = document.getElementById('loginError');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => { errorDiv.style.display = 'none'; }, 3000);
    }
}

function addStaticEventListeners() {
    document.getElementById('taskForm').addEventListener('submit', handleFormSubmit);
    const logoutButton = document.querySelector('.btn-logout');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }
}

async function initializeApp() {
    if (!currentBoard) {
        console.error("Nenhum board selecionado para inicializar.");
        return;
    }
    await loadBoardData();
    renderInterface();
    addStaticEventListeners();
}