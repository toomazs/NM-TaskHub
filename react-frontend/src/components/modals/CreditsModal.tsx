import React, { useState, useEffect } from 'react';
import { useModal } from '../../contexts/ModalContext';
import styles from './CreditsModal.module.css';

// URLs das fotos do Supabase Storage
const eduardoAvatarUrl = 'https://lzjunqtkldknjynsyhbi.supabase.co/storage/v1/object/public/avatars//avatar-f98781df-6981-4485-b2b9-a373779dc9e5.jpeg'; 
const gabrielAvatarUrl = 'https://lzjunqtkldknjynsyhbi.supabase.co/storage/v1/object/public/avatars//avatar-4b4cba12-a780-40f8-bd34-2d0ce89725ce.png';

interface Developer {
  name: string;
  role: string;
  description: string;
  avatarUrl: string;
  skills: string[];
  githubUrl?: string;
  linkedinUrl?: string;
}

const developers: Developer[] = [
  {
    name: 'Eduardo Tomaz',
    role: 'Desenvolvedor Principal Full Stack',
    description: 'Arquiteto e idealizador da aplicação, foi o responsável pelo ciclo de desenvolvimento completo. Suas atribuições abrangeram desde a modelagem e programação do backend e frontend, até a orquestração e manutenção da infraestrutura inteira em nuvem.',
    avatarUrl: eduardoAvatarUrl,
    skills: ['Java', 'Spring', 'Golang', 'React', 'TypeScript', 'SQL'],
    githubUrl: 'https://github.com/toomazs',
    linkedinUrl: 'https://www.linkedin.com/in/eduardotoomazs/'
  },
  {
    name: 'Gabriel Marques',
    role: 'Analista de Suporte e Processos',
    description: 'Responsável pela especificação de requisitos, análise de processos e pela validação completa de todas as funcionalidades do sistema. Adicionalmente, liderou o desenvolvimento e criou a API de Sinais Atenuados.',
    avatarUrl: gabrielAvatarUrl,
    skills: ['Gestão de Pessoas', 'Designer UX/UI', 'QA Tester', 'Automações'],
    githubUrl: 'https://github.com/GabrielMarques011',
    linkedinUrl: 'https://www.linkedin.com/in/gabriel-marques-6bb222174/'
  }
];

const projectStats = {
  tempoDeDesenvolvimento: '1 mês',
  bibliotecasUsadas: '+ 15 libs',
  tabelasDoDatabase: '12',
  linhasDeCódigo: '+6,000'
};

export function CreditsModal() {
  const { closeModal, isClosing } = useModal();
  const [currentStatIndex, setCurrentStatIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState<{[key: string]: boolean}>({});

  const statEntries = Object.entries(projectStats);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStatIndex((prev) => (prev + 1) % statEntries.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [statEntries.length]);

  const handleImageError = (developerName: string) => {
    setImageErrors(prev => ({ ...prev, [developerName]: true }));
  };

  const copyRepoLink = () => {
    navigator.clipboard.writeText('https://github.com/toomazs/NM-TaskHub');
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className={`${styles.modal} ${isClosing ? styles.closing : ''}`} onClick={closeModal}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        <button className={styles.modalClose} onClick={closeModal}>
          <i className="fas fa-times"></i>
        </button>
        
        <div className={styles.modalHeader}>
          <h2>
            <i className="fas fa-star"></i> 
            Créditos do Projeto
          </h2>
        </div>
        
        <div className={styles.modalBody}>
          <div className={styles.creditsContainer}>
            
            <div className={styles.developersSection}>
              <h3 className={styles.sectionTitle}>
                <i className="fas fa-users"></i>
                Equipe de Desenvolvimento
              </h3>
              
              {developers.map((developer, index) => (
                <div key={index} className={styles.developerCard}>
                  <div className={styles.developerPhotoContainer}>
                    {imageErrors[developer.name] ? (
                      <div className={styles.avatarFallback}>
                        {getInitials(developer.name)}
                      </div>
                    ) : (
                      <img 
                        src={developer.avatarUrl} 
                        alt={`Foto de ${developer.name}`} 
                        className={styles.developerPhoto}
                        onError={() => handleImageError(developer.name)}
                      />
                    )}
                    <div className={styles.photoOverlay}>
                      <div className={styles.socialLinks}>
                        {developer.githubUrl && (
                          <a href={developer.githubUrl} target="_blank" rel="noopener noreferrer">
                            <i className="fab fa-github"></i>
                          </a>
                        )}
                        {developer.linkedinUrl && (
                          <a href={developer.linkedinUrl} target="_blank" rel="noopener noreferrer">
                            <i className="fab fa-linkedin"></i>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className={styles.developerInfo}>
                    <h4 className={styles.developerName}>{developer.name}</h4>
                    <p className={styles.developerRole}>{developer.role}</p>
                    <p className={styles.developerDescription}>{developer.description}</p>
                    
                    <div className={styles.skillsContainer}>
                      {developer.skills.map((skill, skillIndex) => (
                        <span key={skillIndex} className={styles.skillTag}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>

          <div className={styles.modalFooter}>
            <div className={styles.versionInfo}>
              NM TaskHub <span>v2.0</span>
            </div>
            <p className={styles.techStack}>
              Golang | GoFiber | Supabase | React | TypeScript | Vite 
            </p>
            
            <div className={styles.footerActions}>
              <a 
                href="https://github.com/toomazs/NM-TaskHub" 
                target="_blank" 
                rel="noopener noreferrer" 
                className={styles.repoLink}
              >
                <i className="fab fa-github"></i>
                Ver Repositório
              </a>
            
            </div>
            
            <div className={styles.buildInfo}>
              <span className={styles.buildDate}>
                <i className="fas fa-calendar"></i>
                Build Atual: {new Date().toLocaleDateString('pt-BR')}
              </span>
              <span className={styles.buildStatus}>
                <i className="fas fa-check-circle"></i>
                Estável
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}