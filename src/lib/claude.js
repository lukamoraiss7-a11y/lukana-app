/**
 * claude.js — Cliente padrão Anthropic com prompt caching
 * =========================================================
 * Importar em qualquer API route do Next.js que precise chamar Claude.
 * Este módulo é SERVER-SIDE ONLY (não importar em componentes client).
 *
 * Uso:
 *   import { callClaude } from '@/lib/claude'
 *
 *   const resposta = await callClaude({
 *     systemPrompt: 'Você é um assistente de marcenaria...',
 *     userMessage: 'Qual o prazo padrão de entrega?',
 *   })
 *
 *   // Com histórico (multi-turn):
 *   const history = []
 *   const r1 = await callClaude({ systemPrompt: SYSTEM, userMessage: 'oi', history })
 *   const r2 = await callClaude({ systemPrompt: SYSTEM, userMessage: 'e o prazo?', history })
 *
 * Caching:
 *   O systemPrompt é marcado com cache_control ephemeral.
 *   Chamadas subsequentes com o mesmo system prompt custam ~10% do input original.
 */

import Anthropic from '@anthropic-ai/sdk'

const DEFAULT_MODEL = 'claude-sonnet-4-6'
const DEFAULT_MAX_TOKENS = 4096
const MAX_HISTORY_TURNS = 6

let _client = null

function getClient() {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _client
}

function trimHistory(history) {
  if (history.length <= MAX_HISTORY_TURNS) return history
  const trimmed = history.slice(-MAX_HISTORY_TURNS)
  return trimmed[0]?.role !== 'user' ? trimmed.slice(1) : trimmed
}

/**
 * @param {object} opts
 * @param {string} opts.systemPrompt  - Instruções do sistema (cacheadas)
 * @param {string} opts.userMessage   - Mensagem do usuário
 * @param {Array}  [opts.history]     - Histórico mutável [{role, content}] (opcional)
 * @param {string} [opts.model]       - Modelo (padrão: claude-sonnet-4-6)
 * @param {number} [opts.maxTokens]   - Limite de tokens de resposta
 * @returns {Promise<string>}
 */
export async function callClaude({
  systemPrompt,
  userMessage,
  history = [],
  model = DEFAULT_MODEL,
  maxTokens = DEFAULT_MAX_TOKENS,
}) {
  const client = getClient()

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      ...trimHistory(history),
      { role: 'user', content: userMessage },
    ],
  })

  const assistantText = response.content[0].text

  // Atualiza histórico in-place
  history.push({ role: 'user', content: userMessage })
  history.push({ role: 'assistant', content: assistantText })

  return assistantText
}
