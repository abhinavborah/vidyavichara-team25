import mongoose from 'mongoose';
import { z } from 'zod';

// Zod validation schema for Session creation
export const sessionValidationSchema = z.object({
  courseName: z.string().min(1, 'Course name is required').max(50, 'Course name too long'),
  sessionDate: z.string().optional(), // ISO date string, defaults to today
  description: z.string().max(200, 'Description too long').optional()
});

export const sessionUpdateSchema = z.object({
  courseName: z.string().min(1, 'Course name is required').max(50, 'Course name too long').optional(),
  description: z.string().max(200, 'Description too long').optional(),
  isActive: z.boolean().optional()
}).partial();

// MongoDB Schema
const sessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 20
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courseName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  sessionDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  description: {
    type: String,
    trim: true,
    maxlength: 200
  },
  isActive: {
    type: Boolean,
    default: true
  },
  questionCount: {
    type: Number,
    default: 0
  },
  metadata: {
    startTime: Date,
    endTime: Date,
    lastActivity: Date
  }
}, {
  timestamps: true
});

// Indexes for performance (sessionId index already created by unique: true)
sessionSchema.index({ createdBy: 1, sessionDate: -1 }); // Teacher's sessions
sessionSchema.index({ isActive: 1, sessionDate: -1 }); // Active sessions

// Pre-populate teacher details when querying
sessionSchema.pre(/^find/, function() {
  this.populate('createdBy', 'name email role');
});

// Generate human-readable session ID: COURSE-MMMDD-001 format
export const generateSessionId = async (courseName, sessionDate = new Date()) => {
  const date = new Date(sessionDate);
  
  // Extract course code (first 3-4 characters, uppercase)
  const courseCode = courseName
    .replace(/[^A-Za-z0-9]/g, '') // Remove special characters
    .substring(0, 4)
    .toUpperCase()
    .padEnd(3, 'X'); // Ensure at least 3 characters
  
  // Format: MMM-DD (e.g., SEP26, JAN01)
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = months[date.getMonth()];
  const day = String(date.getDate()).padStart(2, '0');
  const dateCode = `${month}${day}`;
  
  // Find existing sessions for this course and date to generate sequence number
  const basePattern = `${courseCode}-${dateCode}`;
  const existingSessions = await Session.find({
    sessionId: { $regex: `^${basePattern}-\\d{3}$` }
  }).sort({ sessionId: -1 }).limit(1);
  
  let sequence = 1;
  if (existingSessions.length > 0) {
    const lastSessionId = existingSessions[0].sessionId;
    const lastSequence = parseInt(lastSessionId.split('-')[2]);
    sequence = lastSequence + 1;
  }
  
  const sequenceCode = String(sequence).padStart(3, '0');
  return `${basePattern}-${sequenceCode}`;
};

export const Session = mongoose.model('Session', sessionSchema);