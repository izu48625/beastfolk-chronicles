// Read-only aggregated reports for UI and AI consumers.
// Military personnel are not stored in province.populationBySpecies; never double-count them.
import { totalPopulation, totalTroops } from './world.js';

function tally(container, speciesId, amount) {
  container[speciesId] = (container[speciesId] ?? 0) + amount;
}
function ranks(world, populationBySpecies, civilians, military) {
  const total = civilians + military;
  return Object.entries(populationBySpecies)
    .map(([speciesId, counts]) => ({
      speciesId,
      nameJa: world.species[speciesId]?.nameJa ?? speciesId,
      civilians: counts.civilians,
      military: counts.military,
      total: counts.civilians + counts.military,
      percent: total > 0 ? (counts.civilians + counts.military) / total * 100 : 0
    }))
    .sort((a, b) => b.total - a.total || a.speciesId.localeCompare(b.speciesId, 'en'));
}
export function getNationDemographics(world, nationId) {
  const nation = world.nations[nationId];
  if (!nation) throw new RangeError('unknown nationId');
  const provinces = Object.values(world.provinces)
    .filter(p => p.ownerNationId === nationId)
    .sort((a,b) => a.id.localeCompare(b.id,'en'));
  const armies = Object.values(world.armies).filter(a => a.nationId === nationId);
  const counts = {};
  const ensure = id => counts[id] ??= {civilians:0,military:0};
  let civilians = 0, military = 0;
  for (const province of provinces) {
    civilians += totalPopulation(province);
    for (const [id, value] of Object.entries(province.populationBySpecies)) ensure(id).civilians += value;
  }
  for (const army of armies) {
    military += totalTroops(army);
    for (const [id, value] of Object.entries(army.troopsBySpecies)) ensure(id).military += value;
  }
  const regionRows = provinces.map(province => {
    const localArmies = armies.filter(army => army.provinceId === province.id);
    const population = totalPopulation(province);
    const troopCount = localArmies.reduce((sum, army) => sum + totalTroops(army), 0);
    const majority = Object.entries(province.populationBySpecies)
      .sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0],'en'))[0]?.[0] ?? null;
    return {
      provinceId: province.id, nameJa: province.nameJa,
      civilians: population, military: troopCount, total: population + troopCount,
      mainSpeciesId: majority
    };
  }).sort((a,b)=>b.total-a.total || a.provinceId.localeCompare(b.provinceId,'en'));
  return {
    nationId, provinceCount: provinces.length, armyCount: armies.length,
    civilians, military, total: civilians + military,
    speciesRows: ranks(world, counts, civilians, military),
    regionRows
  };
}
export function getSpeciesDemographics(world, speciesId) {
  if (!world.species[speciesId]) throw new RangeError('unknown speciesId');
  const counts = {};
  const ensure = id => counts[id] ??= {civilians:0,military:0};
  let civilians=0, military=0;
  for (const province of Object.values(world.provinces)) {
    const value = province.populationBySpecies[speciesId] ?? 0;
    civilians += value;
    if (province.ownerNationId != null && world.nations[province.ownerNationId]) {
      ensure(province.ownerNationId).civilians += value;
    }
  }
  for (const army of Object.values(world.armies)) {
    const value = army.troopsBySpecies[speciesId] ?? 0;
    military += value;
    if (world.nations[army.nationId]) ensure(army.nationId).military += value;
  }
  const total = civilians + military;
  const nationRows = Object.entries(counts).map(([nationId,counts]) => ({
    nationId,
    nameJa:world.nations[nationId].nameJa,
    civilians:counts.civilians, military:counts.military,
    total:counts.civilians + counts.military,
    percent: total ? (counts.civilians + counts.military)/total*100 : 0
  })).sort((a,b)=>b.total-a.total || a.nationId.localeCompare(b.nationId,'en'));
  return {speciesId,civilians,military,total,nationRows};
}
