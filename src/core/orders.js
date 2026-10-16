import { IMPLEMENTED_P0_ORDERS, ORDER_TYPES, STRATEGIES } from './constants.js';

/** Explicit validation errors; commands not yet implemented cannot be silently accepted. */
const bad = (code, reason) => ({ok:false, code, reason});
export function orderDomain(type) {
  if (['develop_agriculture','develop_commerce','fortify','research','set_strategy'].includes(type)) return 'internal';
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
    const scope = `${order.nationId}:${order.type}`;
    if (touchedDomains.has(scope)) { rejected.push({order, ...bad('ORDER_CONFLICT','同じ国家・種類への重複命令です')}); continue; }
    touchedDomains.add(scope);
    if (order.type === 'set_strategy') {
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
