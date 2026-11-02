const AppError = require('../../utils/appError');

// Valid status transitions map
const VALID_TRANSITIONS = {
  proposed: ['pending_approval', 'cancelled'],
  pending_approval: ['approved', 'rejected', 'cancelled', 'needs_review'],
  approved: ['queued', 'executing', 'rejected', 'pending_approval', 'cancelled'], // pending_approval if edited
  rejected: ['needs_review', 'pending_approval'],
  queued: ['executing', 'failed', 'cancelled'],
  executing: ['completed', 'failed'],
  completed: [], // Terminal state - immutable once confirmed by external provider
  failed: ['needs_review', 'approved', 'queued', 'executing'], // Can retry or review
  needs_review: ['pending_approval', 'rejected', 'approved', 'cancelled'],
  cancelled: [],
};

const APPROVAL_ROLES = ['admin', 'manager'];
const EXECUTION_ROLES = ['admin', 'manager'];
const VIEW_ROLES = ['admin', 'manager', 'rep'];

/**
 * Validate status transition
 */
const canTransition = (currentStatus, newStatus) => {
  if (currentStatus === newStatus) return true;
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  return allowed.includes(newStatus);
};

/**
 * Enforce role permission for approval
 */
const canUserApprove = (userRole) => {
  return APPROVAL_ROLES.includes(userRole);
};

/**
 * Enforce role permission for execution
 */
const canUserExecute = (userRole) => {
  return EXECUTION_ROLES.includes(userRole);
};

/**
 * Enforce role permission for viewing
 */
const canUserView = (userRole) => {
  return VIEW_ROLES.includes(userRole);
};

module.exports = {
  VALID_TRANSITIONS,
  APPROVAL_ROLES,
  EXECUTION_ROLES,
  VIEW_ROLES,
  canTransition,
  canUserApprove,
  canUserExecute,
  canUserView,
};
