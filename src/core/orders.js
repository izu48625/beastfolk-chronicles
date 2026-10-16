import { IMPLEMENTED_P0_ORDERS, ORDER_TYPES, STRATEGIES } from './constants.js';
import {OFFICER_SLOTS, hireCandidate, assignOfficer, recruitCaptive} from '../systems/officers.js';

/** Explicit validation errors; commands not yet implemented cannot be silently accepted. */
const bad = (code, reason) => ({ok:false, code, reason});
export function orderDomain(type) {
  if (['develop_agriculture','develop_commerce','fortify','research','set_strategy','hire_candidate','assign_officer','recruit_captive'].includes(type)) return 'internal';
  if (['recruit','move_army','attack'].includes(type)) return 'military';
  return 'diplomacy';
}

export function validateOrder(world, order) {
  if (!order || typeof order !== 'object' || Array.isArray(order)) return bad('INVALID_ORDER','命令オブジェクトが不正です');
  if (typeof order.id !== 'string' || !order.id) return bad('INVALID_ID','命令IDがありません');
  if (!['ai','player'].includes(order.issuer)) return bad('INVALID_ISSUER','命令元は ai または player のみです');
  if (!world?.nations?.[order.nationId]?.alive) return bad('NATION_NOT_ALIVE','存在しないか滅亡した国家です');
  if (!ORDER_TYPES.includes(order.type)) return bad('UNKNOWN_ORDER','未定義の命令です');
  if (order.submittedMonth !== world.monthIndex) return bad('WRONG_MONTH','命令の提出月が現在月と一致しません');
  if (!order.params || typeof order.params !== 'object' || Array.isArray(order.params)) return bad('INVALID_PARAMS','params はオブジェクトが必要です');
  if (order.issuer === 'player' && (world.player.mode !== 'intervention' || world.player.selectedNationId !== order.nationId)) {
    return bad('NO_PLAYER_CONTROL','介入先として選んだ国家にのみ命令できます');
  }
  if (order.type === 'set_strategy' && !STRATEGIES.includes(order.params.strategy)) {
    return bad('INVALID_STRATEGY','有効な国家方針を指定してください');
  }
  if (['hire_candidate','assign_officer','recruit_captive'].includes(order.type)) {
    const p=order.targetProvinceId==null?null:world.provinces[order.targetProvinceId];
    const slot=order.params.slot;
    if(order.targetProvinceId!=null && (p?.ownerNationId!==order.nationId || !OFFICER_SLOTS.includes(slot)))
      return bad('INVALID_ASSIGNMENT','配属地域または役職が不正です');
    if(order.type==='assign_officer' && order.targetProvinceId==null)
      return bad('INVALID_ASSIGNMENT','配属地域を指定してください');
    if(order.targetProvinceId!=null && p.slots[slot]===world.nations[order.nationId].rulerOfficerId &&
       (order.type!=='assign_officer'||order.params.officerId!==p.slots[slot]))
      return bad('RULER_POST','君主の地域担当を交代できません');
    if(order.type==='hire_candidate' && world.officerCandidates?.[order.params.candidateId]?.nationId!==order.nationId)
      return bad('UNKNOWN_CANDIDATE','この国に所属する登用候補ではありません');
    if(order.type==='assign_officer' &&
       (!world.officers[order.params.officerId]?.alive||
        world.officers[order.params.officerId]?.nationId!==order.nationId||
        !['active','reserve'].includes(world.officers[order.params.officerId]?.status)))
      return bad('INVALID_OFFICER','配置できない武将です');
    if(order.type==='recruit_captive' &&
       (world.officers[order.params.officerId]?.status!=='captive'||
        world.officers[order.params.officerId]?.captorNationId!==order.nationId))
      return bad('UNKNOWN_CAPTIVE','この国が登用できる捕虜ではありません');
  }
  if (!IMPLEMENTED_P0_ORDERS.includes(order.type)) return bad('NOT_IMPLEMENTED',`${order.type} は担当Phaseで実装予定です`);
  return {ok:true};
}

/** P0 resolver handles only set_strategy; future handlers belong to AI-2/AI-3. */
export function resolveOrders(world, orders, _rng) {
  const accepted = [], rejected = [], events = [];
  const usedIds = new Set();
  const touchedDomains = new Set();
  // Resolve proposals deterministically: country/type, player before AI, then ID.
  // Do not depend on input list order (AI enumeration order may differ).
  const sortedOrders = [...orders].sort((a,b) => {
    const key = o => `${String(o?.nationId ?? "")}\u0000${String(o?.type ?? "")}`;
    const ka = key(a), kb = key(b);
    const byScope = ka < kb ? -1 : ka > kb ? 1 : 0;
    if (byScope) return byScope;
    if (a?.issuer !== b?.issuer) return a?.issuer === "player" ? -1 : 1;
    const ia = String(a?.id ?? ''), ib = String(b?.id ?? '');
    return ia < ib ? -1 : ia > ib ? 1 : 0;
  });
  for (const order of sortedOrders) {
    const valid = validateOrder(world, order);
    if (!valid.ok) { rejected.push({order, ...valid}); continue; }
    if (usedIds.has(order.id)) { rejected.push({order, ...bad('DUPLICATE_ID','命令IDが重複しています')}); continue; }
    usedIds.add(order.id);
    // At P0 only one strategy-changing order per nation/month.
    const target=order.type==='hire_candidate'?order.params.candidateId:
      ['assign_officer','recruit_captive'].includes(order.type)?order.params.officerId:'';
    const scope = `${order.nationId}:${order.type}:${target}`;
    if (touchedDomains.has(scope)) { rejected.push({order, ...bad('ORDER_CONFLICT','同じ国家・種類への重複命令です')}); continue; }
    touchedDomains.add(scope);
    if (order.type === 'hire_candidate' || order.type === 'assign_officer' || order.type === 'recruit_captive') {
      const eventStart=world.events.length;
      try{
        if(order.type==='hire_candidate')hireCandidate(world,order.nationId,order.params.candidateId,order.targetProvinceId??null,order.params.slot??null,order.issuer);
        if(order.type==='assign_officer')assignOfficer(world,order.nationId,order.params.officerId,order.targetProvinceId,order.params.slot,{issuer:order.issuer});
        if(order.type==='recruit_captive')recruitCaptive(world,order.nationId,order.params.officerId,order.targetProvinceId??null,order.params.slot??null,order.issuer);
        events.push(...world.events.splice(eventStart));
        accepted.push(order);
      } catch(error){
        rejected.push({order,...bad('OFFICER_ACTION_FAILED',String(error?.message??error))});
        // Validation happens before any mutation. Rollbacks for multi-step operations are unnecessary here.
        // A rejected order must not generate events.
        world.events.splice(eventStart);
      }
    } else if (order.type === 'set_strategy') {
      const nation = world.nations[order.nationId];
      const previous = nation.strategy;
      nation.strategy = order.params.strategy;
      accepted.push(order);
      if (previous !== nation.strategy) {
        events.push({
          id:`event_${String(world.nextIds.event++).padStart(6,'0')}`, monthIndex:world.monthIndex,
          type:'strategy_changed', nationIds:[order.nationId], provinceIds:[], officerIds:[], speciesIds:[],
          payload:{from:previous,to:nation.strategy,issuer:order.issuer},
          summaryJa:`${nation.nameJa}の方針が変更された`
        });
      }
    }
  }
  return {world, events, acceptedOrders:accepted, rejectedOrders:rejected};
}
