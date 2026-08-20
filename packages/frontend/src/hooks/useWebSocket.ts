import { useCallback, useEffect, useRef, useState } from 'react';
import { getAccessToken } from '../services/api';
import { useAuth } from './useAuth';
import type { WSEvent } from '../types';

export type WebSocketStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'failed';

export interface UseWebSocketOptions {
  enabled?: boolean;
  onEvent?: (event: WSEvent) => void;
  onReconnect?: () => void;
}

export interface UseWebSocketResult {
  status: WebSocketStatus;
  attempt: number;
  error: string | null;
  retry: () => void;
  send: (type: string, payload?: unknown) => boolean;
}

const RECONNECT_DELAY = 5000;
const MAX_RECONNECT_ATTEMPTS = 5;

function webSocketUrl(token: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
}

export default function useWebSocket({ enabled = true, onEvent, onReconnect }: UseWebSocketOptions = {}): UseWebSocketResult {
  const { accessToken, refresh } = useAuth();
  const socketRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const attemptRef = useRef(0);
  const wasConnectedRef = useRef(false);
  const onEventRef = useRef(onEvent);
  const onReconnectRef = useRef(onReconnect);
  const refreshRef = useRef(refresh);
  const accessTokenRef = useRef(accessToken);
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  onEventRef.current = onEvent;
  onReconnectRef.current = onReconnect;
  refreshRef.current = refresh;
  accessTokenRef.current = accessToken;

  const connect = useCallback(async (isReconnect: boolean) => {
    if (cancelledRef.current || !enabled) return;
    let token = getAccessToken() ?? accessTokenRef.current;
    if (!token) {
      setStatus('disconnected');
      return;
    }

    if (isReconnect) {
      try {
        await refreshRef.current();
        token = getAccessToken() ?? token;
      } catch {
        if (!cancelledRef.current) setError('Sessão expirada. Faça login novamente.');
        return;
      }
    }

    if (cancelledRef.current || !token) return;
    setStatus(isReconnect ? 'reconnecting' : 'connecting');
    const socket = new WebSocket(webSocketUrl(token));
    socketRef.current = socket;
    socket.onopen = () => {
      if (cancelledRef.current) return;
      const reconnected = wasConnectedRef.current;
      wasConnectedRef.current = true;
      attemptRef.current = 0;
      setAttempt(0);
      setError(null);
      setStatus('connected');
      if (reconnected) onReconnectRef.current?.();
    };
    socket.onmessage = (event) => {
      try {
        onEventRef.current?.(JSON.parse(event.data) as WSEvent);
      } catch {
        setError('Resposta WebSocket inválida.');
      }
    };
    socket.onerror = () => setError('Não foi possível conectar ao servidor em tempo real.');
    socket.onclose = () => {
      if (cancelledRef.current) return;
      if (socketRef.current !== socket) return;
      socketRef.current = null;
      const nextAttempt = attemptRef.current + 1;
      attemptRef.current = nextAttempt;
      setAttempt(nextAttempt);
      if (nextAttempt > MAX_RECONNECT_ATTEMPTS) {
        setStatus('failed');
        return;
      }
      setStatus('reconnecting');
      timerRef.current = window.setTimeout(() => { void connect(true); }, RECONNECT_DELAY);
    };
  }, [enabled]);

  useEffect(() => {
    cancelledRef.current = false;
    if (enabled) void connect(false);
    return () => {
      cancelledRef.current = true;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [connect, enabled]);

  const retry = useCallback(() => {
    if (!enabled) return;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    socketRef.current?.close();
    attemptRef.current = 0;
    setAttempt(0);
    setError(null);
    void connect(false);
  }, [connect, enabled]);

  const send = useCallback((type: string, payload?: unknown): boolean => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ type, payload }));
    return true;
  }, []);

  return { status, attempt, error, retry, send };
}
