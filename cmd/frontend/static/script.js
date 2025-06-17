let currentUser = null;
let currentBoard = null;
let columns = [];
let cards = [];
let editingCardId = null;
let currentColumnIdForNewCard = null;
let currentCommentSection = null;

const API_BASE = '/api';
let columnMapping = {};
let solucionadoColumnId = null;
let naoSolucionadoColumnId = null;

// Hardcoded users as per main.go, since there's no API endpoint to fetch them.
const KANBAN_USERS = [
    { username: 'admin', avatar: 'fas fa-user-shield' },
    { username: 'eduardo', avatar: 'fas fa-user' },
    { username: 'marques', avatar: 'fas fa-user' },
    { username: 'rosa', avatar: 'fas fa-user' },
    { username: 'miyake', avatar: 'fas fa-user' },
    { username: 'gomes', avatar: 'fas fa-user' },
    { username: 'pedro', avatar: 'fas fa-user' },
    { username: 'rodrigo', avatar: 'fas fa-user' },
    { username: 'rubens', avatar: 'fas fa-user' },
    { username: 'N/A', avatar: 'fas fa-user-slash'}
];

document.addEventListener('DOMContentLoaded', function() {
    checkAuthAndInitialize();
});

//--- AUTH LOGIC ---//
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

function showLoginForm() {
    document.getElementById('kanbanSection').style.display = 'none';
    document.getElementById('loginSection').style.display = 'flex';
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

//--- BOARD & DATA LOGIC ---//
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

    columnMapping = {};
    solucionadoColumnId = null;
    naoSolucionadoColumnId = null;

    columns.forEach(col => {
        const columnTitle = col.title.trim();
        if (columnTitle === 'Solucionado') {
            solucionadoColumnId = col.id;
        } else if (columnTitle === 'Não Solucionado') {
            naoSolucionadoColumnId = col.id;
        }
        
        const columnEl = [...document.querySelectorAll('.column-title')].find(ct => ct.textContent.trim().startsWith(columnTitle));
        if(columnEl) {
            const dataColumnAttr = columnEl.closest('.column').dataset.column;
            columnMapping[dataColumnAttr] = col.id;
        }
    });

    cards = [];
    for (const col of columns) {
        try {
            const cardsResponse = await fetch(`${API_BASE}/columns/${col.id}/cards`);
            if (cardsResponse.ok) {
                const columnCards = await cardsResponse.json();
                const mappedName = Object.keys(columnMapping).find(key => columnMapping[key] === col.id);
                if (Array.isArray(columnCards)) {
                    cards.push(...columnCards.map(card => ({ ...card, column_name: mappedName })));
                }
            }
        } catch (error) {
            console.error(`Erro ao carregar cards para a coluna ${col.id}:`, error);
        }
    }
}

//--- UI RENDERING ---//
function renderInterface() {
    renderCards();
    updateStats();
}

function renderCards() {
    document.querySelectorAll('.task-list').forEach(list => list.innerHTML = '');
    cards.forEach(card => {
        const columnKey = Object.keys(columnMapping).find(key => columnMapping[key] === card.column_id);
        if (columnKey) {
            card.column_name = columnKey;
            const cardElement = createCardElement(card);
            const columnElement = document.querySelector(`[data-column="${card.column_name}"] .task-list`);
            if (columnElement) {
                columnElement.appendChild(cardElement);
            }
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
    
    let displayDescription = "Nenhum comentário...";
    if (card.description) {
        try {
            const parsedDesc = JSON.parse(card.description);
            const firstObservation = parsedDesc.observacoes && parsedDesc.observacoes.length > 0 ? parsedDesc.observacoes[0] : null;
            if (firstObservation) {
                displayDescription = firstObservation;
            } else if(parsedDesc.tentativas && parsedDesc.tentativas.length > 0) {
                 displayDescription = parsedDesc.tentativas[0];
            }
        } catch (e) { 
            displayDescription = card.description;
        }
    }

    const user = KANBAN_USERS.find(u => u.username === (card.assigned_to || 'N/A'));
    const userAvatar = user ? user.avatar : 'fas fa-user';

    // CORREÇÃO: Removido o elemento que exibia o texto da prioridade para economizar espaço
    cardDiv.innerHTML = `
        <div class="task-actions">
            <button class="action-btn edit-btn" onclick="editCard(${card.id})"><i class="fas fa-edit"></i></button>
            <button class="action-btn delete-btn" onclick="deleteCard(${card.id})"><i class="fas fa-trash"></i></button>
        </div>
        <div class="task-header">
            <div class="task-title">${card.title}</div>
        </div>
        <div class="task-description">${displayDescription}</div>
        <div class="task-meta">
            <div class="task-assignee">
                <i class="${userAvatar}"></i> 
                ${(card.assigned_to || 'N/A').charAt(0).toUpperCase() + (card.assigned_to || 'N/A').slice(1)}
            </div>
            <div class="task-date">${card.due_date ? new Date(card.due_date).toLocaleDateString('pt-BR') : ''}</div>
        </div>
    `;
    cardDiv.classList.add(priorityClass);
    cardDiv.addEventListener('dragstart', dragStart);
    cardDiv.addEventListener('dragend', dragEnd);
    return cardDiv;
}

//--- MODAL LOGIC ---//
function populateAssigneeDropdown() {
    const select = document.getElementById('taskAssignee');
    select.innerHTML = '';
    KANBAN_USERS.forEach(user => {
        const option = document.createElement('option');
        option.value = user.username;
        option.textContent = user.username.charAt(0).toUpperCase() + user.username.slice(1);
        select.appendChild(option);
    });
}

function openModal(columnName) {
    currentColumnIdForNewCard = columnMapping[columnName];
    editingCardId = null;
    
    document.getElementById('taskForm').reset();
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-plus-circle"></i> Nova Tarefa';
    document.querySelector('.modal-content').className = 'modal-content priority-media';
    
    populateAssigneeDropdown();
    
    document.getElementById('new-task-description-group').style.display = 'block';
    document.querySelector('.modal-right').style.display = 'none'; 
    
    document.getElementById('btn-solve').style.display = 'none';
    document.getElementById('btn-unsolve').style.display = 'none';
    
    clearCommentsSection();
    document.getElementById('taskModal').style.display = 'flex';
}

function editCard(cardId) {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    editingCardId = cardId;
    
    document.getElementById('taskForm').reset();
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Tarefa';

    populateAssigneeDropdown();
    
    document.getElementById('new-task-description-group').style.display = 'none';
    document.querySelector('.modal-right').style.display = 'block';
    
    document.getElementById('btn-solve').style.display = 'inline-block';
    document.getElementById('btn-unsolve').style.display = 'inline-block';

    document.getElementById('taskTitle').value = card.title;
    document.getElementById('taskAssignee').value = card.assigned_to || 'N/A';
    document.getElementById('taskDate').value = card.due_date ? card.due_date.split('T')[0] : '';
    document.querySelector(`input[name="priority"][value="${card.priority || 'media'}"]`).checked = true;

    loadCommentsFromCard(card);
    
    updateModalPriorityBorder();
    document.getElementById('taskModal').style.display = 'flex';
}

function loadCommentsFromCard(card) {
    clearCommentsSection();
    
    try {
        const desc = JSON.parse(card.description);
        if (desc.observacoes && Array.isArray(desc.observacoes)) {
            desc.observacoes.forEach(comment => { if (comment.trim()) addCommentToSection('observacoes', comment); });
        }
        if (desc.tentativas && Array.isArray(desc.tentativas)) {
            desc.tentativas.forEach(comment => { if (comment.trim()) addCommentToSection('tentativas', comment); });
        }
        if (desc.resolucao && Array.isArray(desc.resolucao)) {
            desc.resolucao.forEach(comment => { if (comment.trim()) addCommentToSection('resolucao', comment); });
        }
    } catch (e) {
        if (card.description && card.description.trim()) {
            addCommentToSection('observacoes', card.description);
        }
    }
}

function clearCommentsSection() {
    document.getElementById('observacoes-comments').innerHTML = '';
    document.getElementById('tentativas-comments').innerHTML = '';
    document.getElementById('resolucao-comments').innerHTML = '';
}

function addCommentToSection(section, commentText) {
    const commentsContainer = document.getElementById(`${section}-comments`);
    const commentDiv = document.createElement('div');
    commentDiv.className = 'comment-item';
    commentDiv.innerHTML = `
        <div class="comment-content">${commentText}</div>
        <button class="comment-delete-btn" onclick="deleteComment(this)">
            <i class="fas fa-trash"></i>
        </button>
    `;
    commentsContainer.appendChild(commentDiv);
}

function deleteComment(button) {
    if (confirm('Deseja excluir este comentário?')) {
        button.closest('.comment-item').remove();
    }
}

function addComment(section) {
    currentCommentSection = section;
    document.getElementById('commentModalTitle').textContent = `Adicionar Comentário - ${getSectionTitle(section)}`;
    document.getElementById('commentText').value = '';
    document.getElementById('commentModal').style.display = 'flex';
}

function getSectionTitle(section) {
    switch(section) {
        case 'observacoes': return 'Observações';
        case 'tentativas': return 'Tentativas de Contato';
        case 'resolucao': return 'Resolução';
        default: return 'Comentário';
    }
}

function closeModal() {
    document.getElementById('taskModal').style.display = 'none';
}

function closeCommentModal() {
    document.getElementById('commentModal').style.display = 'none';
    currentCommentSection = null;
}

function updateModalPriorityBorder() {
    const priority = document.querySelector('input[name="priority"]:checked').value;
    const modalContent = document.querySelector('#taskModal .modal-content');
    modalContent.className = 'modal-content';
    modalContent.classList.add(`priority-${priority}`);
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const dateValue = formData.get('date');
    let description = '';

    if(editingCardId) {
        const observacoes = getCommentsFromSection('observacoes');
        const tentativas = getCommentsFromSection('tentativas');
        const resolucao = getCommentsFromSection('resolucao');
        
        description = JSON.stringify({
            observacoes: observacoes,
            tentativas: tentativas,
            resolucao: resolucao
        });
    } else {
        description = JSON.stringify({
            observacoes: [formData.get('description')],
            tentativas: [],
            resolucao: []
        });
    }

    const cardData = {
        title: formData.get('title'),
        description: description,
        assigned_to: formData.get('assignee'),
        priority: formData.get('priority'),
        due_date: dateValue ? new Date(dateValue).toISOString() : null,
    };

    const url = editingCardId ? `${API_BASE}/cards/${editingCardId}` : `${API_BASE}/columns/${currentColumnIdForNewCard}/cards`;
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

function getCommentsFromSection(section) {
    const container = document.getElementById(`${section}-comments`);
    return Array.from(container.querySelectorAll('.comment-item .comment-content'))
        .map(comment => comment.textContent.trim())
        .filter(text => text);
}

async function handleCommentSubmit(e) {
    e.preventDefault();
    const commentText = document.getElementById('commentText').value.trim();
    
    if (commentText && currentCommentSection) {
        addCommentToSection(currentCommentSection, commentText);
        closeCommentModal();
    }
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

async function moveCardToColumn(cardId, columnId) {
     if (!cardId || !columnId) {
        showError('Não é possível mover o card. Coluna de destino não encontrada.');
        return;
     }
     try {
        const response = await fetch(`${API_BASE}/cards/${cardId}/move`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ column_id: columnId, position: 0 }) 
        });
        if (response.ok) {
            closeModal();
            await loadBoardData();
            renderInterface();
        } else {
            showError('Erro ao mover tarefa. Verifique se a coluna de destino existe.');
        }
    } catch (error) {
        showError('Erro de conexão.');
    }
}

//--- DRAG & DROP LOGIC ---//
let draggedElement = null;

function dragStart(e) {
    draggedElement = e.target;
    setTimeout(() => e.target.classList.add('dragging'), 0);
}

function dragEnd(e) {
    e.target.classList.remove('dragging');
    draggedElement = null;
}

function allowDrop(e) {
    e.preventDefault();
}

function dragLeave(e) {
    const list = e.currentTarget;
    if(list.classList.contains('drag-over')){
        list.classList.remove('drag-over');
    }
}

async function drop(e) {
    e.preventDefault();
    const list = e.target.closest('.task-list');
    if (!list || !draggedElement) return;

    list.classList.remove('drag-over');
    
    const cardId = parseInt(draggedElement.dataset.cardId, 10);
    const newColumnName = list.closest('.column').dataset.column;
    const newColumnId = columnMapping[newColumnName];
    
    const card = cards.find(c => c.id === cardId);
    if (!card || card.column_id === newColumnId) {
        return;
    }

    const originalColumnId = card.column_id;
    card.column_id = newColumnId;
    renderCards(); 

    try {
        const response = await fetch(`${API_BASE}/cards/${cardId}/move`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ column_id: newColumnId, position: 0 })
        });

        if (!response.ok) {
            showError('Falha ao mover o card no servidor.');
            card.column_id = originalColumnId;
            renderCards();
        }
    } catch (error) {
        showError('Erro de conexão ao mover o card.');
        card.column_id = originalColumnId;
        renderCards();
    }
}

//--- UTILS & STATS ---//
function updateStats() {
    const completedTasksCount = solucionadoColumnId ? cards.filter(card => card.column_id === solucionadoColumnId).length : 0;
    const totalTasksCount = cards.length;
    const pendingTasksCount = totalTasksCount - completedTasksCount;

    document.getElementById('totalTasks').textContent = totalTasksCount;
    document.getElementById('pendingTasks').textContent = pendingTasksCount;
    document.getElementById('completedTasks').textContent = completedTasksCount;
}

function updateColumnCounts() {
    columns.forEach(col => {
        const columnKey = Object.keys(columnMapping).find(key => columnMapping[key] === col.id);
        if (columnKey) {
            const count = cards.filter(card => card.column_id === col.id).length;
            const countElement = document.querySelector(`[data-column="${columnKey}"] .column-count`);
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
    } else {
        alert(message);
    }
}

function addStaticEventListeners() {
    document.getElementById('taskForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('commentForm').addEventListener('submit', handleCommentSubmit);
    document.querySelector('.btn-logout')?.addEventListener('click', logout);
    
    document.querySelectorAll('input[name="priority"]').forEach(radio => {
        radio.addEventListener('change', updateModalPriorityBorder);
    });
    
    document.getElementById('btn-solve').addEventListener('click', () => {
        if (editingCardId && solucionadoColumnId) {
            moveCardToColumn(editingCardId, solucionadoColumnId);
        } else if (!solucionadoColumnId) {
            showError("A coluna 'Solucionado' não foi encontrada.");
        }
    });
    
    document.getElementById('btn-unsolve').addEventListener('click', () => {
        if (editingCardId && naoSolucionadoColumnId) {
            moveCardToColumn(editingCardId, naoSolucionadoColumnId);
        } else if (!naoSolucionadoColumnId) {
            showError("A coluna 'Não Solucionado' não foi encontrada.");
        }
    });

    document.querySelectorAll('.task-list').forEach(list => {
        list.addEventListener('dragleave', dragLeave);
        list.addEventListener('drop', drop);
        list.addEventListener('dragover', allowDrop);
        list.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.currentTarget.classList.add('drag-over');
        });
    });
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