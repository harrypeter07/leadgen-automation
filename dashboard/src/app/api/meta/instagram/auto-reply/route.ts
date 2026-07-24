import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/meta/instagram/auto-reply
// Returns auto-reply settings: rules, chatbot enabled status, chatbot persona, prompt instructions, delays, session thresholds, and ending talk instructions
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('meta_config')
      .select('key, value')
      .in('key', [
        'AUTO_REPLY_RULES',
        'AI_CHATBOT_ENABLED',
        'AI_CHATBOT_PERSONA',
        'SAVED_CHATBOT_PERSONAS',
        'AI_FIRST_REPLY_DELAY',
        'AI_CONVERSATION_DELAY',
        'AI_STATIC_REPLY_OVERRIDE',
        'AI_STATIC_REPLY_ENABLED',
        'AI_RESPONSE_LENGTH',
        'AI_FIRST_TURN_INSTRUCTION',
        'AI_ONGOING_TURN_INSTRUCTION',
        'AI_SYSTEM_RULES',
        'AI_SUBSCRIPTION_LINK',
        'AI_CONVERSATION_MAX_DURATION_MINS',
        'AI_CONVERSATION_MAX_TURNS',
        'AI_SESSION_INACTIVITY_HOURS',
        'AI_ENDING_TALK_INSTRUCTION'
      ])

    if (error) throw error

    const settings: Record<string, string> = {}
    for (const row of data || []) {
      settings[row.key] = row.value || ''
    }

    let rules = []
    try {
      rules = settings.AUTO_REPLY_RULES ? JSON.parse(settings.AUTO_REPLY_RULES) : []
    } catch {}

    let personas = []
    try {
      personas = settings.SAVED_CHATBOT_PERSONAS ? JSON.parse(settings.SAVED_CHATBOT_PERSONAS) : []
    } catch {}

    return NextResponse.json({
      success: true,
      rules,
      chatbotEnabled: settings.AI_CHATBOT_ENABLED === 'true',
      chatbotPersona: settings.AI_CHATBOT_PERSONA || '',
      personas,
      firstReplyDelay: settings.AI_FIRST_REPLY_DELAY !== undefined ? Number(settings.AI_FIRST_REPLY_DELAY) : 5,
      conversationDelay: settings.AI_CONVERSATION_DELAY !== undefined ? Number(settings.AI_CONVERSATION_DELAY) : 2,
      staticReply: settings.AI_STATIC_REPLY_OVERRIDE || '',
      staticReplyEnabled: settings.AI_STATIC_REPLY_ENABLED === 'true',
      responseLength: settings.AI_RESPONSE_LENGTH || 'small',
      firstTurnInstruction: settings.AI_FIRST_TURN_INSTRUCTION || `CONTEXT: FIRST MESSAGE FROM A NEW STRANGER (NEW IG DM)\nThis is the very FIRST message from this user. Greet them in a sweet, lovely, warm, and welcoming way like a real girl receiving a fresh DM. Say something cute, lovely, and short like "Heyy! Boliye? 😊✨", "Hii! How are you? ❤️", or "Hey! Thanks for messaging ✨". DO NOT act like you already know them well, and DO NOT ask heavy personal questions or how their whole day went yet on message #1.`,
      ongoingTurnInstruction: settings.AI_ONGOING_TURN_INSTRUCTION || `CONTEXT: ONGOING CONVERSATION\nContinue the chat naturally based on the previous dialogue history.`,
      systemRules: settings.AI_SYSTEM_RULES || `CRITICAL INSTRUCTIONS (NEVER BREAK THESE):\n- DYNAMIC LANGUAGE MATCHING (CRITICAL): Detect the exact language of the user's latest message (e.g. Romanian, English, Spanish, Hindi/Hinglish, French, German, etc.) and ALWAYS reply in the VERY SAME LANGUAGE as the sender! Never switch languages randomly.\n- Output ONLY your direct conversational message to the user.\n- DO NOT include internal reasoning, thought options (e.g. *Draft 1:*), explanations, quotes, or markdown asterisks.\n- Speak naturally like a real human. Never sound like a chatbot.`,
      subscriptionLink: settings.AI_SUBSCRIPTION_LINK || `https://smritishans.mywebsite.social/`,
      maxDurationMins: settings.AI_CONVERSATION_MAX_DURATION_MINS !== undefined ? Number(settings.AI_CONVERSATION_MAX_DURATION_MINS) : 3,
      maxTurns: settings.AI_CONVERSATION_MAX_TURNS !== undefined ? Number(settings.AI_CONVERSATION_MAX_TURNS) : 6,
      inactivityHours: settings.AI_SESSION_INACTIVITY_HOURS !== undefined ? Number(settings.AI_SESSION_INACTIVITY_HOURS) : 1,
      endingTalkInstruction: settings.AI_ENDING_TALK_INSTRUCTION || `CONTEXT: MAXIMUM CONVERSATION DURATION/TURNS REACHED FOR THIS CHAT SESSION\nWrap up the conversation warmly and naturally in the user's language. Say you have to leave for some work or rest now and will chat later ("Arey g, abhi mujhe kaam hai! Bye bye, later baat karte hain ❤️✨" or equivalent in sender's language). Do not ask more open questions.`
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/meta/instagram/auto-reply
// Saves rules, chatbot status, persona, instructions, delays, session thresholds, and ending instructions
export async function POST(req: NextRequest) {
  try {
    const { 
      rules, 
      chatbotEnabled, 
      chatbotPersona, 
      personas, 
      firstReplyDelay, 
      conversationDelay, 
      staticReply, 
      staticReplyEnabled, 
      responseLength,
      firstTurnInstruction,
      ongoingTurnInstruction,
      systemRules,
      subscriptionLink,
      maxDurationMins,
      maxTurns,
      inactivityHours,
      endingTalkInstruction
    } = await req.json()

    const rows = []

    if (rules !== undefined) {
      rows.push({
        key: 'AUTO_REPLY_RULES',
        value: JSON.stringify(rules),
        encrypted: false,
        updated_at: new Date().toISOString(),
      })
    }

    if (chatbotEnabled !== undefined) {
      rows.push({
        key: 'AI_CHATBOT_ENABLED',
        value: chatbotEnabled ? 'true' : 'false',
        encrypted: false,
        updated_at: new Date().toISOString(),
      })
    }

    if (chatbotPersona !== undefined) {
      rows.push({
        key: 'AI_CHATBOT_PERSONA',
        value: chatbotPersona,
        encrypted: false,
        updated_at: new Date().toISOString(),
      })
    }

    if (personas !== undefined) {
      rows.push({
        key: 'SAVED_CHATBOT_PERSONAS',
        value: JSON.stringify(personas),
        encrypted: false,
        updated_at: new Date().toISOString(),
      })
    }

    if (firstReplyDelay !== undefined) {
      rows.push({
        key: 'AI_FIRST_REPLY_DELAY',
        value: String(firstReplyDelay),
        encrypted: false,
        updated_at: new Date().toISOString(),
      })
    }

    if (conversationDelay !== undefined) {
      rows.push({
        key: 'AI_CONVERSATION_DELAY',
        value: String(conversationDelay),
        encrypted: false,
        updated_at: new Date().toISOString(),
      })
    }

    if (staticReply !== undefined) {
      rows.push({
        key: 'AI_STATIC_REPLY_OVERRIDE',
        value: staticReply,
        encrypted: false,
        updated_at: new Date().toISOString(),
      })
    }

    if (staticReplyEnabled !== undefined) {
      rows.push({
        key: 'AI_STATIC_REPLY_ENABLED',
        value: staticReplyEnabled ? 'true' : 'false',
        encrypted: false,
        updated_at: new Date().toISOString(),
      })
    }

    if (responseLength !== undefined) {
      rows.push({
        key: 'AI_RESPONSE_LENGTH',
        value: responseLength,
        encrypted: false,
        updated_at: new Date().toISOString(),
      })
    }

    if (firstTurnInstruction !== undefined) {
      rows.push({
        key: 'AI_FIRST_TURN_INSTRUCTION',
        value: firstTurnInstruction,
        encrypted: false,
        updated_at: new Date().toISOString(),
      })
    }

    if (ongoingTurnInstruction !== undefined) {
      rows.push({
        key: 'AI_ONGOING_TURN_INSTRUCTION',
        value: ongoingTurnInstruction,
        encrypted: false,
        updated_at: new Date().toISOString(),
      })
    }

    if (systemRules !== undefined) {
      rows.push({
        key: 'AI_SYSTEM_RULES',
        value: systemRules,
        encrypted: false,
        updated_at: new Date().toISOString(),
      })
    }

    if (subscriptionLink !== undefined) {
      rows.push({
        key: 'AI_SUBSCRIPTION_LINK',
        value: subscriptionLink,
        encrypted: false,
        updated_at: new Date().toISOString(),
      })
    }

    if (maxDurationMins !== undefined) {
      rows.push({
        key: 'AI_CONVERSATION_MAX_DURATION_MINS',
        value: String(maxDurationMins),
        encrypted: false,
        updated_at: new Date().toISOString(),
      })
    }

    if (maxTurns !== undefined) {
      rows.push({
        key: 'AI_CONVERSATION_MAX_TURNS',
        value: String(maxTurns),
        encrypted: false,
        updated_at: new Date().toISOString(),
      })
    }

    if (inactivityHours !== undefined) {
      rows.push({
        key: 'AI_SESSION_INACTIVITY_HOURS',
        value: String(inactivityHours),
        encrypted: false,
        updated_at: new Date().toISOString(),
      })
    }

    if (endingTalkInstruction !== undefined) {
      rows.push({
        key: 'AI_ENDING_TALK_INSTRUCTION',
        value: endingTalkInstruction,
        encrypted: false,
        updated_at: new Date().toISOString(),
      })
    }

    if (rows.length > 0) {
      const { error } = await supabaseAdmin.from('meta_config').upsert(rows, { onConflict: 'key' })
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
