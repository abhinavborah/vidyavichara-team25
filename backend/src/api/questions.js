import express from 'express';
import { Question, questionValidationSchema, questionUpdateSchema } from '../models/Question.js';
import { Session } from '../models/Session.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

// Get questions for a session with filtering
router.get('/session/:sessionId', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { status, important, limit = 50 } = req.query;

    // Validate session exists and is active
    const session = await Session.findOne({ sessionId, isActive: true });
    if (!session) {
      return res.status(404).json({ error: 'Session not found or has ended' });
    }

    // Build query
    const query = { 
      sessionId, 
      isActive: true 
    };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (important === 'true') {
      query.isImportant = true;
    }

    const questions = await Question.find(query)
      .sort({ isImportant: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .exec();

    res.json({
      questions,
      count: questions.length,
      sessionId
    });

  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// Submit a new question
router.post('/', authenticate, validate(questionValidationSchema), async (req, res) => {
  try {
    const { text, sessionId, course } = req.body;
    
    // Validate session exists and is active
    const session = await Session.findOne({ sessionId, isActive: true });
    if (!session) {
      return res.status(404).json({ error: 'Session not found or has ended' });
    }
    
    // Check for duplicate question from same user in same session
    const existingQuestion = await Question.findOne({
      text: text.trim(),
      author: req.user._id,
      sessionId,
      isActive: true
    });

    if (existingQuestion) {
      return res.status(400).json({ 
        error: 'You have already asked this question in this session' 
      });
    }

    // Assign a random pastel color
    const colors = ['yellow', 'pink', 'blue', 'green', 'purple'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const question = new Question({
      text: text.trim(),
      author: req.user._id,
      sessionId,
      course,
      color: randomColor,
      displayOrder: Date.now(), // Use timestamp for initial ordering
      metadata: {
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    await question.save();

    // Emit real-time event (handled by socket.io)
    req.app.get('io').to(`session-${sessionId}`).emit('newQuestion', {
      question: await question.populate('author', 'name role')
    });

    res.status(201).json({
      message: 'Question submitted successfully',
      question
    });

  } catch (error) {
    console.error('Submit question error:', error);
    res.status(500).json({ error: 'Failed to submit question' });
  }
});

// Update question status (teachers only)
router.patch('/:questionId', authenticate, authorize(['teacher']), validate(questionUpdateSchema), async (req, res) => {
  try {
    const { questionId } = req.params;
    const updates = req.body;

    const question = await Question.findByIdAndUpdate(
      questionId,
      updates,
      { new: true, runValidators: true }
    );

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Emit real-time update
    req.app.get('io').to(`session-${question.sessionId}`).emit('questionUpdated', {
      question
    });

    res.json({
      message: 'Question updated successfully',
      question
    });

  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// Delete question
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const question = await Question.findById(req.params.id);

        if (!question) {
            return res.status(404).json({ error: 'Question not found' });
        }

        // Allow deletion - teachers can delete any question, users can delete their own
        // For now, allowing more permissive deletion like teacher dashboard
        await Question.findByIdAndDelete(req.params.id);

        // Emit socket event to notify all clients in the session
        req.app.get('io').to(`session-${question.sessionId}`).emit('questionDeleted', {
            questionId: question._id,
            sessionId: question.sessionId
        });

        res.json({ message: 'Question deleted successfully' });
    } catch (error) {
        console.error('Delete question error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Clear all questions in a session (teachers only)
router.delete('/session/:sessionId/clear', authenticate, authorize(['teacher']), async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Validate session exists and check ownership
    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Only session creator can clear all questions
    if (session.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the session creator can clear all questions' });
    }

    const result = await Question.updateMany(
      { sessionId, isActive: true },
      { isActive: false }
    );

    // Emit real-time update
    req.app.get('io').to(`session-${sessionId}`).emit('sessionCleared');

    res.json({ 
      message: 'Session cleared successfully',
      deletedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Clear session error:', error);
    res.status(500).json({ error: 'Failed to clear session' });
  }
});

// Get user's own questions across sessions
router.get('/my-questions', authenticate, async (req, res) => {
  try {
    const { limit = 50, status } = req.query;
    
    const query = { 
      author: req.user._id, 
      isActive: true 
    };

    if (status && status !== 'all') {
      query.status = status;
    }

    const questions = await Question.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .exec();

    res.json({
      questions,
      count: questions.length
    });

  } catch (error) {
    console.error('Get my questions error:', error);
    res.status(500).json({ error: 'Failed to fetch your questions' });
  }
});

// Update question display order (for drag & drop)
router.patch('/:id/reorder', authenticate, async (req, res) => {
  try {
    console.log('Reorder request received:', {
      questionId: req.params.id,
      userId: req.user._id,
      userRole: req.user.role,
      displayOrder: req.body.displayOrder
    });

    const { id } = req.params;
    const { displayOrder } = req.body;

    const question = await Question.findById(id);
    if (!question || !question.isActive) {
      console.log('Question not found or inactive:', id);
      return res.status(404).json({ error: 'Question not found' });
    }

    console.log('Question found:', {
      questionId: question._id,
      questionAuthor: question.author,
      currentDisplayOrder: question.displayOrder
    });

    // Allow teachers to reorder any question, students to reorder their own
    const isTeacher = req.user.role === 'teacher';
    const isOwner = question.author.toString() === req.user._id.toString();

    console.log('Authorization check:', {
      isTeacher,
      isOwner,
      questionAuthor: question.author.toString(),
      userId: req.user._id.toString()
    });

    if (!isTeacher && !isOwner) {
      console.log('Authorization failed - not teacher and not owner');
      return res.status(403).json({ error: 'Not authorized to reorder this question' });
    }

    question.displayOrder = displayOrder;
    await question.save();

    console.log('Question reordered successfully:', {
      questionId: question._id,
      newDisplayOrder: displayOrder
    });

    // Emit real-time update
    req.app.get('io').to(`session-${question.sessionId}`).emit('questionReordered', {
      questionId: question._id,
      displayOrder
    });

    res.json({ message: 'Question order updated', displayOrder });

  } catch (error) {
    console.error('Reorder question error:', error);
    res.status(500).json({ error: 'Failed to update question order' });
  }
});

export default router;