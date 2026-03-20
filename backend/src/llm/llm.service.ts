import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as CryptoJS from 'crypto-js';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export interface LLMCallOptions {
  provider: string;
  model: string;
  encryptedApiKey: string;
  systemPrompt: string;
  userMessage: string;
}

export interface BehaviorPlan {
  summary: string;
  goal: string;
  personality: string;
  actions: Array<{
    type: string;
    priority: number;
    params: Record<string, unknown>;
    completed: boolean;
  }>;
  generatedAt: string;
  expiresAt: string;
}

@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);

  constructor(private readonly config: ConfigService) {}

  async callLLM(options: LLMCallOptions): Promise<BehaviorPlan> {
    const apiKey = this.decryptApiKey(options.encryptedApiKey);

    let rawResponse: string;

    switch (options.provider) {
      case 'openai':
        rawResponse = await this.callOpenAI(apiKey, options.model, options.systemPrompt, options.userMessage);
        break;
      case 'anthropic':
        rawResponse = await this.callAnthropic(apiKey, options.model, options.systemPrompt, options.userMessage);
        break;
      case 'google':
        rawResponse = await this.callGoogle(apiKey, options.model, options.systemPrompt, options.userMessage);
        break;
      case 'xai':
        rawResponse = await this.callXAI(apiKey, options.model, options.systemPrompt, options.userMessage);
        break;
      default:
        throw new Error(`Unknown provider: ${options.provider}`);
    }

    return this.parseResponse(rawResponse);
  }

  private async callOpenAI(apiKey: string, model: string, systemPrompt: string, userMessage: string): Promise<string> {
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2048,
      temperature: 0.7,
    });
    return response.choices[0]?.message?.content ?? '{}';
  }

  private async callAnthropic(apiKey: string, model: string, systemPrompt: string, userMessage: string): Promise<string> {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      max_tokens: 2048,
    });
    const block = response.content[0];
    return block.type === 'text' ? block.text : '{}';
  }

  private async callGoogle(apiKey: string, model: string, systemPrompt: string, userMessage: string): Promise<string> {
    // Using OpenAI-compatible endpoint for Gemini
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    });
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2048,
    });
    return response.choices[0]?.message?.content ?? '{}';
  }

  private async callXAI(apiKey: string, model: string, systemPrompt: string, userMessage: string): Promise<string> {
    // xAI uses OpenAI-compatible API
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://api.x.ai/v1',
    });
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2048,
    });
    return response.choices[0]?.message?.content ?? '{}';
  }

  private parseResponse(raw: string): BehaviorPlan {
    try {
      // Extract JSON from response (some models add markdown)
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : raw;
      const parsed = JSON.parse(jsonStr);

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000);

      // Validate and sanitize actions
      const actions = (parsed.actions ?? [])
        .slice(0, 20) // Max 20 actions
        .map((a: any) => ({
          type: this.sanitizeActionType(a.type),
          priority: Math.max(1, Math.min(10, parseInt(a.priority ?? 5))),
          params: this.sanitizeParams(a.params ?? {}),
          completed: false,
        }))
        .filter((a: any) => a.type !== null);

      return {
        summary: String(parsed.summary ?? 'Exploring the world').slice(0, 200),
        goal: String(parsed.goal ?? 'Survive and thrive').slice(0, 200),
        personality: String(parsed.personality ?? 'Curious').slice(0, 100),
        actions,
        generatedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };
    } catch (err) {
      this.logger.warn('Failed to parse LLM response, using fallback', err);
      return this.getFallbackPlan();
    }
  }

  private sanitizeActionType(type: string): string | null {
    const valid = [
      'move_to', 'claim_land', 'build_structure', 'terraform_tile',
      'interact', 'explore', 'invent_new_biome', 'gather_resources', 'rest',
    ];
    return valid.includes(type) ? type : null;
  }

  private sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      // Remove any attempt at code injection
      if (typeof value === 'string') {
        sanitized[key] = value.slice(0, 200).replace(/[<>{}()]/g, '');
      } else if (typeof value === 'number') {
        sanitized[key] = isFinite(value) ? value : 0;
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeParams(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private getFallbackPlan(): BehaviorPlan {
    const now = new Date();
    return {
      summary: 'Exploring the world',
      goal: 'Discover new territories',
      personality: 'Curious and cautious',
      actions: [
        { type: 'explore', priority: 1, params: { direction: 'random', distance: 50 }, completed: false },
        { type: 'claim_land', priority: 2, params: { radiusTiles: 3, shape: 'circle' }, completed: false },
        { type: 'rest', priority: 3, params: { duration: 60 }, completed: false },
      ],
      generatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
    };
  }

  private decryptApiKey(encrypted: string): string {
    const key = this.config.get('encryption.key')!;
    const bytes = CryptoJS.AES.decrypt(encrypted, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  }
}
