import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme-toggle';
import { StickyNote } from '@/components/StickyNote';
import { SessionManager } from '@/components/SessionManager';
import { useAuth } from '@/hooks/useAuth';
import apiClient from '@/services/api';
import socketService from '@/services/socket';
import { sessionPDFExporter } from '@/services/pdfExporter';
import { DownloadIcon } from 'lucide-react';

export function TeacherDashboard() {
    const { user, logout } = useAuth();
    const [questions, setQuestions] = useState([]);
    const [sessionId, setSessionId] = useState(() => {
        // Only persist session selection if user is authenticated
        return user ? (sessionStorage.getItem('selectedSessionId') || '') : '';
    });
    const [activeFilter, setActiveFilter] = useState('all');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Reset dashboard state when user changes (new login)
    useEffect(() => {
        if (user) {
            // Check if we have session data for a different user or no user was logged in before
            const storedSessionId = sessionStorage.getItem('selectedSessionId');
            if (!storedSessionId) {
                // Clear everything for fresh start
                setQuestions([]);
                setSessionId('');
                setError('');
                setActiveFilter('all');
            }
        } else {
            // User logged out, clear everything
            setQuestions([]);
            setSessionId('');
            setError('');
            setActiveFilter('all');
        }
    }, [user]);

    // Socket connection
    useEffect(() => {
        const socket = socketService.connect();

        socket.on('connect', () => {
            setIsConnected(true);
            if (sessionId) {
                socketService.joinSession(sessionId);
            }
        });

        socket.on('disconnect', () => {
            setIsConnected(false);
        });

        socket.on('newQuestion', (data) => {
            setQuestions(prev => [data.question, ...prev]);
        });

        socket.on('questionUpdated', (data) => {
            setQuestions(prev =>
                prev.map(q => q._id === data.question._id ? data.question : q)
            );
        });

        socket.on('questionDeleted', (data) => {
            setQuestions(prev => prev.filter(q => q._id !== data.questionId));
        });

        socket.on('questionReordered', (data) => {
            setQuestions(prev =>
                prev.map(q => q._id === data.questionId ? { ...q, displayOrder: data.displayOrder } : q)
            );
        });

        socket.on('sessionCleared', () => {
            setQuestions([]);
        });

        return () => {
            socketService.disconnect();
        };
    }, [sessionId]);

    // Load questions for session
    useEffect(() => {
        if (sessionId) {
            loadSessionQuestions();
        }
    }, [sessionId]);

    const loadSessionQuestions = async () => {
        if (!sessionId.trim()) return;

        setIsLoading(true);
        try {
            const response = await apiClient.getQuestions(sessionId.trim());
            setQuestions(response.questions);
            socketService.joinSession(sessionId.trim());
        } catch (error) {
            console.error('Failed to load questions:', error);
            setError('Failed to load session questions');
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

    const handleReorderQuestion = async (draggedId, targetId, position = 'after') => {
        try {
            let newDisplayOrder;

            if (position === 'empty-column') {
                // For empty columns, use current timestamp to place at top
                newDisplayOrder = Date.now();
            } else {
                // Find the target question to get its display order
                const targetQuestion = questions.find(q => q._id === targetId);
                if (!targetQuestion) return;

                if (position === 'before') {
                    // Position before the target question
                    newDisplayOrder = targetQuestion.displayOrder - 1;
                } else {
                    // Default behavior: position after the target question
                    newDisplayOrder = targetQuestion.displayOrder + 1;
                }
            }

            await apiClient.reorderQuestion(draggedId, newDisplayOrder);
        } catch (error) {
            console.error('Failed to reorder question:', error);
        }
    };

    // Enhanced function to handle position-independent cross-column drag and drop
    const handleCrossColumnDrop = async (draggedId, targetColumn) => {
        try {
            const draggedQuestion = questions.find(q => q._id === draggedId);
            if (!draggedQuestion) return;

            let newStatus = draggedQuestion.status;
            let newImportant = draggedQuestion.isImportant;
            let newDisplayOrder;

            // Determine new status based on target column
            switch (targetColumn) {
                case 'unanswered':
                    newStatus = 'unanswered';
                    // Don't change importance when moving to unanswered
                    break;
                case 'important':
                    newStatus = draggedQuestion.status === 'answered' ? 'answered' : 'unanswered';
                    newImportant = true;
                    break;
                case 'answered':
                    newStatus = 'answered';
                    // Keep importance status when moving to answered
                    break;
            }

            // Always place at the end of the target section using timestamp
            // This ensures position-independent dropping
            newDisplayOrder = Date.now();

            // Update question with new status, importance, and display order
            await apiClient.updateQuestion(draggedId, {
                status: newStatus,
                isImportant: newImportant,
                displayOrder: newDisplayOrder
            });

        } catch (error) {
            console.error('Failed to handle cross-column drop:', error);
        }
    };

    // Session selection handler
    const handleSessionSelect = async (selectedSessionId) => {
        setSessionId(selectedSessionId);
        setError('');

        // Persist session selection only if user is authenticated
        if (user) {
            if (selectedSessionId) {
                sessionStorage.setItem('selectedSessionId', selectedSessionId);
            } else {
                sessionStorage.removeItem('selectedSessionId');
            }
        }

        if (selectedSessionId) {
            // Join the session
            try {
                await apiClient.joinSession(selectedSessionId);
            } catch (error) {
                console.error('Failed to join session:', error);
                setError('Failed to join session');
            }
        }
    };

    const handleClearSession = async () => {
        if (!window.confirm('Are you sure you want to clear all questions in this session? This action cannot be undone.')) {
            return;
        }

        try {
            await apiClient.clearSession(sessionId);
            setQuestions([]);
        } catch (error) {
            console.error('Failed to clear session:', error);
            setError('Failed to clear session');
        }
    };

    const handleExportToPDF = async () => {
        if (questions.length === 0) {
            setError('No questions to export');
            return;
        }

        setIsExporting(true);
        setError('');

        try {
            const sessionData = {
                sessionId,
                teacherName: user?.name,
                exportDate: new Date().toISOString()
            };

            const result = sessionPDFExporter.exportSessionToPDF(sessionData, questions);

            if (result.success) {
                // Show success message briefly
                setError(''); // Clear any previous errors
                // You could add a success toast here if you have toast notifications
            } else {
                setError(`Export failed: ${result.error}`);
            }
        } catch (error) {
            console.error('Export failed:', error);
            setError('Failed to export session data');
        } finally {
            setIsExporting(false);
        }
    };

    // Filter questions
    const getFilteredQuestions = () => {
        switch (activeFilter) {
            case 'unanswered':
                return questions.filter(q => q.status === 'unanswered');
            case 'answered':
                return questions.filter(q => q.status === 'answered');
            case 'important':
                return questions.filter(q => q.isImportant);
            default:
                return questions;
        }
    };

    const filteredQuestions = getFilteredQuestions();

    // Organize questions into Kanban columns (sorted by displayOrder)
    const unansweredQuestions = questions
        .filter(q => q.status === 'unanswered')
        .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const importantQuestions = questions
        .filter(q => q.isImportant && q.status !== 'answered')
        .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const answeredQuestions = questions
        .filter(q => q.status === 'answered')
        .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border bg-card">
                <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 xl:px-8">
                    <div className="flex items-center justify-between h-14 sm:h-16">
                        <div className="flex items-center space-x-2 sm:space-x-4">
                            <h1 className="text-lg sm:text-xl font-semibold">VidyaVichara</h1>
                            <div className="hidden md:flex items-center space-x-2 text-sm text-muted-foreground">
                                <span>Welcome, {user?.name}</span>
                                <span>•</span>
                                <span>Teacher Dashboard</span>
                            </div>
                        </div>

                        <div className="flex items-center space-x-1 sm:space-x-2">
                            <div className="hidden sm:flex items-center space-x-1 sm:space-x-2">
                                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                <span className="text-xs text-muted-foreground">
                                    {isConnected ? 'Connected' : 'Disconnected'}
                                </span>
                            </div>
                            <ThemeToggle />
                            <Button variant="outline" onClick={logout} size="sm" className="text-xs sm:text-sm">
                                Logout
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 lg:py-8">
                {/* Session Management */}
                <div className="mb-4 sm:mb-6 lg:mb-8 grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
                    <div className="lg:col-span-1">
                        <SessionManager
                            onSessionSelect={handleSessionSelect}
                            selectedSessionId={sessionId}
                        />
                    </div>

                    {sessionId && (
                        <div className="xl:col-span-2 space-y-4 sm:space-y-6">
                            {/* Current Session */}
                            <Card>
                                <CardHeader className="pb-3 sm:pb-6">
                                    <CardTitle className="text-sm sm:text-base lg:text-lg break-all leading-tight">Current Session: {sessionId}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col gap-2 sm:gap-3">
                                        <div className="text-xs sm:text-sm text-muted-foreground">
                                            {questions.length} questions • {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                                        </div>
                                        <Button
                                            variant="destructive"
                                            onClick={handleClearSession}
                                            disabled={questions.length === 0}
                                            size="sm"
                                            className="w-full text-xs sm:text-sm"
                                        >
                                            Clear All Questions
                                        </Button>
                                    </div>
                                    {error && (
                                        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md mt-4">
                                            {error}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Export Session Data */}
                            <Card>
                                <CardHeader className="pb-3 sm:pb-6">
                                    <CardTitle className="text-sm sm:text-base lg:text-lg">Export Session Data</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3 sm:space-y-4">
                                        <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                                            Export all questions from this session organized by category (To Address, Important, Answered) into a PDF report for easy review by TAs and later reference.
                                        </div>

                                        {questions.length > 0 && (
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                                                <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded-md border border-red-200 dark:border-red-800">
                                                    <div className="font-semibold text-red-700 dark:text-red-300 text-lg sm:text-xl">
                                                        {unansweredQuestions.length}
                                                    </div>
                                                    <div className="text-red-600 dark:text-red-400 text-xs leading-tight">To Address</div>
                                                </div>
                                                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded-md border border-yellow-200 dark:border-yellow-800">
                                                    <div className="font-semibold text-yellow-700 dark:text-yellow-300 text-lg sm:text-xl">
                                                        {importantQuestions.length}
                                                    </div>
                                                    <div className="text-yellow-600 dark:text-yellow-400 text-xs leading-tight">Important</div>
                                                </div>
                                                <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-md border border-green-200 dark:border-green-800">
                                                    <div className="font-semibold text-green-700 dark:text-green-300 text-lg sm:text-xl">
                                                        {answeredQuestions.length}
                                                    </div>
                                                    <div className="text-green-600 dark:text-green-400 text-xs leading-tight">Answered</div>
                                                </div>
                                                <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-md border border-blue-200 dark:border-blue-800">
                                                    <div className="font-semibold text-blue-700 dark:text-blue-300 text-lg sm:text-xl">
                                                        {questions.length}
                                                    </div>
                                                    <div className="text-blue-600 dark:text-blue-400 text-xs leading-tight">Total</div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex flex-col gap-2 sm:gap-3 pt-2">
                                            <div className="text-xs sm:text-sm text-muted-foreground">
                                                {questions.length === 0
                                                    ? 'No questions available to export'
                                                    : `Ready to export ${questions.length} questions`
                                                }
                                            </div>
                                            <Button
                                                onClick={handleExportToPDF}
                                                disabled={questions.length === 0 || isExporting}
                                                className="gap-2 w-full text-xs sm:text-sm"
                                                size="sm"
                                            >
                                                <DownloadIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                                                {isExporting ? 'Exporting...' : 'Export PDF'}
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>

                {!sessionId && (
                    <div className="text-center py-12 text-muted-foreground">
                        <h3 className="text-lg font-medium mb-2">No Session Selected</h3>
                        <p className="text-sm">Create a new session or select an existing one to start managing questions.</p>
                    </div>
                )}

                {/* Kanban Board */}
                {sessionId && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* To Address Column */}
                        <div
                            className="min-h-[400px] transition-all duration-300 rounded-lg border-2 border-transparent"
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                e.currentTarget.classList.add('bg-red-50/80', 'dark:bg-red-900/20', 'border-red-300', 'dark:border-red-700', 'shadow-lg');
                            }}
                            onDragLeave={(e) => {
                                if (!e.currentTarget.contains(e.relatedTarget)) {
                                    e.currentTarget.classList.remove('bg-red-50/80', 'dark:bg-red-900/20', 'border-red-300', 'dark:border-red-700', 'shadow-lg');
                                }
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.currentTarget.classList.remove('bg-red-50/80', 'dark:bg-red-900/20', 'border-red-300', 'dark:border-red-700', 'shadow-lg');

                                try {
                                    const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
                                    const { questionId: draggedId } = dragData;

                                    if (draggedId) {
                                        // Simply drop at the end of the section
                                        handleCrossColumnDrop(draggedId, 'unanswered');
                                    }
                                } catch (error) {
                                    // Fallback for old format
                                    const draggedId = e.dataTransfer.getData('text/plain');
                                    if (draggedId) {
                                        handleCrossColumnDrop(draggedId, 'unanswered');
                                    }
                                }
                            }}
                        >
                            <div className="bg-gradient-to-r from-red-100 to-rose-100 dark:from-red-900/20 dark:to-rose-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4 shadow-sm">
                                <h2 className="font-semibold text-center text-red-800 dark:text-red-200">
                                    📋 To Address ({unansweredQuestions.length})
                                </h2>
                            </div>
                            <div className="space-y-4 max-h-[600px] overflow-y-auto p-4 min-h-[200px] rounded-lg">
                                {unansweredQuestions.map((question) => (
                                    <StickyNote
                                        key={question._id}
                                        question={question}
                                        onUpdate={handleUpdateQuestion}
                                        onDelete={handleDeleteQuestion}
                                        onReorder={handleReorderQuestion}
                                    />
                                ))}
                                {unansweredQuestions.length === 0 && (
                                    <div className="flex items-center justify-center h-32 border-2 border-dashed border-red-200 dark:border-red-800 rounded-lg bg-red-50/30 dark:bg-red-900/10">
                                        <p className="text-red-600 dark:text-red-400 text-center text-sm font-medium">
                                            📋 Drop questions here to mark as "To Address"
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Important Column */}
                        <div
                            className="min-h-[400px] transition-all duration-300 rounded-lg border-2 border-transparent"
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                e.currentTarget.classList.add('bg-yellow-50/80', 'dark:bg-yellow-900/20', 'border-yellow-300', 'dark:border-yellow-700', 'shadow-lg');
                            }}
                            onDragLeave={(e) => {
                                if (!e.currentTarget.contains(e.relatedTarget)) {
                                    e.currentTarget.classList.remove('bg-yellow-50/80', 'dark:bg-yellow-900/20', 'border-yellow-300', 'dark:border-yellow-700', 'shadow-lg');
                                }
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.currentTarget.classList.remove('bg-yellow-50/80', 'dark:bg-yellow-900/20', 'border-yellow-300', 'dark:border-yellow-700', 'shadow-lg');

                                try {
                                    const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
                                    const { questionId: draggedId } = dragData;

                                    if (draggedId) {
                                        // Simply drop at the end of the section
                                        handleCrossColumnDrop(draggedId, 'important');
                                    }
                                } catch (error) {
                                    // Fallback for old format
                                    const draggedId = e.dataTransfer.getData('text/plain');
                                    if (draggedId) {
                                        handleCrossColumnDrop(draggedId, 'important');
                                    }
                                }
                            }}
                        >
                            <div className="bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/20 dark:to-amber-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4 shadow-sm">
                                <h2 className="font-semibold text-center text-yellow-800 dark:text-yellow-200">
                                    ⭐ Important ({importantQuestions.length})
                                </h2>
                            </div>
                            <div className="space-y-4 max-h-[600px] overflow-y-auto p-4 min-h-[200px] rounded-lg">
                                {importantQuestions.map((question) => (
                                    <StickyNote
                                        key={question._id}
                                        question={question}
                                        onUpdate={handleUpdateQuestion}
                                        onDelete={handleDeleteQuestion}
                                        onReorder={handleReorderQuestion}
                                    />
                                ))}
                                {importantQuestions.length === 0 && (
                                    <div className="flex items-center justify-center h-32 border-2 border-dashed border-yellow-200 dark:border-yellow-800 rounded-lg bg-yellow-50/30 dark:bg-yellow-900/10">
                                        <p className="text-yellow-600 dark:text-yellow-400 text-center text-sm font-medium">
                                            ⭐ Drop questions here to mark as "Important"
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Answered Column */}
                        <div
                            className="min-h-[400px] transition-all duration-300 rounded-lg border-2 border-transparent"
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                e.currentTarget.classList.add('bg-green-50/80', 'dark:bg-green-900/20', 'border-green-300', 'dark:border-green-700', 'shadow-lg');
                            }}
                            onDragLeave={(e) => {
                                if (!e.currentTarget.contains(e.relatedTarget)) {
                                    e.currentTarget.classList.remove('bg-green-50/80', 'dark:bg-green-900/20', 'border-green-300', 'dark:border-green-700', 'shadow-lg');
                                }
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.currentTarget.classList.remove('bg-green-50/80', 'dark:bg-green-900/20', 'border-green-300', 'dark:border-green-700', 'shadow-lg');

                                try {
                                    const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
                                    const { questionId: draggedId } = dragData;

                                    if (draggedId) {
                                        // Simply drop at the end of the section
                                        handleCrossColumnDrop(draggedId, 'answered');
                                    }
                                } catch (error) {
                                    // Fallback for old format
                                    const draggedId = e.dataTransfer.getData('text/plain');
                                    if (draggedId) {
                                        handleCrossColumnDrop(draggedId, 'answered');
                                    }
                                }
                            }}
                        >
                            <div className="bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4 shadow-sm">
                                <h2 className="font-semibold text-center text-green-800 dark:text-green-200">
                                    ✅ Answered ({answeredQuestions.length})
                                </h2>
                            </div>
                            <div className="space-y-4 max-h-[600px] overflow-y-auto p-4 min-h-[200px] rounded-lg">
                                {answeredQuestions.map((question) => (
                                    <StickyNote
                                        key={question._id}
                                        question={question}
                                        onUpdate={handleUpdateQuestion}
                                        onDelete={handleDeleteQuestion}
                                        onReorder={handleReorderQuestion}
                                    />
                                ))}
                                {answeredQuestions.length === 0 && (
                                    <div className="flex items-center justify-center h-32 border-2 border-dashed border-green-200 dark:border-green-800 rounded-lg bg-green-50/30 dark:bg-green-900/10">
                                        <p className="text-green-600 dark:text-green-400 text-center text-sm font-medium">
                                            ✅ Drop questions here to mark as "Answered"
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Summary Stats */}
                {sessionId && (
                    <div className="mt-8">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                    <div>
                                        <div className="text-2xl font-bold">{questions.length}</div>
                                        <div className="text-sm text-muted-foreground">Total Questions</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold">{unansweredQuestions.length}</div>
                                        <div className="text-sm text-muted-foreground">Unanswered</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold">{importantQuestions.length}</div>
                                        <div className="text-sm text-muted-foreground">Important</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold">{answeredQuestions.length}</div>
                                        <div className="text-sm text-muted-foreground">Answered</div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}