import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function useWebSocket(boardId: number | undefined, onMessage: (message: any) => void) {
  const ws = useRef<WebSocket | null>(null);
  const { user } = useAuth();

  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!boardId || !user) {
      return;
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const host = window.location.host; 
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";

    const wsUrl = isProduction 
      ? `${protocol}://${host}/ws/board/${boardId}`
      : `${protocol}://${window.location.hostname}:10000/ws/board/${boardId}`;
    
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => console.log(`[WebSocket] Conectado ao board ${boardId}`);
    
    ws.current.onmessage = (event) => {
      try {
        const messageData = JSON.parse(event.data);
        
        if (messageData.sender_id && messageData.sender_id === user.id) {
          return;
        }

        onMessageRef.current(messageData);

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
  }, [boardId, user]); 

}