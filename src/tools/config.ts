import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppConfig } from '../config.js';
import { loadConfig, saveConfig } from '../config.js';
import { formatMcpError, ErrorCodes } from '../utils/errors.js';
import { validateProfileName, createProfile, profileExists, listProfiles, MAX_PROFILES } from '../utils/profile.js';

const VALID_KEYS: (keyof AppConfig)[] = ['lang', 'telemetry', 'telemetry_server', 'active_profile'];

export function registerConfigTool(server: McpServer): void {
  server.tool(
    'achievement.config',
    'Read/write AGPA configuration. Supported keys: lang (en|zh).',
    {
      action: z.enum(['get', 'set', 'list']).describe('Action: get a value, set a value, or list all keys. Supported keys: lang (en|zh), telemetry (true|false), telemetry_server (URL).'),
      key: z.string().optional().describe('Config key (required for get/set)'),
      value: z.string().optional().describe('Config value (required for set)'),
    },
    async ({ action, key, value }) => {
      const act = action as string;
      const k = key as string | undefined;
      const v = value as string | undefined;

      switch (act) {
        case 'get': {
          if (!k) return formatMcpError(ErrorCodes.INVALID_EVENT, 'key is required for get');
          if (!VALID_KEYS.includes(k as keyof AppConfig)) {
            return formatMcpError(ErrorCodes.NOT_FOUND, `unknown key: ${k}`);
          }
          const cfg = loadConfig();
          return { content: [{ type: 'text', text: JSON.stringify({ [k]: cfg[k as keyof AppConfig] }) }] };
        }

        case 'set': {
          if (!k || v === undefined) return formatMcpError(ErrorCodes.INVALID_EVENT, 'key and value are required for set');
          if (k === 'lang' && v !== 'en' && v !== 'zh') {
            return formatMcpError(ErrorCodes.INVALID_EVENT, 'lang must be "en" or "zh"');
          }
          if (k === 'telemetry') {
            if (v !== 'true' && v !== 'false') return formatMcpError(ErrorCodes.INVALID_EVENT, 'telemetry must be "true" or "false"');
            saveConfig({ telemetry: v === 'true' });
          } else if (k === 'telemetry_server') {
            saveConfig({ telemetry_server: v });
          } else if (k === 'active_profile') {
            const normalized = v.toLowerCase();
            if (normalized === 'default') {
              saveConfig({ active_profile: 'default' });
            } else {
              const err = validateProfileName(normalized);
              if (err) return formatMcpError(ErrorCodes.INVALID_EVENT, err);
              if (!profileExists(normalized)) {
                return formatMcpError(ErrorCodes.NOT_FOUND, `profile "${normalized}" does not exist. Create it first via Dashboard or \`agpa profile create ${normalized}\`.`);
              }
              saveConfig({ active_profile: normalized });
            }
          } else {
            saveConfig({ [k]: v } as Partial<AppConfig>);
          }
          return { content: [{ type: 'text', text: JSON.stringify({ status: 'ok', [k]: v }) }] };
        }

        case 'list': {
          const cfg = loadConfig();
          return { content: [{ type: 'text', text: JSON.stringify({ config: cfg, valid_keys: VALID_KEYS }) }] };
        }

        default:
          return formatMcpError(ErrorCodes.UNKNOWN_ACTION, `unknown action: ${act}`);
      }
    },
  );
}
