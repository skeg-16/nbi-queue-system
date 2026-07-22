import React, { createContext, useContext, useEffect } from 'react';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || '';
const socket = io(API_URL, { autoConnect: false });

const SocketContext = createContext(socket);

export function SocketProvider({ children }) {
  useEffect(() => {
    socket.connect();
    return () => socket.disconnect();
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);