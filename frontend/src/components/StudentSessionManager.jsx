import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, UsersIcon, ClockIcon, SearchIcon } from 'lucide-react';
import apiClient from '@/services/api';

export function StudentSessionManager({ onSessionLoad, currentSession, isLoading }) {
    const [sessionId, setSessionId] = useState('');
    const [error, setError] = useState('');
    const [isLoadingSession, setIsLoadingSession] = useState(false);

    const handleLoadSession = async (e) => {
        e.preventDefault();

        if (!sessionId.trim()) {
            setError('Please enter a session ID');
            return;
        }

        setIsLoadingSession(true);
        setError('');

        try {
            // Validate session exists and get details
            const response = await apiClient.getSession(sessionId.trim());

            if (!response.session.isActive) {
                setError('This session has ended and is no longer accepting questions');
                return;
            }

            // Join the session
            await apiClient.joinSession(sessionId.trim());

            // Notify parent component
            onSessionLoad(response.session);

        } catch (error) {
            console.error('Failed to load session:', error);
            if (error.message.includes('404')) {
                setError('Session not found. Please check the session ID and try again.');
            } else {
                setError(error.message || 'Failed to load session');
            }
        } finally {
            setIsLoadingSession(false);
        }
    };

    const handleLeaveSession = () => {
        setSessionId('');
        onSessionLoad(null);
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        });
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Show session details if loaded
    if (currentSession) {
        return (
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <CardTitle className="text-lg font-semibold">Current Session</CardTitle>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleLeaveSession}
                        disabled={isLoading}
                    >
                        Leave Session
                    </Button>
                </CardHeader>

                <CardContent>
                    <div className="space-y-4">
                        {/* Session Info */}
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-medium text-primary">
                                    {currentSession.courseName}
                                </h3>
                                <Badge variant="secondary" className="text-xs font-mono">
                                    {currentSession.sessionId}
                                </Badge>
                                <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                                    Active
                                </Badge>
                            </div>

                            {currentSession.description && (
                                <p className="text-sm text-muted-foreground mb-2">
                                    {currentSession.description}
                                </p>
                            )}

                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                    <CalendarIcon className="h-3 w-3" />
                                    {formatDate(currentSession.sessionDate)}
                                </div>
                                <div className="flex items-center gap-1">
                                    <ClockIcon className="h-3 w-3" />
                                    {formatTime(currentSession.createdAt)}
                                </div>
                                <div className="flex items-center gap-1">
                                    <UsersIcon className="h-3 w-3" />
                                    {currentSession.questionCount || 0} questions
                                </div>
                            </div>
                        </div>

                        {/* Teacher Info */}
                        <div className="text-xs text-muted-foreground">
                            <span className="font-medium">Instructor:</span> {currentSession.createdBy?.name}
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Show session loading form
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg font-semibold">Join Session</CardTitle>
            </CardHeader>

            <CardContent>
                <form onSubmit={handleLoadSession} className="space-y-4">
                    <div>
                        <Label htmlFor="sessionId">Session ID</Label>
                        <div className="flex gap-2 mt-1">
                            <Input
                                id="sessionId"
                                value={sessionId}
                                onChange={(e) => setSessionId(e.target.value.toUpperCase())}
                                placeholder="e.g., SCI-SEP27-001"
                                className="font-mono"
                                disabled={isLoadingSession}
                            />
                            <Button
                                type="submit"
                                disabled={isLoadingSession || !sessionId.trim()}
                                className="gap-2"
                            >
                                <SearchIcon className="h-4 w-4" />
                                {isLoadingSession ? 'Loading...' : 'Load'}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Enter the session ID provided by your instructor
                        </p>
                    </div>

                    {error && (
                        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                            {error}
                        </div>
                    )}
                </form>

                {/* Instructions */}
                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium text-sm mb-2">How to join a session:</h4>
                    <ol className="text-xs text-muted-foreground space-y-1">
                        <li>1. Get the session ID from your instructor</li>
                        <li>2. Enter it in the field above (e.g., MATH-SEP27-001)</li>
                        <li>3. Click "Load" to join the session</li>
                        <li>4. Start asking questions!</li>
                    </ol>
                </div>
            </CardContent>
        </Card>
    );
}