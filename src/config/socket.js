import { Server } from 'socket.io';

let io;

export const initSocket = (server) => {
    const allowedOrigins = [
        'https://biteyo-fe.vercel.app',
        'http://localhost:5173',
        process.env.CLIENT_URL,
        ...(process.env.CLIENT_URLS?.split(',') || []),
    ].filter(Boolean);

    io = new Server(server, {
        cors: {
            origin: allowedOrigins,
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
