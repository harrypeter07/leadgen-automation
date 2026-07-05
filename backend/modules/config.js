// backend/modules/config.js
require('dotenv').config();

const requiredEnv = ['DATABASE_URL'];

if (process.env.NODE_ENV === 'production') {
  requiredEnv.push('GEMINI_API_KEY');
}

for (const envName of requiredEnv) {
  if (!process.env[envName]) {
    throw new Error(`[Config Error] Missing required environment variable: ${envName}`);
  }
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL,
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
  whatsappServiceUrl: process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3002',
  whatsappApiSecret: process.env.WHATSAPP_API_SECRET || '',
  logLevel: process.env.LOG_LEVEL || 'info',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  isTest: (process.env.NODE_ENV || 'development') === 'test',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  features: {
    ai: process.env.FEATURE_FLAG_AI !== 'false',
    research: process.env.FEATURE_FLAG_RESEARCH !== 'false',
    followups: process.env.FEATURE_FLAG_FOLLOWUPS !== 'false',
    analytics: process.env.FEATURE_FLAG_ANALYTICS !== 'false',
  }
};

module.exports = config;
