import mongoose from 'mongoose';
import { z } from 'zod';

// Zod validation schema for Question (author is populated from authenticated user)
export const questionValidationSchema = z.object({
  text: z.string().min(1, 'Question text is required').max(500, 'Question too long'),
  sessionId: z.string().min(1, 'Session ID is required'),
  course: z.string().min(1, 'Course is required').max(100, 'Course name too long')
});

export const questionUpdateSchema = z.object({
  status: z.enum(['unanswered', 'answered', 'important'], 'Invalid status'),
  isImportant: z.boolean().optional()
}).partial();

// MongoDB Schema
const questionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: String,
    required: true,
    trim: true
  },
  course: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  status: {
    type: String,
    enum: ['unanswered', 'answered', 'important'],
    default: 'unanswered'
  },
  isImportant: {
    type: Boolean,
    default: false
  },
  color: {
    type: String,
    enum: ['yellow', 'pink', 'blue', 'green', 'purple'],
    default: 'yellow'
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  lectureDate: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    ipAddress: String,
    userAgent: String
  }
}, {
  timestamps: true
});

// Indexes for performance and duplicate prevention
questionSchema.index({ author: 1, sessionId: 1, text: 1 }, { unique: true }); // Prevent duplicates
questionSchema.index({ sessionId: 1, createdAt: -1 }); // Session queries
questionSchema.index({ status: 1, isImportant: -1 }); // Status filtering
questionSchema.index({ course: 1, lectureDate: -1 }); // Course queries
questionSchema.index({ isActive: 1 }); // Active questions only

// Pre-populate author details when querying
questionSchema.pre(/^find/, function() {
  this.populate('author', 'name email role');
});

export const Question = mongoose.model('Question', questionSchema);