import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function useWebSocket(boardId: number | undefined, onMessage: (message: any) => void) {
  const ws = useRef<WebSocket | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!boardId || !user) {
      return;
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const host = window.location.host; 
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";

    const wsUrl = isProduction 
      ? `${protocol}://${host}/ws/board/${boardId}`
      : `${protocol}://${window.location.hostname}:8080/ws/board/${boardId}`;
    
    console.log("Conectando ao WebSocket em:", wsUrl);

    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => console.log(`[WebSocket] Conectado ao board ${boardId}`);
    
    ws.current.onmessage = (event) => {
      try {
        const messageData = JSON.parse(event.data);
        
        if (messageData.sender_id && messageData.sender_id === user.id) {
          return;
        }

        onMessage(messageData);
      } catch (error) {
        console.error("[WebSocket] Erro ao processar mensagem:", error);
      }
    };

    ws.current.onerror = (error) => console.error("[WebSocket] Erro:", error);
    ws.current.onclose = () => console.log(`[WebSocket] Desconectado do board ${boardId}`);

    return () => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current?.close();
      }
    };
  }, [boardId, user, onMessage]); 
}