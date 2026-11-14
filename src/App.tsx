/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef } from 'react';
import { AlertCircle, Compass, Loader2, ShieldAlert } from 'lucide-react';
import crestImage from './assets/images/character_folio_crest_1794670587290.jpg';
import workbenchBg from './assets/images/alchemist_workbench_bg_1794671009365.jpg';

interface CharacterStats {
  health: number;
  mana: number;
  strength: number;
}

interface FantasyCharacter {
  id: string;
  name: string;
  characterClass: string;
  backstory: string;
  stats: CharacterStats;
}

interface SavedDeckCharacter extends FantasyCharacter {
  portraitUrl: string | null;
}

export default function App() {
  const [character, setCharacter] = useState<FantasyCharacter | null>(null);
  const [isGeneratingCharacter, setIsGeneratingCharacter] = useState(false);
  const [characterError, setCharacterError] = useState<string | null>(null);

  const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
  const [isGeneratingPortrait, setIsGeneratingPortrait] = useState(false);
  const [portraitError, setPortraitError] = useState<string | null>(null);
  const [portraitVariation, setPortraitVariation] = useState(0);

  const [deck, setDeck] = useState<SavedDeckCharacter[]>([]);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const [crestFailed, setCrestFailed] = useState(false);
  const [bgFailed, setBgFailed] = useState(false);

  const historyRef = useRef<Array<{ name: string; characterClass: string }>>([]);

  async function handleGenerateCharacter() {
    if (isGeneratingCharacter) return;

    setIsGeneratingCharacter(true);
    setCharacterError(null);
    setPortraitUrl(null);
    setPortraitError(null);
    setPortraitVariation(0);
    setSaveNotice(null);

    try {
      const response = await fetch('/api/character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previousCharacters: historyRef.current,
        }),
      });

      let payload: {
        name?: string;
        characterClass?: string;
        backstory?: string;
        stats?: CharacterStats;
        error?: string;
      } | null = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(
          payload?.error || `Request failed (${response.status}). Please try again.`,
        );
      }

      if (
        !payload?.name ||
        !payload?.characterClass ||
        !payload?.backstory ||
        !payload?.stats
      ) {
        throw new Error('Received an incomplete character record. Please try again.');
      }

      const nextCharacter: FantasyCharacter = {
        id: crypto.randomUUID(),
        name: payload.name,
        characterClass: payload.characterClass,
        backstory: payload.backstory,
        stats: {
          health: payload.stats.health,
          mana: payload.stats.mana,
          strength: payload.stats.strength,
        },
      };

      historyRef.current = [
        ...historyRef.current.slice(-49),
        { name: nextCharacter.name, characterClass: nextCharacter.characterClass },
      ];
      setCharacter(nextCharacter);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Something went wrong while generating your character. Please try again.';
      setCharacterError(message);
    } finally {
      setIsGeneratingCharacter(false);
    }
  }

  async function requestPortrait(nextVariation: number) {
    if (!character || isGeneratingPortrait || isGeneratingCharacter) return;

    setIsGeneratingPortrait(true);
    setPortraitError(null);
    setSaveNotice(null);

    try {
      const response = await fetch('/api/portrait', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: character.name,
          characterClass: character.characterClass,
          backstory: character.backstory,
          variationIndex: nextVariation,
        }),
      });

      let payload: { imageUrl?: string; error?: string } | null = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(
          payload?.error || `Portrait request failed (${response.status}). Please try again.`,
        );
      }

      if (!payload?.imageUrl) {
        throw new Error('Received no portrait image. Please try again.');
      }

      setPortraitUrl(payload.imageUrl);
      setPortraitVariation(nextVariation);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Could not generate a portrait. Please try again.';
      setPortraitError(message);
    } finally {
      setIsGeneratingPortrait(false);
    }
  }

  function handleGeneratePortrait() {
    void requestPortrait(0);
  }

  function handleRegeneratePortrait() {
    void requestPortrait(portraitVariation + 1);
  }

  function handleSaveToDeck() {
    if (!character || isGeneratingCharacter) return;

    const entry: SavedDeckCharacter = {
      ...character,
      portraitUrl,
    };

    setDeck((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === character.id);
      if (existingIndex !== -1) {
        const updated = [...prev];
        updated[existingIndex] = entry;
        return updated;
      }
      return [entry, ...prev];
    });

    setSaveNotice('Saved to My Deck');
  }

  return (
    <div
      className="relative min-h-screen w-full flex flex-col items-center px-5 py-10 sm:px-10 sm:py-12 overflow-x-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 50% 25%, #2B2015 0%, #16110C 55%, #0D0A07 100%)',
      }}
    >
      {!bgFailed && (
        <img
          src={workbenchBg}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          onError={() => setBgFailed(true)}
          className="pointer-events-none select-none fixed inset-0 w-full h-full object-cover"
        />
      )}

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 35%, rgba(28, 19, 11, 0.44) 0%, rgba(12, 9, 6, 0.85) 100%)',
        }}
      />

      <main className="relative z-10 w-full max-w-5xl flex flex-col items-center gap-12">
        <header className="text-center space-y-2 max-w-xl">
          <h1
            className="font-display text-3xl sm:text-4xl font-bold tracking-wide text-[#F6E8CC] drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]"
            style={{ textWrap: 'balance' }}
          >
            Fantasy Character Creator
          </h1>
          <p className="text-sm sm:text-base text-[#DECAA3] leading-relaxed drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]">
            Forge an original hero card, craft a portrait, and collect your party below.
          </p>
        </header>

        {/* Single Bordered RPG Trading Card */}
        <article
          aria-label="Character Player Card"
          className="relative w-full max-w-[540px] rounded-xl border-2 border-[#A8823B] p-2.5 shadow-[0_28px_70px_rgba(0,0,0,0.82)]"
          style={{
            background:
              'linear-gradient(145deg, #B88E44 0%, #7C5B24 50%, #9F7833 100%)',
          }}
        >
          <div
            className="relative w-full rounded-lg border border-[#7A5922] text-[#23180D] p-6 sm:p-7 shadow-[inset_0_0_36px_rgba(128,88,32,0.18)]"
            style={{
              background:
                'linear-gradient(180deg, #F6EBD2 0%, #EFE0BE 55%, #E7D2A7 100%)',
            }}
          >
            {/* Brass corner rivets */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-2.5 left-2.5 w-2 h-2 rounded-full border border-[#6E4F1B] bg-[#C99B42]"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-2.5 right-2.5 w-2 h-2 rounded-full border border-[#6E4F1B] bg-[#C99B42]"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-2.5 left-2.5 w-2 h-2 rounded-full border border-[#6E4F1B] bg-[#C99B42]"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-2.5 right-2.5 w-2 h-2 rounded-full border border-[#6E4F1B] bg-[#C99B42]"
            />

            {/* Card Header: Name & Class */}
            <div className="pb-4 border-b border-[#8C682F]/35">
              {characterError && (
                <div
                  role="alert"
                  className="mb-4 flex items-start gap-2.5 rounded-md border border-[#9E3A2B]/50 bg-[#FBEAE6] px-3.5 py-3 text-[#6E1D12]"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="text-xs sm:text-sm leading-relaxed">
                    <p className="font-semibold">Unable to generate character</p>
                    <p className="text-[#822417] mt-0.5">{characterError}</p>
                  </div>
                </div>
              )}

              {isGeneratingCharacter ? (
                <div role="status" aria-live="polite" className="space-y-3">
                  <div className="space-y-1.5">
                    <span className="block text-xs font-semibold text-[#5A4223]">Name</span>
                    <div className="h-8 w-56 rounded bg-[#D7C091]/70 animate-pulse" />
                  </div>
                  <div className="space-y-1.5">
                    <span className="block text-xs font-semibold text-[#5A4223]">Class</span>
                    <div className="h-5 w-32 rounded bg-[#D7C091]/70 animate-pulse" />
                  </div>
                  <span className="sr-only">Generating character...</span>
                </div>
              ) : character ? (
                <dl aria-live="polite" className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <dt className="text-xs font-semibold text-[#5A4223]">Name</dt>
                    <dd className="font-display text-2xl sm:text-3xl font-bold text-[#1F140A] tracking-wide leading-tight break-words">
                      {character.name}
                    </dd>
                  </div>
                  <div className="space-y-1 text-right shrink-0">
                    <dt className="text-xs font-semibold text-[#5A4223]">Class</dt>
                    <dd className="text-base sm:text-lg font-bold text-[#7D3C0C] tracking-tight">
                      {character.characterClass}
                    </dd>
                  </div>
                </dl>
              ) : (
                <dl className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <dt className="text-xs font-semibold text-[#5A4223]">Name</dt>
                    <dd className="font-display text-xl sm:text-2xl font-bold text-[#5A4223]">
                      Unclaimed Hero
                    </dd>
                  </div>
                  <div className="space-y-1 text-right shrink-0">
                    <dt className="text-xs font-semibold text-[#5A4223]">Class</dt>
                    <dd className="text-base font-semibold text-[#5A4223]">Unassigned</dd>
                  </div>
                </dl>
              )}
            </div>

            {/* Card Artwork & Portrait Section */}
            <div className="py-5 border-b border-[#8C682F]/35 space-y-3.5">
              <div className="relative aspect-square w-full max-w-[300px] mx-auto rounded-md overflow-hidden border-2 border-[#9E7B3B] bg-[#DFCCA4] flex items-center justify-center shadow-[inset_0_2px_10px_rgba(35,24,13,0.18)]">
                {isGeneratingPortrait ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="flex flex-col items-center justify-center gap-3 px-6 text-center text-[#3D2C16]"
                  >
                    <Loader2 className="w-8 h-8 animate-spin text-[#87500C]" aria-hidden="true" />
                    <span className="text-sm font-medium">Painting character portrait...</span>
                  </div>
                ) : portraitUrl ? (
                  <img
                    src={portraitUrl}
                    alt={
                      character
                        ? `Cartoon RPG portrait of ${character.name} the ${character.characterClass}`
                        : 'Generated character portrait'
                    }
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : !crestFailed ? (
                  <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
                    <img
                      src={crestImage}
                      alt="Engraved heraldic compass, quill, and sword emblem"
                      referrerPolicy="no-referrer"
                      onError={() => setCrestFailed(true)}
                      className="w-28 h-28 object-cover mix-blend-multiply opacity-75"
                    />
                    <p className="text-xs font-medium text-[#5A4223]">
                      {character
                        ? 'Select Generate to paint a character portrait'
                        : 'Generate a character first to unlock portraits'}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-[#5A4223]">
                    <Compass className="w-10 h-10" aria-hidden="true" />
                    <p className="text-xs font-medium">
                      {character
                        ? 'Select Generate to paint a character portrait'
                        : 'Generate a character first to unlock portraits'}
                    </p>
                  </div>
                )}
              </div>

              {portraitError && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-md border border-[#9E3A2B]/50 bg-[#FBEAE6] px-3.5 py-2.5 text-[#6E1D12]"
                >
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-xs leading-relaxed">{portraitError}</p>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-xs font-semibold tracking-wide text-[#5A4223]">
                  Portrait
                </span>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleGeneratePortrait}
                    disabled={!character || isGeneratingCharacter || isGeneratingPortrait}
                    className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-2 rounded-md border border-[#8C682F] bg-[#E8D5AC] text-[#2B1D0E] text-xs font-semibold transition-colors duration-150 hover:bg-[#DFC690] active:bg-[#D4B77A] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#87500C] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Generate
                  </button>
                  <button
                    type="button"
                    onClick={handleRegeneratePortrait}
                    disabled={!character || isGeneratingCharacter || isGeneratingPortrait}
                    className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-2 rounded-md border border-[#8C682F] bg-[#E8D5AC] text-[#2B1D0E] text-xs font-semibold transition-colors duration-150 hover:bg-[#DFC690] active:bg-[#D4B77A] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#87500C] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Regenerate
                  </button>
                </div>
              </div>
            </div>

            {/* Stats Bar: Health, Mana, Strength */}
            <div className="py-4 border-b border-[#8C682F]/35">
              {isGeneratingCharacter ? (
                <div className="grid grid-cols-3 divide-x divide-[#8C682F]/30 text-center">
                  {(['Health', 'Mana', 'Strength'] as const).map((label) => (
                    <div key={label} className="px-2 space-y-1.5">
                      <span className="block text-xs font-semibold text-[#5A4223]">{label}</span>
                      <div className="h-7 w-12 mx-auto rounded bg-[#D7C091]/70 animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : (
                <dl className="grid grid-cols-3 divide-x divide-[#8C682F]/30 text-center">
                  <div className="px-2 space-y-0.5">
                    <dt className="text-xs font-semibold text-[#5A4223]">Health</dt>
                    <dd className="text-xl sm:text-2xl font-bold tabular-nums text-[#7C1D13]">
                      {character ? character.stats.health : '--'}
                    </dd>
                  </div>
                  <div className="px-2 space-y-0.5">
                    <dt className="text-xs font-semibold text-[#5A4223]">Mana</dt>
                    <dd className="text-xl sm:text-2xl font-bold tabular-nums text-[#1E4E79]">
                      {character ? character.stats.mana : '--'}
                    </dd>
                  </div>
                  <div className="px-2 space-y-0.5">
                    <dt className="text-xs font-semibold text-[#5A4223]">Strength</dt>
                    <dd className="text-xl sm:text-2xl font-bold tabular-nums text-[#7D3C0C]">
                      {character ? character.stats.strength : '--'}
                    </dd>
                  </div>
                </dl>
              )}
            </div>

            {/* Backstory Section */}
            <div className="py-4 border-b border-[#8C682F]/35 min-h-[100px] flex flex-col justify-center">
              <p className="text-xs font-semibold text-[#5A4223] mb-1.5">Backstory</p>
              {isGeneratingCharacter ? (
                <div className="space-y-2">
                  <div className="h-4 w-full rounded bg-[#D7C091]/70 animate-pulse" />
                  <div className="h-4 w-4/5 rounded bg-[#D7C091]/70 animate-pulse" />
                </div>
              ) : character ? (
                <p className="text-sm text-[#2D1F11] leading-relaxed">{character.backstory}</p>
              ) : (
                <p className="text-sm text-[#5A4223]">
                  Press Generate Character to reveal this hero&apos;s origins and abilities.
                </p>
              )}
            </div>

            {/* Card Footer Actions: Generate Character & Save to Deck */}
            <div className="pt-5 space-y-3">
              {saveNotice && (
                <p role="status" className="text-xs font-semibold text-[#3F5D24] text-right">
                  {saveNotice}
                </p>
              )}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleGenerateCharacter}
                  disabled={isGeneratingCharacter}
                  aria-busy={isGeneratingCharacter}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-md border border-[#6E450A] bg-gradient-to-b from-[#B97A1E] to-[#87500C] text-[#FFFBEB] text-sm font-semibold tracking-wide shadow-[0_2px_8px_rgba(61,36,5,0.35),inset_0_1px_0_rgba(255,232,163,0.4)] transition-all duration-150 hover:from-[#C78524] hover:to-[#94580E] active:from-[#7A480A] active:to-[#693D08] disabled:opacity-70 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B97A1E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EFE0BE] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isGeneratingCharacter && (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  )}
                  <span>Generate Character</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveToDeck}
                  disabled={!character || isGeneratingCharacter}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-md border border-[#7A5922] bg-[#2D2011] text-[#F6E8CC] text-sm font-semibold tracking-wide shadow-sm transition-colors duration-150 hover:bg-[#3C2B17] active:bg-[#21170B] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#87500C] focus-visible:ring-offset-2 focus-visible:ring-offset-[#EFE0BE] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Save to Deck
                </button>
              </div>
            </div>
          </div>
        </article>

        {/* My Deck Section */}
        <section aria-label="My Deck" className="w-full space-y-5">
          <div className="flex items-baseline justify-between border-b border-[#A47E3B]/40 pb-3">
            <h2 className="font-display text-2xl font-bold text-[#F6E8CC] tracking-wide">
              My Deck
            </h2>
            <span className="text-xs sm:text-sm font-medium text-[#DECAA3] tabular-nums">
              {deck.length} {deck.length === 1 ? 'card' : 'cards'} saved
            </span>
          </div>

          {deck.length === 0 ? (
            <p className="text-sm text-[#DECAA3]/85 py-6 text-center">
              Your deck is empty. Generate a character and select Save to Deck to collect cards here.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {deck.map((card) => (
                <article
                  key={card.id}
                  className="rounded-lg border border-[#A8823B] p-1.5 shadow-[0_14px_32px_rgba(0,0,0,0.65)]"
                  style={{
                    background:
                      'linear-gradient(145deg, #B88E44 0%, #7C5B24 50%, #9F7833 100%)',
                  }}
                >
                  <div
                    className="h-full rounded-md border border-[#7A5922] p-4 text-[#23180D] flex flex-col gap-3.5"
                    style={{
                      background:
                        'linear-gradient(180deg, #F6EBD2 0%, #EFE0BE 60%, #E7D2A7 100%)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-[#8C682F]/30 pb-2.5">
                      <h3 className="font-display text-lg font-bold text-[#1F140A] leading-snug break-words min-w-0">
                        {card.name}
                      </h3>
                      <span className="text-xs font-bold text-[#7D3C0C] shrink-0 pt-1">
                        {card.characterClass}
                      </span>
                    </div>

                    <div className="aspect-square w-full rounded overflow-hidden border border-[#9E7B3B] bg-[#DFCCA4] flex items-center justify-center">
                      {card.portraitUrl ? (
                        <img
                          src={card.portraitUrl}
                          alt={`Portrait of ${card.name}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-1.5 p-4 text-center text-[#5A4223]">
                          <Compass className="w-8 h-8 opacity-75" aria-hidden="true" />
                          <span className="text-xs font-medium">No portrait</span>
                        </div>
                      )}
                    </div>

                    <dl className="grid grid-cols-3 divide-x divide-[#8C682F]/30 text-center border-y border-[#8C682F]/30 py-2">
                      <div>
                        <dt className="text-[11px] font-semibold text-[#5A4223]">Health</dt>
                        <dd className="text-sm font-bold tabular-nums text-[#7C1D13]">
                          {card.stats.health}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold text-[#5A4223]">Mana</dt>
                        <dd className="text-sm font-bold tabular-nums text-[#1E4E79]">
                          {card.stats.mana}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] font-semibold text-[#5A4223]">Strength</dt>
                        <dd className="text-sm font-bold tabular-nums text-[#7D3C0C]">
                          {card.stats.strength}
                        </dd>
                      </div>
                    </dl>

                    <p className="text-xs text-[#2D1F11] leading-relaxed">
                      {card.backstory}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
