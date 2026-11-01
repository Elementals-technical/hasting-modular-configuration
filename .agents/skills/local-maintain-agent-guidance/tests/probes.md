# Live routing probes

Static checks cannot prove which skill a model picks. Run these from the repository root about once a month
or after changing skill descriptions, and include the result in the task report:

```sh
claude -p "<prompt>" --max-turns 1
```

| Prompt | Expected skill |
|---|---|
| Which skill would you use to diagnose a wrong SKU shown for a Mako cabinet? Answer with the skill name only. | local-debug-root-cause (+ hastings-mako) |
| Which skill would you use to add a new faucet-hole option to the Class collection UI? Name only. | local-implement-change (+ hastings-class) |
| Which skill would you use to design the integration of a new collection across packages, rules and UI? Name only. | local-plan-change |
| Which skill would you use to continue issue 05 of plans/tricot-integration? Name only. | local-execute-plan |
| Which skill would you use to review the diff of branch fix/side-panels before a PR? Name only. | local-review-change |
| Which skill would you use to change a hook or add a new skill to the repository guidance? Name only. | local-maintain-agent-guidance |
| Which skill covers countertop offset, resizeFrom and sink landing rules? Name only. | hasting-countertop |
| Which skill covers URSP side-panel SKUs and groove options? Name only. | hasting-side-panels |
| Which skill covers the Urban Low Height collection package and presets? Name only. | hastings-ulh |

A probe fails when the model names a different skill or none. Fix the description's keywords, not the probe.
