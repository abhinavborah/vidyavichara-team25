import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export function StickyNote({
    question,
    onUpdate,
    onDelete,
    onReorder,
    onStatusChange, // New prop for handling status changes between columns
    className,
    isDraggable = true
}) {
    const { user } = useAuth();
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [dragPosition, setDragPosition] = useState('none'); // 'top', 'bottom', 'none'

    const isTeacher = user?.role === 'teacher';
    const isOwner = question.author?._id === user?.id;

    // Generate a vibrant color based on question content for consistency
    const getQuestionColor = () => {
        const colors = ['yellow', 'pink', 'blue', 'green', 'purple', 'indigo', 'orange', 'teal'];
        if (question.color) return question.color;
        const hash = question.text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[hash % colors.length];
    };

    const handleStatusUpdate = async (newStatus) => {
        if (!isTeacher) return;

        setIsUpdating(true);
        try {
            await onUpdate(question._id, {
                status: newStatus,
                isImportant: newStatus === 'important' ? true : question.isImportant
            });
        } catch (error) {
            console.error('Failed to update question:', error);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleImportantToggle = async () => {
        if (!isTeacher) return;

        setIsUpdating(true);
        try {
            await onUpdate(question._id, {
                isImportant: !question.isImportant
            });
        } catch (error) {
            console.error('Failed to toggle importance:', error);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDelete = async () => {
        if (!isTeacher && !isOwner) return;

        if (window.confirm('Are you sure you want to delete this question?')) {
            try {
                await onDelete(question._id);
            } catch (error) {
                console.error('Failed to delete question:', error);
            }
        }
    };

    // Enhanced mouse interaction handlers
    const handleMouseEnter = () => {
        setIsHovering(true);
    };

    const handleMouseLeave = () => {
        setIsHovering(false);
    };

    // Drag and drop handlers
    const handleDragStart = (e) => {
        if (!isDraggable || (!isTeacher && !isOwner)) return;

        setIsDragging(true);
        setIsHovering(false);

        // Store both question ID and current status for column detection
        e.dataTransfer.setData('text/plain', JSON.stringify({
            questionId: question._id,
            currentStatus: question.status,
            isImportant: question.isImportant
        }));
        e.dataTransfer.effectAllowed = 'move';

        // Create an enhanced custom drag image with better visual feedback
        const dragImage = e.currentTarget.cloneNode(true);
        dragImage.style.transform = 'rotate(8deg) scale(0.9)';
        dragImage.style.opacity = '0.95';
        dragImage.style.boxShadow = '0 30px 60px rgba(0, 0, 0, 0.3)';
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-2000px';
        dragImage.style.left = '-2000px';
        dragImage.style.zIndex = '9999';
        dragImage.style.borderRadius = '12px';
        dragImage.style.filter = 'brightness(1.1) saturate(1.2)';
        dragImage.style.pointerEvents = 'none';

        document.body.appendChild(dragImage);

        // Set drag image with better positioning
        const rect = e.currentTarget.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        e.dataTransfer.setDragImage(dragImage, offsetX, offsetY);

        // Cleanup drag image after a delay
        setTimeout(() => {
            if (document.body.contains(dragImage)) {
                document.body.removeChild(dragImage);
            }
        }, 200);
    };

    const handleDragEnd = (e) => {
        setIsDragging(false);
        setDragPosition('none');

        // Clear all drag-over states from other elements
        document.querySelectorAll('.sticky-note').forEach(el => {
            el.classList.remove('drag-over-top', 'drag-over-bottom');
        });
    };

    const handleDragOver = (e) => {
        if (!isDraggable) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        // Calculate drop position based on mouse Y position within the element
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const height = rect.height;
        const position = y < height / 2 ? 'top' : 'bottom';

        if (position !== dragPosition) {
            setDragPosition(position);

            // Remove previous classes
            e.currentTarget.classList.remove('drag-over-top', 'drag-over-bottom');

            // Add new class based on position
            if (position === 'top') {
                e.currentTarget.classList.add('drag-over-top');
            } else {
                e.currentTarget.classList.add('drag-over-bottom');
            }
        }
    };

    const handleDragLeave = (e) => {
        // Only reset if we're leaving the current element completely
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setDragPosition('none');
            e.currentTarget.classList.remove('drag-over-top', 'drag-over-bottom');
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over-top', 'drag-over-bottom');

        // Handle within-section reordering
        try {
            const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
            const { questionId: draggedId } = dragData;

            if (draggedId && draggedId !== question._id && onReorder) {
                // Calculate position based on mouse position at drop time
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const height = rect.height;
                const position = y < height / 2 ? 'before' : 'after';

                console.log('Dropping:', draggedId, 'on:', question._id, 'position:', position);
                onReorder(draggedId, question._id, position);
            }
        } catch (error) {
            console.error('Drop reorder error:', error);
        } finally {
            setDragPosition('none');
        }
    };

    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div
            draggable={isDraggable && (isTeacher || isOwner)}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleMouseEnter} // Touch support
            onTouchEnd={handleMouseLeave}
            className={cn(
                "sticky-note",
                `color-${getQuestionColor()}`,
                {
                    'important': question.isImportant,
                    'answered': question.status === 'answered',
                    'dragging': isDragging,
                    'hovering': isHovering && !isDragging,
                    'drag-over-top': dragPosition === 'top',
                    'drag-over-bottom': dragPosition === 'bottom'
                },
                className
            )}
        >
            {/* Question Content */}
            <div className="mb-3">
                <p className="text-sm leading-relaxed break-words">
                    {question.text}
                </p>
            </div>

            {/* Question Meta */}
            <div className="mb-3">
                <p className="text-sm text-muted-foreground">
                    by {question.author?.name} • {question.course} • {formatTime(question.createdAt)}
                </p>
            </div>

            {/* Status Badge */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {question.isImportant && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30">
                            ⭐ Important
                        </span>
                    )}
                    {question.status === 'answered' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-secondary text-secondary-foreground">
                            ✅ Answered
                        </span>
                    )}
                </div>

                {/* Action Buttons with Micro-interactions */}
                {(isTeacher || isOwner) && (
                    <div className="flex items-center gap-1">
                        {isTeacher && (
                            <>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleImportantToggle}
                                    disabled={isUpdating}
                                    className="h-6 w-6 p-0 btn-micro hover:bg-yellow-100/50 dark:hover:bg-yellow-900/20"
                                    title={question.isImportant ? 'Remove importance' : 'Mark as important'}
                                >
                                    <span className="text-sm">
                                        {question.isImportant ? '⭐' : '☆'}
                                    </span>
                                </Button>

                                {question.status === 'answered' ? (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleStatusUpdate('unanswered')}
                                        disabled={isUpdating}
                                        className="h-6 w-6 p-0 btn-micro text-orange-600 hover:text-orange-700 hover:bg-orange-100/50 dark:hover:bg-orange-900/20"
                                        title="Move back to 'To Address'"
                                    >
                                        <span className="text-sm">⟲</span>
                                    </Button>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleStatusUpdate('answered')}
                                        disabled={isUpdating}
                                        className="h-6 px-2 text-xs btn-micro hover:bg-green-100/50 dark:hover:bg-green-900/20"
                                        title="Mark as answered"
                                    >
                                        ✓
                                    </Button>
                                )}
                            </>
                        )}

                        {(isTeacher || isOwner) && (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleDelete}
                                disabled={isUpdating}
                                className="h-6 w-6 p-0 btn-micro text-destructive hover:text-red-700 hover:bg-red-100/50 dark:hover:bg-red-900/20"
                                title="Delete question"
                            >
                                <span className="text-sm font-bold">×</span>
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}