import { z } from 'zod';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Validation schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required')
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  role: z.enum(['student', 'teacher'], 'Role must be either student or teacher')
});

export const questionSchema = z.object({
  text: z.string().min(1, 'Question text is required').max(500, 'Question too long'),
  sessionId: z.string().min(1, 'Session ID is required'),
  course: z.string().min(1, 'Course is required').max(100, 'Course name too long')
});

export const sessionSchema = z.object({
  courseName: z.string().min(1, 'Course name is required').max(50, 'Course name too long'),
  sessionDate: z.string().optional(),
  description: z.string().max(200, 'Description too long').optional()
});

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
    
    // Trigger socket reconnection with new auth if needed
    // Note: This creates a circular dependency if imported, so we handle it in auth hook
  }

  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getAuthHeaders(),
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Authentication methods
  async login(credentials) {
    loginSchema.parse(credentials);
    
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    this.setToken(data.token);
    return data;
  }

  async register(userData) {
    registerSchema.parse(userData);
    
    const data = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    // Don't set token on registration - user must login separately
    return data;
  }

  async logout() {
    try {
      await this.request('/api/auth/logout', {
        method: 'POST',
      });
    } finally {
      this.setToken(null);
    }
  }

  async getCurrentUser() {
    return this.request('/api/auth/me');
  }

  // Question methods
  async getQuestions(sessionId, filters = {}) {
    const params = new URLSearchParams(filters).toString();
    const query = params ? `?${params}` : '';
    return this.request(`/api/questions/session/${sessionId}${query}`);
  }

  async submitQuestion(questionData) {
    questionSchema.parse(questionData);
    
    return this.request('/api/questions', {
      method: 'POST',
      body: JSON.stringify(questionData),
    });
  }

  async updateQuestion(questionId, updates) {
    return this.request(`/api/questions/${questionId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteQuestion(questionId) {
    return this.request(`/api/questions/${questionId}`, {
      method: 'DELETE',
    });
  }

  async clearSession(sessionId) {
    return this.request(`/api/questions/session/${sessionId}/clear`, {
      method: 'DELETE',
    });
  }

  async getMyQuestions(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    const query = params ? `?${params}` : '';
    return this.request(`/api/questions/my-questions${query}`);
  }

  async reorderQuestion(questionId, displayOrder) {
    return this.request(`/api/questions/${questionId}/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ displayOrder }),
    });
  }

  // Session methods
  async createSession(sessionData) {
    sessionSchema.parse(sessionData);
    
    return this.request('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
  }

  async getMySessions(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    const query = params ? `?${params}` : '';
    return this.request(`/api/sessions/my-sessions${query}`);
  }

  async getActiveSessions(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    const query = params ? `?${params}` : '';
    return this.request(`/api/sessions/active${query}`);
  }

  async getSession(sessionId) {
    return this.request(`/api/sessions/${sessionId}`);
  }

  async updateSession(sessionId, updates) {
    return this.request(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async endSession(sessionId) {
    return this.request(`/api/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }

  async joinSession(sessionId) {
    return this.request(`/api/sessions/${sessionId}/join`, {
      method: 'POST',
    });
  }
}

// Create a singleton instance
const apiClient = new ApiClient();
export default apiClient;