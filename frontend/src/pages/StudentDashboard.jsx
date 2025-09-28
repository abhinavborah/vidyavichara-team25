import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/theme-toggle';
import { StickyNote } from '@/components/StickyNote';
import { StudentSessionManager } from '@/components/StudentSessionManager';
import { useAuth } from '@/hooks/useAuth';
import apiClient from '@/services/api';
import socketService from '@/services/socket';

export function StudentDashboard() {
    const { user, logout } = useAuth();
    const [questions, setQuestions] = useState([]);
    const [newQuestion, setNewQuestion] = useState('');
    const [currentSession, setCurrentSession] = useState(() => {
        // Restore session from sessionStorage if user is authenticated
        if (user) {
            const savedSession = sessionStorage.getItem('currentStudentSession');
            return savedSession ? JSON.parse(savedSession) : null;
        }
        return null;
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isConnected, setIsConnected] = useState(false);

    // Reset dashboard state when user changes (new login)
    useEffect(() => {
        if (!user) {
            // User logged out, clear everything
            setQuestions([]);
            setNewQuestion('');
            setCurrentSession(null);
            setError('');
            // Clear persisted session data
            sessionStorage.removeItem('currentStudentSession');
        } else {
            // User is authenticated, try to restore session
            const savedSession = sessionStorage.getItem('currentStudentSession');
            if (savedSession && !currentSession) {
                try {
                    const parsedSession = JSON.parse(savedSession);
                    setCurrentSession(parsedSession);
                } catch (error) {
                    console.error('Failed to restore session from storage:', error);
                    sessionStorage.removeItem('currentStudentSession');
                }
            }
        }
    }, [user, currentSession]);

    // Socket connection and event handlers
    useEffect(() => {
        const socket = socketService.connect();

        socket.on('connect', () => {
            setIsConnected(true);
            if (currentSession) {
                socketService.joinSession(currentSession.sessionId);
            }
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
        });

        socket.on('newQuestion', (data) => {
            // Only add questions from the current session
            if (currentSession && data.question.sessionId === currentSession.sessionId) {
                setQuestions(prev => [data.question, ...prev]);
            }
        });

        socket.on('questionUpdated', (data) => {
            // Only update questions from the current session
            if (currentSession && data.question.sessionId === currentSession.sessionId) {
                setQuestions(prev =>
                    prev.map(q => q._id === data.question._id ? data.question : q)
                );
            }
        });

        socket.on('questionDeleted', (data) => {
            // Only remove questions from the current session
            if (currentSession && data.sessionId === currentSession.sessionId) {
                setQuestions(prev => prev.filter(q => q._id !== data.questionId));
            }
        });

        socket.on('sessionCleared', (data) => {
            // Only clear questions if it's for the current session
            if (currentSession && data.sessionId === currentSession.sessionId) {
                setQuestions([]);
            }
        });

        socket.on('sessionEnded', (data) => {
            // If current session ended, show notification and clear session
            if (currentSession && data.sessionId === currentSession.sessionId) {
                setError('The session has ended. Please join a new session to continue asking questions.');
                setCurrentSession(null);
                setQuestions([]);
            }
        });

        return () => {
            socketService.disconnect();
        };
    }, [currentSession]);

    // Load session questions when session changes
    useEffect(() => {
        if (currentSession) {
            loadSessionQuestions();
            // Join socket room for this session
            if (isConnected) {
                socketService.joinSession(currentSession.sessionId);
            }
        } else {
            setQuestions([]);
        }
    }, [currentSession, isConnected]);

    const loadSessionQuestions = async () => {
        try {
            const response = await apiClient.getQuestions(currentSession.sessionId, {
                limit: 50
            });
            setQuestions(response.questions);
        } catch (error) {
            console.error('Failed to load session questions:', error);
            setError('Failed to load session questions');
        }
    };

    const handleSessionLoad = (session) => {
        setCurrentSession(session);
        setError(''); // Clear any previous errors

        // Persist session data to sessionStorage if user is authenticated
        if (user) {
            if (session) {
                sessionStorage.setItem('currentStudentSession', JSON.stringify(session));
            } else {
                sessionStorage.removeItem('currentStudentSession');
            }
        }
    };

    const handleSubmitQuestion = async (e) => {
        e.preventDefault();

        if (!newQuestion.trim()) {
            setError('Please enter a question');
            return;
        }

        if (!currentSession) {
            setError('Please load a session first');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            await apiClient.submitQuestion({
                text: newQuestion.trim(),
                sessionId: currentSession.sessionId,
                course: currentSession.courseName
            });

            setNewQuestion('');
            // Question will be added via socket event
        } catch (error) {
            console.error('Failed to submit question:', error);
            setError(error.message || 'Failed to submit question');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateQuestion = async (questionId, updates) => {
        try {
            await apiClient.updateQuestion(questionId, updates);
        } catch (error) {
            console.error('Failed to update question:', error);
            throw error;
        }
    };

    const handleDeleteQuestion = async (questionId) => {
        try {
            await apiClient.deleteQuestion(questionId);
        } catch (error) {
            console.error('Failed to delete question:', error);
            throw error;
        }
    };

    // Group questions by status
    const myAskedQuestions = questions.filter(q =>
        q.author._id === user.id && q.status !== 'answered'
    );

    const myAnsweredQuestions = questions.filter(q =>
        q.author._id === user.id && q.status === 'answered'
    );

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border bg-card">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center space-x-4">
                            <h1 className="text-xl font-semibold">VidyaVichara</h1>
                            <div className="hidden sm:flex items-center space-x-2 text-sm text-muted-foreground">
                                <span>Welcome, {user?.name}</span>
                                <span>•</span>
                                <span>Student Dashboard</span>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            <div className="flex items-center space-x-2">
                                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                <span className="text-xs text-muted-foreground">
                                    {isConnected ? 'Connected' : 'Disconnected'}
                                </span>
                            </div>
                            <ThemeToggle />
                            <Button variant="outline" onClick={logout}>
                                Logout
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Session Management */}
                    <div className="lg:col-span-1">
                        <div className="space-y-6">
                            {/* Session Manager */}
                            <StudentSessionManager
                                onSessionLoad={handleSessionLoad}
                                currentSession={currentSession}
                                isLoading={isLoading}
                            />

                            {/* Question Form - Only show if session is loaded */}
                            {currentSession && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Ask a Question</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <form onSubmit={handleSubmitQuestion} className="space-y-4">
                                            {error && (
                                                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                                                    {error}
                                                </div>
                                            )}

                                            <div className="space-y-2">
                                                <Label htmlFor="question">Your Question</Label>
                                                <Textarea
                                                    id="question"
                                                    value={newQuestion}
                                                    onChange={(e) => setNewQuestion(e.target.value)}
                                                    placeholder="Type your question here..."
                                                    maxLength={500}
                                                    rows={4}
                                                    required
                                                    disabled={isLoading}
                                                />
                                                <div className="text-xs text-muted-foreground text-right">
                                                    {newQuestion.length}/500
                                                </div>
                                            </div>

                                            <Button
                                                type="submit"
                                                className="w-full"
                                                disabled={isLoading || !newQuestion.trim()}
                                            >
                                                {isLoading ? 'Submitting...' : 'Submit Question'}
                                            </Button>
                                        </form>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>

                    {/* Questions Columns - Only show if session is loaded */}
                    <div className="lg:col-span-2">
                        {currentSession ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Asked Questions */}
                                <div>
                                    <h2 className="text-lg font-semibold mb-4 flex items-center">
                                        Asked Questions
                                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                                            ({myAskedQuestions.length})
                                        </span>
                                    </h2>
                                    <div className="space-y-4">
                                        {myAskedQuestions.length === 0 ? (
                                            <Card className="p-6">
                                                <p className="text-muted-foreground text-center">
                                                    No unanswered questions in this session yet
                                                </p>
                                            </Card>
                                        ) : (
                                            myAskedQuestions.map((question) => (
                                                <StickyNote
                                                    key={question._id}
                                                    question={question}
                                                    onUpdate={handleUpdateQuestion}
                                                    onDelete={handleDeleteQuestion}
                                                    isDraggable={true}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Answered Questions */}
                                <div>
                                    <h2 className="text-lg font-semibold mb-4 flex items-center">
                                        Answered Questions
                                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                                            ({myAnsweredQuestions.length})
                                        </span>
                                    </h2>
                                    <div className="space-y-4">
                                        {myAnsweredQuestions.length === 0 ? (
                                            <Card className="p-6">
                                                <p className="text-muted-foreground text-center">
                                                    No answered questions in this session yet
                                                </p>
                                            </Card>
                                        ) : (
                                            myAnsweredQuestions.map((question) => (
                                                <StickyNote
                                                    key={question._id}
                                                    question={question}
                                                    onUpdate={handleUpdateQuestion}
                                                    onDelete={handleDeleteQuestion}
                                                    isDraggable={false}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <Card className="p-8">
                                <div className="text-center space-y-4">
                                    <h3 className="text-lg font-medium">No Session Loaded</h3>
                                    <p className="text-muted-foreground">
                                        Please load a session using the session ID provided by your instructor to start asking questions.
                                    </p>
                                </div>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}