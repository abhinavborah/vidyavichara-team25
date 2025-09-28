import express from 'express';
import { Session, sessionValidationSchema, sessionUpdateSchema, generateSessionId } from '../models/Session.js';
import { Question } from '../models/Question.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

// Create a new session (teachers only)
router.post('/', authenticate, authorize(['teacher']), validate(sessionValidationSchema), async (req, res) => {
  try {
    const { courseName, sessionDate, description } = req.body;
    
    console.log('Creating session with user:', {
      userId: req.user._id,
      userIdType: typeof req.user._id,
      userName: req.user.name
    });
    
    // Parse session date or use today
    const parsedDate = sessionDate ? new Date(sessionDate) : new Date();
    
    // Generate human-readable session ID
    const sessionId = await generateSessionId(courseName, parsedDate);
    
    const session = new Session({
      sessionId,
      createdBy: req.user._id,
      courseName,
      sessionDate: parsedDate,
      description,
      metadata: {
        startTime: new Date()
      }
    });

    await session.save();
    
    console.log('Session created:', {
      sessionId: session.sessionId,
      createdBy: session.createdBy,
      createdByType: typeof session.createdBy
    });

    // Emit real-time event for session creation
    req.app.get('io').emit('sessionCreated', {
      session: await session.populate('createdBy', 'name role')
    });

    res.status(201).json({
      message: 'Session created successfully',
      session: await session.populate('createdBy', 'name role')
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Session ID already exists. Please try again.' });
    }
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get teacher's sessions
router.get('/my-sessions', authenticate, authorize(['teacher']), async (req, res) => {
  try {
    const { limit = 20, active } = req.query;
    
    const query = { createdBy: req.user._id };
    if (active === 'true') {
      query.isActive = true;
    }

    const sessions = await Session.find(query)
      .sort({ sessionDate: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .exec();

    // Include question count for each session
    const sessionsWithCounts = await Promise.all(
      sessions.map(async (session) => {
        const questionCount = await Question.countDocuments({
          sessionId: session.sessionId,
          isActive: true
        });
        
        return {
          ...session.toObject(),
          questionCount
        };
      })
    );

    res.json({
      sessions: sessionsWithCounts,
      count: sessionsWithCounts.length
    });

  } catch (error) {
    console.error('Get my sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get all active sessions (for joining)
router.get('/active', authenticate, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const sessions = await Session.find({
      isActive: true,
      sessionDate: {
        $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      }
    })
      .sort({ sessionDate: -1 })
      .limit(parseInt(limit))
      .exec();

    res.json({
      sessions,
      count: sessions.length
    });

  } catch (error) {
    console.error('Get active sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch active sessions' });
  }
});

// Get session by ID (for validation and details)
router.get('/:sessionId', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get question count
    const questionCount = await Question.countDocuments({
      sessionId: session.sessionId,
      isActive: true
    });

    res.json({
      session: {
        ...session.toObject(),
        questionCount
      }
    });

  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to fetch session details' });
  }
});

// Update session (only by creator)
router.patch('/:sessionId', authenticate, authorize(['teacher']), validate(sessionUpdateSchema), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const updates = req.body;

    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Only creator can update
    if (session.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the session creator can update this session' });
    }

    // Update fields
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        session[key] = updates[key];
      }
    });

    // Update last activity
    session.metadata.lastActivity = new Date();
    
    await session.save();

    // Emit real-time update
    req.app.get('io').to(`session-${sessionId}`).emit('sessionUpdated', {
      session: await session.populate('createdBy', 'name role')
    });

    res.json({
      message: 'Session updated successfully',
      session: await session.populate('createdBy', 'name role')
    });

  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// End session (deactivate)
router.delete('/:sessionId', authenticate, authorize(['teacher']), async (req, res) => {
  try {
    const { sessionId } = req.params;

    console.log('Attempting to end session:', sessionId);
    console.log('User ID from token:', req.user._id);

    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    console.log('Session found:', {
      sessionId: session.sessionId,
      createdBy: session.createdBy,
      createdByType: typeof session.createdBy,
      userIdType: typeof req.user._id
    });

    // Only creator can end session - handle populated createdBy field
    const sessionCreatorId = session.createdBy._id ? session.createdBy._id.toString() : session.createdBy.toString();
    const currentUserId = req.user._id.toString();
    
    console.log('Comparing IDs (fixed):', {
      sessionCreatorId,
      currentUserId,
      areEqual: sessionCreatorId === currentUserId
    });

    if (sessionCreatorId !== currentUserId) {
      return res.status(403).json({ 
        error: 'Only the session creator can end this session',
        debug: {
          sessionCreator: sessionCreatorId,
          currentUser: currentUserId
        }
      });
    }

    // Mark as inactive and set end time
    session.isActive = false;
    session.metadata.endTime = new Date();
    await session.save();

    // Emit real-time event
    req.app.get('io').to(`session-${sessionId}`).emit('sessionEnded', {
      sessionId
    });

    res.json({ message: 'Session ended successfully' });

  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({ error: 'Failed to end session' });
  }
});

// Join session (update last activity)
router.post('/:sessionId/join', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findOne({ sessionId });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!session.isActive) {
      return res.status(410).json({ error: 'Session has ended' });
    }

    // Update last activity
    session.metadata.lastActivity = new Date();
    await session.save();

    res.json({
      message: 'Joined session successfully',
      session: await session.populate('createdBy', 'name role')
    });

  } catch (error) {
    console.error('Join session error:', error);
    res.status(500).json({ error: 'Failed to join session' });
  }
});

export default router;