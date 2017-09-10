import { log } from '../lib/logger/log';
import { BODY_TYPES, BodyType } from './body_types';

interface Population {
  [type: string]: number;
  TOTAL: number;
}

export function spawnCreeps(room: Room): void {
  const spawns = _.filter(room.myActiveStructures, (s) => s.structureType === 'spawn') as Spawn[];
  const pop = countCreepsByType(room.myCreeps);
  log.debug(`${room} population: ${pop.TOTAL} creep(s)`);
  const missing = listMissingTypes(spawns.length, pop);
  if (missing.length > 0) {
    spawnMissingCreeps(room, missing, 1 + pop.TOTAL, spawns);
  }
}

function countCreepsByType(creeps: Creep[]): Population {
  const pop: Population = {TOTAL: 0};
  for (const type in BODY_TYPES) {
    pop[type] = 0;
  }
  for (const creep of creeps) {
    const type = creep.memory.type;
    if (!type || !(type in pop)) {
      creep.suicide();
      continue;
    }
    pop[type]++;
    pop.TOTAL++;
  }
  return pop;
}

function listMissingTypes(roomSize: number, pop: Population): BodyType[] {
  const missing: BodyType[] = [];
  _.each(BODY_TYPES, ({type, num, body, priority}) => {
    const expected = roomSize * num;
    for (let current = pop[type]; current < expected; current++) {
      missing.push(new BodyType(type, num, priority * (1.0 - current / expected), body));
    }
  });
  return missing;
}

function spawnMissingCreeps(room: Room, missing: BodyType[], maxSize: number, spawns: Spawn[]): void {
  const spawnCapacity = getSpawnCapacity(room);
  spawns = _.filter(spawns, (s) => !s.spawning);
  log.debug(
    `${room}: ${missing.length} creep(s) to spawn, ${spawns.length} available spawn(s), ${spawnCapacity}`,
   `spawn capacity, ${maxSize} maximum size`
  );
  if (!spawns.length) {
    return;
  }

  missing.sort((a: BodyType, b: BodyType) => a.priority - b.priority);

  for (const spawn of spawns) {
    const current = missing.pop();
    if (!current) {
      break;
    }
    const size = Math.min(maxSize, Math.floor(spawnCapacity / current.bodyCost), Math.floor(50 / current.body.length));
    if (!size) {
      log.debug(`${room}: not enough energy to spawn ${current}`);
      break;
    }
    const body = current.sizedBody(size);
    const result = spawn.createCreep(body, undefined, {type: current.type});
    if (typeof result !== 'string') {
      if (result !== ERR_NOT_ENOUGH_ENERGY) {
        log.debug(`${room}: cannot spawn ${current} creep of size ${size}: ${result}`);
      }
      break;
    }
    log.debug(`${room}: spawning ${current} creep of size ${size}: ${result}`);
  }
}

function getSpawnCapacity(room: Room) {
  return _.sum(
    _.map(
      _.filter(room.myActiveStructures, (s: Structure) => (
        s.structureType === 'spawn' || s.structureType === 'extension'
      )),
      (e: Structure & EnergyContainer) => e.energyCapacity
    )
  );
}