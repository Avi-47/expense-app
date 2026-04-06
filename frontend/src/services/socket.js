import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:5000";

let socket;

export const connectSocket = (token) => {
  socket = io(SOCKET_URL, {
    auth: { token }
  });
  return socket;
};

export const getSocket = () => socket;