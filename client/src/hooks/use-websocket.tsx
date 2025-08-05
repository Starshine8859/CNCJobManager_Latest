import { useEffect, useRef, useCallback } from 'react';

export function useWebSocket(url: string, onMessage: (event: MessageEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const stableOnMessage = useCallback(onMessage, []);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}${url}`;

    const connect = () => {
      try {
        // Don't create a new connection if one already exists and is connecting/open
        if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
          return;
        }

        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          console.log('WebSocket connected');
          reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
        };

        socket.onmessage = stableOnMessage;

        socket.onclose = (event) => {
          console.log('WebSocket disconnected');
          wsRef.current = null;
          
          // Only attempt to reconnect if we haven't exceeded max attempts and it's not a normal closure
          if (reconnectAttemptsRef.current < maxReconnectAttempts && event.code !== 1000) {
            reconnectAttemptsRef.current++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000); // Exponential backoff, max 30s
            
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log(`Attempting to reconnect... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
              connect();
            }, delay);
          }
        };

        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting'); // Normal closure
        wsRef.current = null;
      }
    };
  }, [url, stableOnMessage]);

  return wsRef.current;
}
