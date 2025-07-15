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

const ComponentModal = () => {
    const { modalProps, closeModal } = useModal();

    return (
        <div className="modal-backdrop" onClick={closeModal}>
            <div className="modal-container" style={{maxWidth: 'fit-content'}} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{modalProps.title}</h3>
                    <button onClick={closeModal} className="modal-close-btn">&times;</button>
                </div>
                <div className="modal-body">
                    {modalProps.children}
                </div>
            </div>
        </div>
    );
};

export function ModalManager() {
    const { isModalOpen, modalType } = useModal();
    
    if (!isModalOpen || !modalType) {
        return null;
    }

    if (modalType === 'component') {
        return <ComponentModal />;
    }

    const SpecificModal = modalComponents[modalType];
    
    return SpecificModal ? <SpecificModal /> : null;
}