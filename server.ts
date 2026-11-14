import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const CULTURAL_ROOTS = [
  'Norse-inspired',
  'Celtic-inspired',
  'Byzantine-inspired',
  'Andalusian-inspired',
  'Persian-inspired',
  'Slavic-inspired',
  'Gaelic-inspired',
  'Anatolian-inspired',
  'Mediterranean-inspired',
  'Highland-inspired',
  'Archipelago-inspired',
  'Steppe-inspired',
  'Saharan-inspired',
  'Alpine-inspired',
  'Estuary-inspired',
  'Astral-inspired',
];

const FANTASY_CLASSES = [
  'Mage',
  'Rogue',
  'Warrior',
  'Paladin',
  'Ranger',
  'Druid',
  'Bard',
  'Cleric',
  'Necromancer',
  'Warlock',
  'Sorcerer',
  'Monk',
  'Alchemist',
  'Artificer',
  'Berserker',
  'Spellsword',
  'Inquisitor',
  'Chronomancer',
  'Warden',
  'Battlemage',
];

const PORTRAIT_VARIATIONS = [
  'dramatic three-quarter heroic bust pose with warm amber torchlight',
  'dynamic front-facing character portrait with mystical glowing runes in the background',
  'expressive action-ready portrait with swirling alchemical embers and cool twilight rim light',
  'detailed stylized character close-up with ornate class gear and painted tavern lantern glow',
  'bold video game hero select portrait with crisp cel-shaded highlights and deep atmospheric backdrop',
  'stylized RPG character portrait framed by subtle arcane mist and rich painterly brushwork',
];

interface CharacterStats {
  health: number;
  mana: number;
  strength: number;
}

interface CharacterPayload {
  name: string;
  characterClass: string;
  backstory: string;
  stats: CharacterStats;
}

interface PreviousCharacterInput {
  name?: unknown;
  characterClass?: unknown;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function pickRandom<T>(items: T[]): T {
  const index = crypto.randomInt(0, items.length);
  return items[index];
}

function generateRandomStats(): CharacterStats {
  return {
    health: crypto.randomInt(1, 101),
    mana: crypto.randomInt(1, 101),
    strength: crypto.randomInt(1, 101),
  };
}

function extractErrorDetails(err: unknown, context: 'character' | 'portrait'): {
  status: number;
  message: string;
} {
  const fallbackMessage =
    err instanceof Error ? err.message : 'Unable to reach the Gemini service.';

  if (fallbackMessage.includes('GEMINI_API_KEY')) {
    return {
      status: 500,
      message: 'Server configuration error: Gemini API key is missing.',
    };
  }

  const rawStatus =
    typeof err === 'object' && err !== null && typeof (err as Record<string, unknown>).status === 'number'
      ? ((err as Record<string, unknown>).status as number)
      : undefined;

  if (
    rawStatus === 401 ||
    rawStatus === 403 ||
    fallbackMessage.includes('PERMISSION_DENIED') ||
    fallbackMessage.includes('API_KEY_INVALID')
  ) {
    return {
      status: 403,
      message:
        'The Gemini API key was rejected or lacks permission. Please check your API key in Settings > Secrets.',
    };
  }

  if (rawStatus === 429 || fallbackMessage.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message:
        context === 'portrait'
          ? 'Portrait generation quota reached or requires a billing-enabled API key in Settings > Secrets.'
          : 'Rate limit reached while generating a character. Please wait a moment and try again.',
    };
  }

  if (rawStatus && rawStatus >= 400 && rawStatus < 600) {
    return {
      status: rawStatus,
      message:
        context === 'portrait'
          ? 'Portrait generation failed due to an upstream service error. Please try again.'
          : 'Character generation failed due to an upstream service error. Please try again.',
    };
  }

  return {
    status: 502,
    message:
      context === 'portrait'
        ? 'Could not generate a portrait right now. Please try again.'
        : 'Could not generate a character right now. Please try again.',
  };
}

async function generateUniqueCharacter(
  ai: GoogleGenAI,
  excludedNames: Set<string>,
  recentClasses: string[],
): Promise<CharacterPayload> {
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const entropySeed = crypto.randomBytes(6).toString('hex');
    const culturalRoot = pickRandom(CULTURAL_ROOTS);
    const availableClasses = FANTASY_CLASSES.filter(
      (cls) => !recentClasses.slice(-3).some((recent) => normalizeText(recent) === normalizeText(cls)),
    );
    const suggestedClass = pickRandom(availableClasses.length > 0 ? availableClasses : FANTASY_CLASSES);
    const excludedList = Array.from(excludedNames).slice(-40);

    const promptLines = [
      'Create one original, memorable fantasy RPG character.',
      `Use a ${culturalRoot} linguistic feel for the name and invent an evocative first name (and optional surname or epithet, 1 to 3 words total).`,
      `Suggested class direction (feel free to use this or another classic/distinct fantasy class): ${suggestedClass}.`,
      'Also write a vivid 2-sentence backstory describing their origin, defining deed, or alchemical/arcane motivation.',
      `Uniqueness seed: ${entropySeed}-${attempt}.`,
    ];

    if (excludedList.length > 0) {
      promptLines.push(
        `CRITICAL: You MUST NOT use any of these previously generated names or close variations: ${excludedList.join(', ')}.`,
      );
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: promptLines.join('\n'),
      config: {
        systemInstruction:
          'You are a fantasy RPG character creator. Return a single JSON object with "name" (a distinct, pronounceable fantasy character name, 1-3 words), "characterClass" (a concise 1-2 word fantasy class such as Mage, Rogue, Warrior, Paladin, Ranger, Druid, Alchemist, Necromancer, Bard), and "backstory" (2 crisp, evocative sentences). Never repeat excluded names.',
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: 'A unique, original fantasy character name (1-3 words).',
            },
            characterClass: {
              type: Type.STRING,
              description: 'A single fantasy RPG class (e.g., Mage, Rogue, Warrior, Paladin, Ranger).',
            },
            backstory: {
              type: Type.STRING,
              description: 'A concise 2-sentence fantasy character backstory.',
            },
          },
          required: ['name', 'characterClass', 'backstory'],
        },
      },
    });

    const rawText = (response.text ?? '').trim();
    if (!rawText) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      continue;
    }

    if (typeof parsed !== 'object' || parsed === null) {
      continue;
    }

    const candidate = parsed as Record<string, unknown>;
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    const characterClass =
      typeof candidate.characterClass === 'string' ? candidate.characterClass.trim() : '';
    const backstory =
      typeof candidate.backstory === 'string' ? candidate.backstory.trim() : '';

    if (!name || !characterClass || !backstory) {
      continue;
    }

    if (!excludedNames.has(normalizeText(name))) {
      return {
        name,
        characterClass,
        backstory,
        stats: generateRandomStats(),
      };
    }
  }

  throw new Error('Could not generate a unique character after multiple attempts.');
}

async function generateCharacterPortrait(
  ai: GoogleGenAI,
  name: string,
  characterClass: string,
  backstory: string,
  variationIndex?: number,
): Promise<string> {
  const entropy = crypto.randomBytes(4).toString('hex');
  const styleCue =
    typeof variationIndex === 'number'
      ? PORTRAIT_VARIATIONS[variationIndex % PORTRAIT_VARIATIONS.length]
      : pickRandom(PORTRAIT_VARIATIONS);

  const promptParts = [
    `Stylized cartoon video game character portrait of ${name}, a fantasy ${characterClass}.`,
    backstory ? `Character context: ${backstory}` : '',
    `Composition and mood: ${styleCue}.`,
    'Vibrant hand-painted fantasy RPG game art style, bold expressive outlines, rich color contrast, detailed costume and class equipment, centered head-and-shoulders trading card portrait, no text, no watermark, no frame.',
    `Variation seed: ${entropy}.`,
  ].filter(Boolean);

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite-image',
    contents: {
      parts: [
        {
          text: promptParts.join(' '),
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: '1:1',
      },
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      const mime = part.inlineData.mimeType ?? 'image/png';
      return `data:${mime};base64,${part.inlineData.data}`;
    }
  }

  throw new Error('Image generation returned no portrait data.');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '128kb' }));

  const recentServerNames = new Set<string>();

  app.post('/api/character', async (req, res) => {
    try {
      const ai = getGeminiClient();

      const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as {
        previousCharacters?: PreviousCharacterInput[];
      };

      const excludedNames = new Set<string>(recentServerNames);
      const recentClasses: string[] = [];

      if (Array.isArray(body.previousCharacters)) {
        for (const item of body.previousCharacters.slice(-50)) {
          if (typeof item?.name === 'string' && item.name.trim()) {
            excludedNames.add(normalizeText(item.name));
          }
          if (typeof item?.characterClass === 'string' && item.characterClass.trim()) {
            recentClasses.push(item.characterClass.trim());
          }
        }
      }

      const character = await generateUniqueCharacter(ai, excludedNames, recentClasses);

      recentServerNames.add(normalizeText(character.name));
      if (recentServerNames.size > 200) {
        const firstEntry = recentServerNames.values().next().value;
        if (firstEntry) {
          recentServerNames.delete(firstEntry);
        }
      }

      res.json(character);
    } catch (err) {
      console.error('Character generation error:', err);
      const { status, message } = extractErrorDetails(err, 'character');
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/portrait', async (req, res) => {
    try {
      const ai = getGeminiClient();
      const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as {
        name?: unknown;
        characterClass?: unknown;
        backstory?: unknown;
        variationIndex?: unknown;
      };

      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const characterClass =
        typeof body.characterClass === 'string' ? body.characterClass.trim() : '';
      const backstory = typeof body.backstory === 'string' ? body.backstory.trim() : '';
      const variationIndex =
        typeof body.variationIndex === 'number' ? body.variationIndex : undefined;

      if (!name || !characterClass) {
        res.status(400).json({
          error: 'Generate a character first before creating a portrait.',
        });
        return;
      }

      const imageUrl = await generateCharacterPortrait(
        ai,
        name,
        characterClass,
        backstory,
        variationIndex,
      );

      res.json({ imageUrl });
    } catch (err) {
      console.error('Portrait generation error:', err);
      const { status, message } = extractErrorDetails(err, 'portrait');
      res.status(status).json({ error: message });
    }
  });

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
