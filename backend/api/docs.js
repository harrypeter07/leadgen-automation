// backend/api/docs.js
const express = require('express');
const router = express.Router();
const ResponseHelper = require('../modules/response');

const openApiSchema = {
  openapi: '3.0.0',
  info: {
    title: 'Outreach Intelligence SaaS API',
    description: 'API specifications for conversation tracking, business audits, AI messaging, and diagnostics.',
    version: '3.0.0'
  },
  servers: [
    { url: '/api', description: 'Base route path' }
  ],
  paths: {
    '/outreach/initialize': {
      post: {
        summary: 'Initialize outreach tracking for a lead',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['leadId'],
                properties: {
                  leadId: { type: 'string', format: 'uuid' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Outreach successfully initialized.' }
        }
      }
    },
    '/outreach/conversation/{leadId}': {
      get: {
        summary: 'Get conversation stage and contact info by lead ID',
        parameters: [
          { name: 'leadId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
        ],
        responses: {
          200: { description: 'Conversation state details.' }
        }
      }
    },
    '/outreach/message/inbound': {
      post: {
        summary: 'Handle incoming mock message from lead',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['leadId', 'body', 'channel'],
                properties: {
                  leadId: { type: 'string', format: 'uuid' },
                  body: { type: 'string' },
                  channel: { type: 'string', enum: ['whatsapp', 'email'] }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'State advanced and response recorded.' }
        }
      }
    },
    '/outreach/followups/process': {
      post: {
        summary: 'Manually trigger due followup queue task executions',
        responses: {
          200: { description: 'Queue items processed successfully.' }
        }
      }
    },
    '/outreach/meetings': {
      post: {
        summary: 'Record scheduled or completed meeting',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['leadId', 'scheduledAt'],
                properties: {
                  leadId: { type: 'string', format: 'uuid' },
                  scheduledAt: { type: 'string', format: 'date-time' },
                  durationMinutes: { type: 'integer', default: 30 },
                  notes: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Meeting logged successfully.' }
        }
      }
    },
    '/outreach/memory/{leadId}': {
      get: {
        summary: 'Retrieve memory profile details (objections, observations, insights)',
        parameters: [
          { name: 'leadId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
        ],
        responses: {
          200: { description: 'Consolidated memory logs.' }
        }
      }
    },
    '/analytics': {
      get: {
        summary: 'Fetch platform conversion statistics and health load',
        responses: {
          200: { description: 'Analytics dashboards payloads.' }
        }
      }
    }
  }
};

router.get('/', (req, res) => {
  return res.json(openApiSchema);
});

module.exports = router;
