import React, { createContext, useContext, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io({ autoConnect: false });

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