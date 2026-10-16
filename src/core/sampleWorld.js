/** P0 fixture only: deliberately 4 provinces/2 nations/2 types, NOT the 50/10/20 MVP. */
import { canonicalPairKey } from './rng.js';

const species = {
  dog_shiba: {
    id: 'dog_shiba', nameJa: '柴犬族', familyId: 'canidae', animalSpeciesId: 'domestic_dog', varietyId: 'shiba',
    diet: 'omnivore', stats: {dom:55,eco:55,pow:40,def:40,mob:70,rec:85,log:60,dip:50},
    traits: ['keen_smell'],
    ecology: {size:35,foodDemand:0.7,lifespan:70,maturityAge:16,birthRate:1,preferredBiomes:['forest','plains']}
  },
  bear_brown: {
    id: 'bear_brown', nameJa: 'ヒグマ族', familyId: 'ursidae', animalSpeciesId: 'brown_bear', varietyId: null,
    diet: 'omnivore', stats: {dom:45,eco:35,pow:90,def:85,mob:38,rec:45,log:55,dip:30},
    traits: ['heavy_food_demand'],
    ecology: {size:90,foodDemand:1.5,lifespan:75,maturityAge:18,birthRate:0.8,preferredBiomes:['forest','mountains']}
  }
};

const provinces = {
  province_001: {id:'province_001',nameJa:'北熊平原',ownerNationId:'nation_001',neighbors:['province_002'],terrain:'plains',climate:'cold',populationBySpecies:{bear_brown:4000,dog_shiba:600},agriculture:30,commerce:15,development:20,fortLevel:1,publicOrder:80,foodPotential:80,materialPotential:40,garrisonArmyIds:[]},
  province_002: {id:'province_002',nameJa:'東の森',ownerNationId:'nation_001',neighbors:['province_001','province_003'],terrain:'forest',climate:'temperate',populationBySpecies:{bear_brown:2000,dog_shiba:3000},agriculture:40,commerce:25,development:30,fortLevel:1,publicOrder:70,foodPotential:65,materialPotential:60,garrisonArmyIds:['army_001']},
  province_003: {id:'province_003',nameJa:'西の境界',ownerNationId:'nation_002',neighbors:['province_002','province_004'],terrain:'hills',climate:'temperate',populationBySpecies:{bear_brown:900,dog_shiba:4500},agriculture:40,commerce:35,development:32,fortLevel:1,publicOrder:78,foodPotential:70,materialPotential:50,garrisonArmyIds:['army_002']},
  province_004: {id:'province_004',nameJa:'白犬高原',ownerNationId:'nation_002',neighbors:['province_003'],terrain:'mountains',climate:'cold',populationBySpecies:{bear_brown:1500,dog_shiba:2800},agriculture:20,commerce:30,development:24,fortLevel:2,publicOrder:84,foodPotential:40,materialPotential:90,garrisonArmyIds:[]}
};
const nations = {
  nation_001: {id:'nation_001',nameJa:'赤熊王国',color:'#9A4F38',government:'kingdom',capitalProvinceId:'province_001',rulerOfficerId:'officer_001',treasury:1000,food:2000,materials:300,stability:70,strategy:'balanced',tech:{agriculture:1,industry:1,military:1,medicine:1},foundedMonth:0,alive:true},
  nation_002: {id:'nation_002',nameJa:'白犬連邦',color:'#446D9E',government:'federation',capitalProvinceId:'province_004',rulerOfficerId:'officer_002',treasury:1100,food:2400,materials:320,stability:80,strategy:'defense',tech:{agriculture:1,industry:1,military:1,medicine:1},foundedMonth:0,alive:true}
};
const officers = {
  officer_001: {id:'officer_001',nameJa:'ガルド・灰爪',speciesId:'bear_brown',nationId:'nation_001',age:38,role:'ruler',stats:{martial:92,command:80,intellect:50,administration:40,diplomacy:45},traits:[],loyalty:80,experience:200,alive:true},
  officer_002: {id:'officer_002',nameJa:'シバ・白尾',speciesId:'dog_shiba',nationId:'nation_002',age:35,role:'ruler',stats:{martial:58,command:75,intellect:72,administration:78,diplomacy:82},traits:['keen_smell'],loyalty:90,experience:190,alive:true}
};
const armies = {
  army_001: {id:'army_001',nationId:'nation_001',provinceId:'province_002',commanderId:'officer_001',troopsBySpecies:{bear_brown:300,dog_shiba:100},morale:80,supply:90,targetProvinceId:null},
  army_002: {id:'army_002',nationId:'nation_002',provinceId:'province_003',commanderId:'officer_002',troopsBySpecies:{bear_brown:50,dog_shiba:350},morale:82,supply:88,targetProvinceId:null}
};
const pair = canonicalPairKey('nation_001','nation_002');
const relations = {
  [pair]: {nationAId:'nation_001',nationBId:'nation_002',score:-25,atWar:false,allied:false,tradeAgreement:false,truceUntilMonth:null}
};

// structuredClone or JSON clone by world.js; always fresh per game.
export const SAMPLE_WORLD_DATA = Object.freeze({provinces,nations,species,officers,armies,relations});
