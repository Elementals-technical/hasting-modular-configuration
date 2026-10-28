const CHANNELS = [
    'snap',
    'collision'
];
/**
 * Per-instance geometry job tracker (public-api.md §6, §10).
 *
 * - `accept(runner, { parentCommandSequence, channel })` accepts a job immediately before the
 *   provider invocation, assigns a monotonic `jobSequence` and hands the runner a token whose
 *   `isCurrent()` reports whether a later invalidation/rebind/destroy superseded the job.
 * - `supersede(channel?)` bumps one channel's generation, or every generation when omitted.
 * - `whenSettled(jobWatermark, commandWatermark)` resolves once every job through the job
 *   watermark and every child job whose parent command is covered by the command watermark
 *   (even when accepted after the barrier) has finished, rejected or been superseded.
 */ const createSpatialJobTrackerV1 = ()=>{
    let acceptedWatermark = 0;
    let settledWatermark = 0;
    let globalGeneration = 0;
    const channelGenerations = new Map(CHANNELS.map((channel)=>[
            channel,
            0
        ]));
    const active = new Map();
    const generationOf = (channel)=>channel === null || channel === undefined ? globalGeneration : channelGenerations.get(channel) ?? globalGeneration;
    const settle = (sequence)=>{
        active.delete(sequence);
        while(settledWatermark < acceptedWatermark && !active.has(settledWatermark + 1)){
            settledWatermark += 1;
        }
    };
    const accept = (runner, { parentCommandSequence = null, channel = null } = {})=>{
        acceptedWatermark += 1;
        const sequence = acceptedWatermark;
        const generation = generationOf(channel);
        const token = Object.freeze({
            sequence,
            generation,
            channel,
            parentCommandSequence,
            isCurrent: ()=>generationOf(channel) === generation,
            currentGeneration: ()=>generationOf(channel)
        });
        const promise = Promise.resolve().then(()=>runner(token)).finally(()=>settle(sequence));
        active.set(sequence, {
            sequence,
            parentCommandSequence,
            channel,
            promise
        });
        return promise;
    };
    const supersede = (channel)=>{
        if (channel === null || channel === undefined) {
            globalGeneration += 1;
            for (const key of channelGenerations.keys()){
                channelGenerations.set(key, channelGenerations.get(key) + 1);
            }
            return globalGeneration;
        }
        if (!channelGenerations.has(channel)) {
            channelGenerations.set(channel, 0);
        }
        channelGenerations.set(channel, channelGenerations.get(channel) + 1);
        return channelGenerations.get(channel);
    };
    const covered = (job, jobWatermark, commandWatermark)=>job.sequence <= jobWatermark || commandWatermark !== null && job.parentCommandSequence !== null && job.parentCommandSequence <= commandWatermark;
    const whenSettled = async (jobWatermark = acceptedWatermark, commandWatermark = null)=>{
        for(;;){
            const next = [
                ...active.values()
            ].find((job)=>covered(job, jobWatermark, commandWatermark));
            if (!next) {
                return;
            }
            await next.promise.catch(()=>{});
        }
    };
    return Object.freeze({
        accept,
        supersede,
        whenSettled,
        generationOf,
        get acceptedWatermark () {
            return acceptedWatermark;
        },
        get settledWatermark () {
            return settledWatermark;
        },
        get generation () {
            return globalGeneration;
        }
    });
};

export { createSpatialJobTrackerV1 };
