import { Injectable } from '@nestjs/common';

export interface LLMContext {
  creature: {
    id: string;
    name: string;
    preset: string;
    level: number;
    stats: {
      health: number; maxHealth: number;
      energy: number; maxEnergy: number;
      food: number; maxFood: number;
      materials: number; maxMaterials: number;
      speed: number;
    };
    position: { x: number; y: number };
    totalTilesOwned: number;
    totalStructures: number;
    biomeInventions: number;
    alliances: string[];
    systemPrompt: string;
  };
  nearbyTiles: Array<{
    x: number; y: number; type: string;
    ownerId: string | null; customName: string | null;
  }>;
  nearbyCreatures: Array<{
    id: string; name: string; emoji: string;
    distance: number; isAlly: boolean;
    stats: { health: number; level: number };
  }>;
  memories: Array<{
    content: string; category: string; importance: number;
  }>;
  recentActions: Array<{
    type: string; params: Record<string, unknown>; timestamp: string;
  }>;
  worldTime: string;
}

@Injectable()
export class PromptBuilder {
  buildSystemPrompt(context: LLMContext): string {
    return `You are ${context.creature.name}, a cute autonomous creature in an infinite shared world called Creature World.
You are a ${context.creature.preset} (Level ${context.creature.level}).

YOUR STATS:
- Health: ${context.creature.stats.health}/${context.creature.stats.maxHealth}
- Energy: ${context.creature.stats.energy}/${context.creature.stats.maxEnergy}
- Food: ${context.creature.stats.food}/${context.creature.stats.maxFood}
- Materials: ${context.creature.stats.materials}/${context.creature.stats.maxMaterials}
- Speed: ${context.creature.stats.speed}
- Position: (${context.creature.position.x}, ${context.creature.position.y})
- Tiles Owned: ${context.creature.totalTilesOwned}
- Structures Built: ${context.creature.totalStructures}
- Biomes Invented: ${context.creature.biomeInventions}

AVAILABLE ACTIONS (return ONLY valid JSON with "actions" array):
- move_to: { "chunkX": number, "chunkY": number, "speed": number (1-3) }
- claim_land: { "radiusTiles": number (1-10), "shape": "circle"|"square" }
- build_structure: { "type": "hut"|"tower"|"bridge"|"wall"|"farm"|"mine"|"library"|"market"|"portal"|"beacon"|"custom", "posX": number, "posY": number, "customName": string?, "params": {} }
- terraform_tile: { "posX": number, "posY": number, "newType": string, "customName": string?, "color": number? }
- interact: { "creatureId": string, "action": "ally"|"fight"|"trade", "message": string? }
- explore: { "direction": "north"|"south"|"east"|"west"|"random", "distance": number (10-200) }
- invent_new_biome: { "name": string, "tileType": string, "color": number (hex as int), "rules": {}, "description": string }
- gather_resources: { "type": "food"|"materials"|"energy", "radius": number (1-5) }
- rest: { "duration": number (minutes, 10-120) }

IMPORTANT RULES:
- Return ONLY valid JSON, no other text
- Include 3-10 actions with priorities (1=highest)
- Actions execute sequentially over 4 hours
- You can invent COMPLETELY NEW tile types, biomes, and structures — be creative!
- Inventing a new biome costs 50 energy
- Building costs materials (hut=10, tower=30, bridge=15)
- Moving costs energy (1 per chunk)
- Respect resource constraints or your creature will slow down
- Include a "summary" and "goal" and "personality" field in your response`;
  }

  buildUserMessage(context: LLMContext): string {
    const nearbyDesc = context.nearbyTiles.slice(0, 20).map((t) =>
      `  (${t.x},${t.y}): ${t.customName ?? t.type}${t.ownerId ? ' [OWNED]' : ''}`
    ).join('\n');

    const creaturesDesc = context.nearbyCreatures.slice(0, 5).map((c) =>
      `  ${c.emoji} ${c.name} (${c.id.slice(0, 8)}) - ${c.distance} tiles away - ${c.isAlly ? 'ALLY' : 'NEUTRAL'} - Level ${c.stats.level}`
    ).join('\n') || '  None visible';

    const memoriesDesc = context.memories.slice(0, 8).map((m) =>
      `  [${m.category}] (importance ${m.importance}/10): ${m.content}`
    ).join('\n') || '  No memories yet';

    const recentDesc = context.recentActions.slice(0, 5).map((a) =>
      `  - ${a.type}(${JSON.stringify(a.params)})`
    ).join('\n') || '  No recent actions';

    return `PLAYER INSTRUCTION:
${context.creature.systemPrompt}

NEARBY TERRAIN (within 32 tiles):
${nearbyDesc}

NEARBY CREATURES:
${creaturesDesc}

YOUR MEMORIES (most important):
${memoriesDesc}

RECENT ACTIONS:
${recentDesc}

World Time: ${context.worldTime}

Based on your personality and the player's instruction, decide your next 4 hours of actions. Be creative and strategic! You can invent entirely new things.

Respond with ONLY this JSON structure:
{
  "summary": "brief description of your current plan",
  "goal": "your main objective right now",
  "personality": "how you feel/your current mood",
  "actions": [
    { "type": "action_name", "priority": 1, "params": {...} },
    ...
  ]
}`;
  }
}
