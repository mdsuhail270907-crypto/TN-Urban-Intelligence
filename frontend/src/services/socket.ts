import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const connectSocket = (token: string): Socket => {
  const socket = io(SOCKET_URL, {
    auth: {
      token: `Bearer ${token}`
    },
    transports: ['websocket']
  });

  return socket;
};
