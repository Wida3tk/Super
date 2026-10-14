import { resolveLifecycleStage } from "./stages";
import { MAIN_STAGES, EXCEPTIONAL_ACTIONS, mainStageIndex } from "./presentation";
// Presentation only: never infer completion from the hours counter.
export function directoryState(t: any, transitions: any[] = []) {
  const stage = resolveLifecycleStage(t);
  return { stage, completed: stage === "completed", main: MAIN_STAGES[mainStageIndex(t, transitions)], exception: EXCEPTIONAL_ACTIONS.find(a => a.key === stage) };
}
export function supervisionProgress(t: any) {
  const hours = Number(t.totalIndividualHours || 0) + Number(t.totalGroupHours || 0);
  const target = Number(t.supervisionTargetHours || (t.license === "QBA" ? 100 : 50));
  return { hours, target, percent: target > 0 ? Math.max(0, Math.min(100, hours / target * 100)) : 0 };
}
