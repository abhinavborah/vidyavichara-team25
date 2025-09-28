import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { CalendarIcon, PlusIcon, UsersIcon, ClockIcon, XIcon } from 'lucide-react';
import apiClient from '@/services/api';

export function SessionManager({ onSessionSelect, selectedSessionId }) {
    const [sessions, setSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState('');
    const [sessionToEnd, setSessionToEnd] = useState(null);
    const [isEndingSession, setIsEndingSession] = useState(false);
    const [showCreateDialog, setShowCreateDialog] = useState(false);

    // New session form
    const [newSession, setNewSession] = useState({
        courseName: '',
        description: '',
        sessionDate: new Date().toISOString().split('T')[0] // Today's date
    });

    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await apiClient.getMySessions({ limit: 10, active: 'true' });
            setSessions(response.sessions);

            // If we have a selected session, check if it's still in the active list
            if (selectedSessionId) {
                const stillActive = response.sessions.some(s => s.sessionId === selectedSessionId);
                if (!stillActive) {
                    // The selected session is no longer active, but don't auto-deselect
                    // Instead, let the teacher know and let them decide
                    console.warn(`Selected session ${selectedSessionId} is no longer active`);
                    // We could show a warning here, but for now just keep the selection
                    // The teacher can manually deselect or select a different session
                }
            }
        } catch (error) {
            console.error('Failed to load sessions:', error);
            setError('Failed to load sessions');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateSession = async (e) => {
        e.preventDefault();

        if (!newSession.courseName.trim()) {
            setError('Course name is required');
            return;
        }

        setIsCreating(true);
        setError('');

        try {
            const response = await apiClient.createSession({
                courseName: newSession.courseName.trim(),
                description: newSession.description.trim() || undefined,
                sessionDate: newSession.sessionDate
            });

            // Add to sessions list and select it
            setSessions(prev => [response.session, ...prev]);
            onSessionSelect(response.session.sessionId);

            // Reset form and close dialog
            setNewSession({
                courseName: '',
                description: '',
                sessionDate: new Date().toISOString().split('T')[0]
            });
            setShowCreateDialog(false);

        } catch (error) {
            console.error('Failed to create session:', error);
            setError(error.message || 'Failed to create session');
        } finally {
            setIsCreating(false);
        }
    };

    const handleSessionSelect = (sessionId) => {
        onSessionSelect(sessionId);
    };

    const handleDeselectSession = () => {
        onSessionSelect(null);
    };

    const handleEndSession = async (sessionId, sessionName, e) => {
        e.stopPropagation(); // Prevent session selection when clicking end button
        setSessionToEnd({ id: sessionId, name: sessionName });
    };

    const confirmEndSession = async () => {
        if (!sessionToEnd) return;

        console.log('Starting to end session:', sessionToEnd.id);
        console.log('Session object:', sessionToEnd);
        setIsEndingSession(true);
        try {
            console.log('Calling apiClient.endSession...');
            const result = await apiClient.endSession(sessionToEnd.id);
            console.log('Session ended successfully:', result);

            // Remove from sessions list or mark as inactive
            setSessions(prev => prev.filter(s => s.sessionId !== sessionToEnd.id));

            // If this was the selected session, clear selection
            if (selectedSessionId === sessionToEnd.id) {
                onSessionSelect(null);
            }

            setSessionToEnd(null);
            setError(''); // Clear any previous errors
        } catch (error) {
            console.error('Failed to end session:', error);
            console.error('Error details:', {
                message: error.message,
                sessionId: sessionToEnd.id,
                errorType: typeof error
            });
            setError(`Failed to end session: ${error.message}`);
        } finally {
            setIsEndingSession(false);
        }
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

    return (
        <Card>
            <CardHeader className="pb-3 sm:pb-6">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base sm:text-lg">Session Management</CardTitle>
                    <div className="flex gap-1 sm:gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDeselectSession}
                            disabled={!selectedSessionId}
                            className="text-xs sm:text-sm px-2 sm:px-3"
                        >
                            Deselect
                        </Button>
                        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                            <DialogTrigger asChild>
                                <Button size="sm" className="gap-1 text-xs sm:text-sm px-2 sm:px-3">
                                    <PlusIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                                    New Session
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="w-[95vw] max-w-md p-4 sm:p-6">
                                <DialogHeader>
                                    <DialogTitle className="text-base sm:text-lg">Create New Session</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleCreateSession} className="space-y-4">
                                    <div>
                                        <Label htmlFor="courseName" className="text-xs sm:text-sm">Course Name *</Label>
                                        <Input
                                            id="courseName"
                                            value={newSession.courseName}
                                            onChange={(e) => setNewSession(prev => ({ ...prev, courseName: e.target.value }))}
                                            placeholder="e.g. CS 101 - Introduction to Programming"
                                            disabled={isCreating}
                                            className="text-xs sm:text-sm"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="description" className="text-xs sm:text-sm">Description (optional)</Label>
                                        <Textarea
                                            id="description"
                                            value={newSession.description}
                                            onChange={(e) => setNewSession(prev => ({ ...prev, description: e.target.value }))}
                                            placeholder="Brief description of the session topic"
                                            disabled={isCreating}
                                            className="text-xs sm:text-sm min-h-[60px] sm:min-h-[80px]"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="sessionDate" className="text-xs sm:text-sm">Session Date</Label>
                                        <Input
                                            id="sessionDate"
                                            type="date"
                                            value={newSession.sessionDate}
                                            onChange={(e) => setNewSession(prev => ({ ...prev, sessionDate: e.target.value }))}
                                            disabled={isCreating}
                                            className="text-xs sm:text-sm"
                                        />
                                    </div>
                                    {error && (
                                        <div className="text-red-600 text-xs sm:text-sm">
                                            {error}
                                        </div>
                                    )}
                                    <DialogFooter className="gap-2 sm:gap-0">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setShowCreateDialog(false)}
                                            disabled={isCreating}
                                            className="text-xs sm:text-sm"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={isCreating || !newSession.courseName.trim()}
                                            className="text-xs sm:text-sm"
                                        >
                                            {isCreating ? 'Creating...' : 'Create Session'}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="px-3 sm:px-6">
                {isLoading ? (
                    <div className="text-center text-muted-foreground py-4">
                        <p className="text-xs sm:text-sm">Loading sessions...</p>
                    </div>
                ) : error && sessions.length === 0 ? (
                    <div className="text-center text-red-600 py-4">
                        <p className="text-xs sm:text-sm">{error}</p>
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                        <CalendarIcon className="h-8 w-8 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-xs sm:text-sm">No active sessions</p>
                        <p className="text-[10px] sm:text-xs mt-1">Create a new session to get started</p>
                    </div>
                ) : (
                    <div className="max-h-96 overflow-y-auto">
                        <div className="space-y-3 sm:space-y-4 pr-2">
                            {sessions.map((session) => (
                                <div
                                    key={session.sessionId}
                                    className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md hover:bg-muted/30 ${selectedSessionId === session.sessionId
                                            ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                                            : 'border-border hover:border-primary/30'
                                        }`}
                                    onClick={() => handleSessionSelect(session.sessionId)}
                                >
                                    {/* Header Section */}
                                    <div className="flex items-start justify-between mb-3 gap-3">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-sm sm:text-base truncate mb-2 text-foreground">
                                                {session.courseName}
                                            </h3>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="text-xs font-mono px-2 py-1 bg-muted/80">
                                                    {session.sessionId}
                                                </Badge>
                                                {session.isActive && (
                                                    <Badge variant="outline" className="text-xs font-medium text-green-700 border-green-300 bg-green-50 dark:bg-green-950/30 px-2 py-1">
                                                        ● Active
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-start shrink-0">
                                            {session.isActive && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => handleEndSession(session.sessionId, session.courseName, e)}
                                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-full"
                                                    title="End Session"
                                                >
                                                    <XIcon className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Description */}
                                    {session.description && (
                                        <div className="mb-4">
                                            <p className="text-sm text-foreground/80 line-clamp-2 leading-relaxed">
                                                {session.description}
                                            </p>
                                        </div>
                                    )}

                                    {/* Metadata Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border/50">
                                        <div className="flex items-center gap-2 text-xs">
                                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                                                <CalendarIcon className="h-3 w-3 text-primary" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-foreground">{formatDate(session.sessionDate)}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs">
                                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                                                <ClockIcon className="h-3 w-3 text-primary" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-foreground">{formatTime(session.createdAt)}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs">
                                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
                                                <UsersIcon className="h-3 w-3 text-primary" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-foreground">{session.questionCount || 0} questions</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={loadSessions}
                            className="w-full text-xs sm:text-sm mt-3 sm:mt-4"
                            disabled={isLoading}
                        >
                            Refresh Sessions
                        </Button>
                    </div>
                )}
            </CardContent>

            {/* End Session Confirmation Dialog */}
            <Dialog open={!!sessionToEnd} onOpenChange={(open) => !open && setSessionToEnd(null)}>
                <DialogContent className="w-[95vw] max-w-md p-4 sm:p-6">
                    <DialogHeader>
                        <DialogTitle className="text-base sm:text-lg">End Session</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-xs sm:text-sm">
                            Are you sure you want to end the session "{sessionToEnd?.name}"?
                        </p>
                        <div className="text-xs sm:text-sm text-muted-foreground space-y-1">
                            <p>• Students will no longer be able to submit questions</p>
                            <p>• All students will be notified that the session has ended</p>
                            <p>• Session data will be preserved for review</p>
                            <p className="font-medium text-red-600">• This action cannot be undone</p>
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setSessionToEnd(null)}
                            disabled={isEndingSession}
                            className="text-xs sm:text-sm"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmEndSession}
                            disabled={isEndingSession}
                            className="text-xs sm:text-sm"
                        >
                            {isEndingSession ? 'Ending Session...' : 'End Session'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}