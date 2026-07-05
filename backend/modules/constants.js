// backend/modules/constants.js

const STAGES = {
  LEAD_QUALIFIED: 'lead_qualified',
  OUTREACH_STARTED: 'outreach_started',
  OUTREACH_FAILED: 'outreach_failed',
  NURTURING: 'nurturing',
  DEMO_SCHEDULED: 'demo_scheduled',
  CONVERTED: 'converted',
  LOST: 'lost',
};

const CHANNELS = {
  WHATSAPP: 'whatsapp',
  EMAIL: 'email',
  SMS: 'sms',
  CALL: 'call',
};

const MESSAGE_DIRECTIONS = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
};

const FOLLOWUP_STATUSES = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const MEETING_STATUSES = {
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  NO_SHOW: 'no_show',
  CANCELLED: 'cancelled',
};

const CLASSIFICATIONS = {
  POSITIVE: 'positive',
  NEUTRAL: 'neutral',
  NEGATIVE: 'negative',
  STOP: 'stop',
};

module.exports = {
  STAGES,
  CHANNELS,
  MESSAGE_DIRECTIONS,
  FOLLOWUP_STATUSES,
  MEETING_STATUSES,
  CLASSIFICATIONS,
};
