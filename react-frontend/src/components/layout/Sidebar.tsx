import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react'; 
import toast from 'react-hot-toast';

import { useAuth } from '../../contexts/AuthContext';
import { useLayout } from '../../contexts/LayoutContext';
import { useNotifications } from '../../contexts/NotificationsContext';
import { useModal } from '../../contexts/ModalContext';
import { userDisplayNameMap, userRoleMap } from '../../api/config';
import * as authService from '../../services/auth';
import * as userService from '../../services/users';
import logo from '/img/nmlogo.png';
import { NotificationsDropdown } from './NotificationsDropdown';
import styles from './Sidebar.module.css';

export function Sidebar() {
  const { user, updateUser } = useAuth();
  const { isSidebarCollapsed, toggleSidebar, isMobileNavOpen, closeMobileNav } = useLayout();
  const { unreadCount, markAllAsRead } = useNotifications();
  const { openModal } = useModal();

  const [showNotifications, setShowNotifications] = useState(false);
  const avatarUploadRef = useRef<HTMLInputElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 992);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth <= 992);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []); 

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        if (showNotifications && unreadCount > 0) {
          markAllAsRead();
        }
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showNotifications, notificationsRef, unreadCount, markAllAsRead]);

  const handleLogout = async () => {
    await authService.signOut();
    navigate('/login');
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const loadingToast = toast.loading("Enviando avatar...");
    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const result = await userService.uploadAvatar(formData);
      if (user) {
        const updatedUser = {
          ...user,
          user_metadata: {
            ...user.user_metadata,
            avatar_url: `${result.avatar_url}?t=${new Date().getTime()}`
          }
        };
        updateUser(updatedUser);
        toast.success("Avatar atualizado!");
      }
    } catch (error) {
      toast.error("Falha no upload do avatar.");
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const handleNavLinkClick = () => {
      if (isMobileNavOpen) {
          closeMobileNav();
      }
  };

  const displayName = user?.email ? (userDisplayNameMap[user.email] || user.email) : 'Usuário';
  const userRole = user?.email ? (userRoleMap[user.email] || 'Colaborador') : 'Colaborador';
  const avatarInitial = displayName.charAt(0).toUpperCase();
  const avatarUrl = user?.user_metadata?.avatar_url;

  return (
    <div id="sidebar" className={`${styles.sidebar} ${isSidebarCollapsed ? styles.collapsed : ''} ${isMobileNavOpen ? styles['mobile-open'] : ''}`}>
      <div className={styles.sidebarHeader}>
        <div className={styles.sidebarHeaderTop}>
          {!isSidebarCollapsed && (
            <div className={styles.sidebarLogo}>
              <img src={logo} alt="Logo N-Multifibra" />
            </div>
          )}
        </div>
        <div className={styles.sidebarHeaderActions}>
          <div className={styles.notificationsBellContainer} ref={notificationsRef}>
            <button id="notificationsBell" className={styles.sidebarActionBtn} onClick={() => setShowNotifications(s => !s)}>
              <i className="fas fa-bell"></i>
              {unreadCount > 0 && <span className={styles.invitationsCount}>{unreadCount}</span>}
            </button>
            {showNotifications && <NotificationsDropdown />}
          </div>
          
          {!isMobileView && (
            <button id="toggleSidebar" className={styles.sidebarActionBtn} onClick={toggleSidebar} title={isSidebarCollapsed ? "Expandir" : "Recolher"}>
              {isSidebarCollapsed ? <i className="fas fa-chevron-right"></i> : <i className="fas fa-chevron-left"></i>}
            </button>
          )}

        </div>
      </div>

      <nav className={styles.sidebarNav}>
        <ul className={styles.navList}>
          <li title="Kanban"><NavLink to="/" onClick={handleNavLinkClick} className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}><i className="fas fa-headset"></i><span>Kanban</span></NavLink></li>
          <li title="Quadros Privados"><NavLink to="/private-boards" onClick={handleNavLinkClick} className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}><i className="fas fa-user-lock"></i><span>Quadros Privados</span></NavLink></li>
          <li title="Ligações Ativas"><NavLink to="/ligacoes" onClick={handleNavLinkClick} className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}><i className="fas fa-phone-volume"></i><span>Ligações Ativas</span></NavLink></li>
          <li title="Avaliações Negativas"><NavLink to="/avaliacoes" onClick={handleNavLinkClick} className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}><i className="fas fa-star-half-alt"></i><span>Avaliações Negativas</span></NavLink></li>
          <li title="Dashboard"><NavLink to="/dashboard" onClick={handleNavLinkClick} className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}><i className="fas fa-chart-line"></i><span>Dashboard</span></NavLink></li>
          <li title="Agenda Diária"><NavLink to="/agenda" onClick={handleNavLinkClick} className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}><i className="fas fa-calendar-day"></i><span>Agenda Diária</span></NavLink></li>
          <li title="Contatos Preventivos"><NavLink to="/contatos-preventivos" onClick={handleNavLinkClick} className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}><i className="fa-solid fa-house-signal"></i><span>Contatos Preventivos</span></NavLink></li>
        </ul>
      </nav>

      <div className={styles.sidebarCredits}>
        <button className={styles.creditsButton} onClick={() => { openModal('credits'); handleNavLinkClick(); }} title="Ver créditos do sistema">
          <i className="fas fa-info-circle"></i>
          <span>Créditos</span>
        </button>
      </div>

      <div className={styles.sidebarFooter}>
        <div className={styles.sidebarUser}>
          <div className={styles.avatarContainer} onClick={() => avatarUploadRef.current?.click()} title="Trocar foto">
            <div className={styles.userAvatar} style={{ backgroundImage: avatarUrl ? `url(${avatarUrl})` : 'none' }}>
              {!avatarUrl && avatarInitial}
            </div>
            <div className={styles.avatarUploadLabel}><i className="fas fa-camera"></i></div>
            <input ref={avatarUploadRef} type="file" onChange={handleAvatarChange} accept="image/png, image/jpeg, image/webp" style={{ display: 'none' }} />
          </div>
          {!isSidebarCollapsed && (
            <div className={styles.userInfo}>
              <div className={styles.userName}>{displayName}</div>
              <div className={styles.userRole}>{userRole}</div>
            </div>
          )}
        </div>
        <button className={styles.btnLogoutSidebar} onClick={handleLogout} title="Sair">
          <i className="fas fa-sign-out-alt"></i>
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
}