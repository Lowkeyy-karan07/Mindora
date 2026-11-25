import fs from 'fs';
import path from 'path';
import { executeGeminiJsonCall, resolveModelName } from '../src/lib/ai/gemini';

function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      try {
        if (typeof process.loadEnvFile === 'function') {
          process.loadEnvFile(fullPath);
        } else {
          const content = fs.readFileSync(fullPath, 'utf8');
          for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx !== -1) {
              const k = trimmed.slice(0, eqIdx).trim();
              const v = trimmed.slice(eqIdx + 1).trim();
              if (!process.env[k]) {
                process.env[k] = v;
              }
            }
          }
        }
      } catch {
        // continue
      }
    }
  }
}

loadEnv();

async function checkAi() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    console.log('missing key');
    process.exit(1);
  }

  const modelName = resolveModelName(process.env.GEMINI_MODEL);

  const result = await executeGeminiJsonCall<{ status?: string; ok?: boolean }>({
    contents: 'Respond with valid JSON only: {"status":"ok"}',
    model: modelName,
    temperature: 0.6,
    maxOutputTokens: 2048,
    timeoutMs: 8000,
  });

  if (result.success) {
    if (result.data && typeof result.data === 'object') {
      console.log('AI OK');
      process.exit(0);
    } else {
      console.log(
        `[Diagnostic] Model: ${modelName}, Length: ${result.rawText.length}, finishReason: ${result.finishReason}, first 150 chars: "${result.rawText.slice(0, 150)}"`
      );
      console.log('bad JSON');
      process.exit(1);
    }
  } else {
    if (result.category === 'empty response') {
      console.log(
        `[Diagnostic] Model: ${modelName}, finishReason: ${result.finishReason}, blockReason: ${result.blockReason || 'none'}`
      );
    } else if (result.category === 'bad JSON' || result.category === 'request error') {
      console.log(
        `[Diagnostic] Model: ${modelName}, Length: ${result.rawText.length}, finishReason: ${result.finishReason}, first 150 chars: "${result.rawText.slice(0, 150)}"`
      );
      if (result.error) {
        const msg = result.error instanceof Error ? result.error.message : String(result.error);
        console.log(`[Diagnostic] Error: ${msg.split(apiKey).join('[REDACTED]')}`);
      }
    }
    console.log(result.category);
    process.exit(1);
  }
}

checkAi();
