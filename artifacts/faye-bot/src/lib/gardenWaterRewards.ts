/** Social watering rewards are intentionally capped by the existing 3-waterings/day limit.
 * First-help is counted once per distinct other gardener per Central calendar day.
 */
export function gardenWaterReward(ownPlant: boolean, alreadyHelpedOwnerToday: boolean) {
  if (ownPlant) return { points: 1, firstHelpBonus: 0 };
  const firstHelpBonus = alreadyHelpedOwnerToday ? 0 : 2;
  return { points: 3 + firstHelpBonus, firstHelpBonus };
}
