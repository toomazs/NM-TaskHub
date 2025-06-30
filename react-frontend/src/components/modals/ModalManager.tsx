import { useModal } from '../../contexts/ModalContext';
import { TaskModal } from './TaskModal';
import { PrivateBoardModal } from './PrivateBoardModal';
import { InviteUserModal } from './InviteUserModal';
import { ManageMembersModal } from './ManageMembersModal';
import { StatsModal } from './StatsModal';
import { ColumnModal } from './ColumnModal';
import { LigacaoModal } from './LigacaoModal';
import { AgendaEventModal } from './AgendaEventModal';
import { AvaliacaoModal } from './AvaliacaoModal';
import { ContatoModal } from './ContatoModal';
import { ContatoStatsModal } from './ContatoStatsModal';
import { CreditsModal } from './CreditsModal';

const modalComponents = {
    task: TaskModal,
    privateBoard: PrivateBoardModal,
    inviteUser: InviteUserModal,
    manageMembers: ManageMembersModal,
    stats: StatsModal,
    column: ColumnModal,
    ligacao: LigacaoModal,
    agendaEvent: AgendaEventModal,
    avaliacao: AvaliacaoModal,
    contato: ContatoModal,
    contatoStats: ContatoStatsModal,
    credits: CreditsModal,
};

export function ModalManager() {
    const { isModalOpen, modalType } = useModal();
    
    if (!isModalOpen || !modalType) {
        return null;
    }

    const SpecificModal = modalComponents[modalType];
    
    return SpecificModal ? <SpecificModal /> : null;
}