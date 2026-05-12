import { Server } from 'socket.io';

let io;

export const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL,
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        },
    });

    io.on('connection', (socket) => {
        console.log('user connected:', socket.id);

        socket.on('disconnect', () => {
            console.log('user disconnected:', socket.id);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) throw new Error('Socket.IO has not been initialized');
    return io;
};
