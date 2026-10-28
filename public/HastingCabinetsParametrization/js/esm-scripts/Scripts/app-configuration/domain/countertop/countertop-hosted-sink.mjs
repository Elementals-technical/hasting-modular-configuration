/**
 * Countertop-hosted sink (ULH, rule HR-CT-02 in docs/rules-manifest.md): a lifted top that carries the sink takes the sink off its sink base
 * (`cabinets.liftSink`: SB → SC) and hosts it until it lands over a side cabinet (`cabinets.landSink`: SC → SB).
 * Shared names only — the runtime document, the Top_Solid scene rule, the assembly resolver and the adapter all read them.
 */ /** Basin-top config key: the hosted sink's sub-product type (moved from the SB's `sinkType`). Presence = the top hosts the sink. */ const COUNTERTOP_SINK_TYPE_KEY = 'CountertopSinkType';
/** Basin-top config key: `{ x, y, z }` — the hosted sink anchor's position in the countertop root's local frame (metres). */ const COUNTERTOP_SINK_LOCAL_KEY = 'CountertopSinkLocalM';
/** Anchor entity created under the countertop root; its single live child is the hosted sink. */ const COUNTERTOP_SINK_POINT_NAME = 'Countertop_SinkPoint';
/** Whether a basin-top config (plain object or snapshot with `get`) hosts the sink. */ function isHostedSinkConfig(config) {
    const value = typeof config?.get === 'function' ? config.get(COUNTERTOP_SINK_TYPE_KEY) : config?.[COUNTERTOP_SINK_TYPE_KEY];
    return typeof value === 'string' && value.length > 0;
}

export { COUNTERTOP_SINK_LOCAL_KEY, COUNTERTOP_SINK_POINT_NAME, COUNTERTOP_SINK_TYPE_KEY, isHostedSinkConfig };
