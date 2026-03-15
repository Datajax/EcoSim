# EcoSim Ecological Analysis
*Based on top-5 configurations from 5000k2 two-phase tuning run*
*Configs: Perm-6-96%, Perm-7-87%, Perm-8-59%, Perm-9-62%, Perm-12-96%*
*100 confirmation runs each, max 7500 ticks*

---

## Primary Finding: Carnivore Extinction as the Dominant Failure Mode

In every configuration, carnivores caused **84–100% of all collapses**. Plants and herbivores almost never went extinct first. This is one of the most ecologically valid results in the simulation.

In the real world, apex predators are universally the most extinction-prone trophic level. They exist at low population densities, require large energy inputs, reproduce slowly, and are acutely sensitive to prey fluctuations. This is why real conservation biology overwhelmingly focuses on top predators — wolves, tigers, sharks, large felids — not herbivores or plants.

---

## Parameter Patterns That Align with Real Ecology

### 1. Carnivores Are Slow (speed = 1 in all 5 configs)
Every surviving configuration has minimum carnivore speed, while herbivores run at 6–8. This reflects the real asymmetry where prey species evolve high burst speed for escape while predators evolve endurance, ambush, or cooperative hunting. A predator faster than all prey drives the prey to extinction — the simulation discovered this constraint empirically without it being programmed in.

### 2. Overly Efficient Predators Destabilize the Ecosystem
Perm-8 has the highest kill chance (0.95) and is the least stable (59%). Perm-12 has the lowest kill chance (0.55) and ties for most stable (96%). This directly mirrors a well-documented real-world phenomenon: introduced predators with no evolved prey-escape relationship cause extinction cascades (rats on island ecosystems, Nile perch in Lake Victoria). Predator-prey pairs that co-evolved tend toward a stable "arms race" balance, not 95% kill efficiency.

| Config      | Kill Chance | 7500-tick Survival |
|-------------|-------------|-------------------|
| Perm-8-59%  | 0.95        | 59%               |
| Perm-9-62%  | 0.85        | 62%               |
| Perm-7-87%  | 0.70        | 87%               |
| Perm-6-96%  | 0.90        | 96%               |
| Perm-12-96% | 0.55        | 96%               |

*Note: Perm-6 achieves 96% despite kill=0.90 due to very high herbivore mateChance (0.95) compensating — prey resilience offsets predator efficiency.*

### 3. High Herbivore Perception (27–30 in all configs)
Prey animals are among the most vigilant creatures in nature — zebras, deer, and rabbits have wide fields of view, acute senses, and nearly constant predator monitoring. The simulation converges to near-maximum herbivore perception in all stable configurations, independently of any instruction to do so.

### 4. Herbivore Mating Thresholds Are Low
Threshold values of 10–17 out of 85–120 nutrient max means herbivores reproduce even when only 10–20% fed. This matches the **r-selected species strategy** (rabbits, mice, small ungulates) — high reproductive output as a buffer against predation pressure. The two 96% configs reinforce this: Perm-6 has mateChance=0.95, while Perm-12 has a lower threshold (12/119 ≈ 10%). Both achieve the same stability through different paths to the same outcome: herbivore population resilience.

### 5. Trophic Pyramid Ratios
Stable configurations settle at roughly **Plants : Herbivores : Carnivores ≈ 60 : 10 : 1** by initial count. Real ecosystems show 10:1 to 100:1 prey-to-predator ratios depending on the system. The ~10:1 herbivore-to-carnivore ratio is consistent with biomass pyramid constraints.

### 6. Low Carnivore Reproduction Rates (mateChance = 0.25–0.40)
Top predators in nature reproduce slowly — lions raise 1–4 cubs every 2 years, great white sharks produce 2–10 pups every 2–3 years. The simulation stabilizes with carnivores that reproduce rarely, which is ecologically accurate and emerges without being explicitly constrained.

### 7. Two Paths to the Same Stability
Perm-6 and Perm-12 both achieve 96% survival through different parameter profiles:
- **Perm-6**: High herbivore mateChance (0.95) + high kill chance (0.90) — prey out-reproduce the losses from efficient predation
- **Perm-12**: Low herbivore mateChance (0.60) + low kill chance (0.55) — predation pressure is low enough that moderate reproduction suffices

This mirrors real-world ecosystem variation: high-productivity prey + aggressive predators (e.g., African savanna) vs. low-productivity prey + cautious predators (e.g., boreal forest) can both be stable.

---

## Where the Simulation Diverges from Reality

### 1. No Lotka-Volterra Oscillations
Real predator-prey systems (Isle Royale wolves/moose, Canadian lynx/snowshoe hare) show damped oscillating cycles over decades before potential collapse. The flat "survived or didn't" outcome here suggests the simulation may reach a steady state rather than cycling. This is likely because the simulation lacks the temporal lag effects (gestation time, age structure, juvenile mortality) that drive oscillations.

### 2. No Age or Sex Structure
Every herbivore reproduces identically regardless of age. Real populations have juvenile mortality, sex ratios, and senescence — all of which affect stability dynamics. A population of all elderly individuals can collapse even with high birth rates.

### 3. Instantaneous Reproduction
Offspring appear in the same tick as mating. In reality, gestation and development time create a natural delay between environmental conditions and population response. This lag is a key driver of the oscillation cycles noted above and buffers populations against rapid environmental change.

### 4. Plants Don't Compete With Each Other
Plant growth rate is fixed regardless of local density. Real vegetation has density-dependent growth (competition for light, water, nutrients), which creates more complex feedback loops with the herbivore population and can produce boom-bust plant cycles.

### 5. Flat, Homogeneous Landscape
The 256×256 grid has no refugia, habitat patches, or terrain variation. Real ecosystems have spatial structure that allows prey to escape into safe zones, predators to establish territories, and local extinction to be reversed by recolonization. This absence likely makes the simulation more fragile than comparable real systems.

---

## Summary Verdict

The simulation is **ecologically coherent at the macro level**. Three of the most important real-world principles emerge without being explicitly programmed:

1. **Apex predators are the most fragile trophic level** — carnivores drive 84–100% of all collapses
2. **Predator efficiency above a threshold causes ecosystem collapse** — kill chance correlates inversely with stability
3. **Prey resilience (reproduction rate, vigilance) is the primary stabilizing force** — high herbivore perception and low mating thresholds are universal among stable configs

The main gap is the absence of population oscillations, which would require temporal lag effects from age structure or seasonal variation. For a grid-based agent simulation with no explicit ecological rules beyond energy gain/loss and reproduction thresholds, the emergent behavior matches real ecology more than it diverges from it.
