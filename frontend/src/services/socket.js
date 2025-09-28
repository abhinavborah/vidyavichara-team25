import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
  }

  connect() {
    if (!this.socket) {
      const token = localStorage.getItem('token');
      
      this.socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001', {
        autoConnect: false,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        forceNew: false,
        // Enhanced error handling
        transports: ['polling', 'websocket'],
        upgrade: true,
        rememberUpgrade: false,
        // Add authentication
        auth: {
          token: token
        },
        // Add extra headers for polling transport
        extraHeaders: token ? {
          'Authorization': `Bearer ${token}`
        } : {}
      });

      this.socket.on('connect', () => {
        console.log('Connected to server');
        this.connected = true;
      });

      this.socket.on('disconnect', (reason, details) => {
        console.log('Disconnected from server:', reason);
        if (details) {
          console.log('Disconnect details:', details);
        }
        this.connected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        
        // Handle rate limiting errors specifically
        if (error.message && error.message.includes('Too many')) {
          console.warn('Rate limited - will retry connection automatically');
        }
        
        // Handle JSON parsing errors
        if (error.message && error.message.includes('Unexpected token')) {
          console.warn('Server response parsing error - likely rate limited');
        }
      });

      this.socket.on('error', (error) => {
        console.error('Socket error:', error);
      });
    }

    this.socket.connect();
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  // Force disconnect and reconnect with new token (useful for user changes)
  reconnectWithNewAuth() {
    this.disconnect();
    return this.connect();
  }

  joinSession(sessionId) {
    if (this.socket && this.connected) {
      this.socket.emit('joinSession', sessionId);
    }
  }

  leaveSession(sessionId) {
    if (this.socket && this.connected) {
      this.socket.emit('leaveSession', sessionId);
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  emit(event, data) {
    if (this.socket && this.connected) {
      this.socket.emit(event, data);
    }
  }
}

// Create a singleton instance
const socketService = new SocketService();
export default socketService;