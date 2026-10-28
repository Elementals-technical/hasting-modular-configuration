const fail=code=>Object.assign(new Error(code),{code});

/** Tracks public legacy commands from entry, including time spent in their queue and
 * the subsequent composition-rule settle. The lifecycle handoff reads activeCount
 * and whenIdle; it never relies on an aggregator that may not have started yet.
 */
export function createLegacyLineWriteBarrier(app){
    if(!app||typeof app!=='object')throw fail('INVALID_APPLICATION');
    let count=0;
    const listeners=new Set();
    const changed=()=>{for(const wake of [...listeners])wake();};
    const settle=timeoutMs=>app.compositionManager?.aggregator?.whenIdle?.(timeoutMs);
    const beforeDeadline=async(promise,deadline)=>{
        const remaining=deadline-Date.now();
        if(remaining<=0)throw fail('LEGACY_LINE_BUSY');
        let timer;
        try{return await Promise.race([Promise.resolve(promise),new Promise((_,reject)=>{
            timer=setTimeout(()=>reject(fail('LEGACY_LINE_BUSY')),remaining);
        })]);}finally{clearTimeout(timer);}
    };
    const barrier=Object.freeze({
        get activeCount(){return count;},
        async whenIdle(timeoutMs=10000){
            if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw fail('INVALID_TIMEOUT');
            const deadline=Date.now()+timeoutMs;
            while(true){
                if(count===0){
                    const settled=await beforeDeadline(settle(deadline-Date.now()),deadline);
                    if(settled===false)throw fail('LEGACY_LINE_BUSY');
                    if(count===0)return true;
                }
                const remaining=deadline-Date.now();
                if(remaining<=0)throw fail('LEGACY_LINE_BUSY');
                await new Promise((resolve,reject)=>{
                    const wake=()=>{clearTimeout(timer);listeners.delete(wake);resolve();};
                    const timer=setTimeout(()=>{listeners.delete(wake);reject(fail('LEGACY_LINE_BUSY'));},remaining);
                    listeners.add(wake);
                    if(count===0)wake();
                });
            }
        },
        wrap(api,names){
            for(const name of names){
                const original=api?.[name];if(typeof original!=='function')continue;
                api[name]=function(...args){
                    count++;changed();
                    let result;
                    try{result=original.apply(this,args);}catch(error){
                        // A synchronous rejection may still have scheduled aggregation.
                        Promise.resolve().then(settle).catch(()=>{}).finally(()=>{count--;changed();});
                        throw error;
                    }
                    const completion=Promise.resolve(result).then(settle);
                    if(result&&typeof result.then==='function'){
                        return completion.then(()=>result).finally(()=>{count--;changed();});
                    }
                    completion.catch(()=>{}).finally(()=>{count--;changed();});
                    return result;
                };
            }
        }
    });
    return barrier;
}
