import type { MonthlySnapshot, SessionType, Trainee } from "@/types";

type SnapshotAccounting = Pick<
  MonthlySnapshot,
  | "individualHours"
  | "groupHours"
  | "totalHours"
  | "groupPercentage"
  | "absenceCount"
  | "warningCount"
>;

type TraineeAccounting = Pick<
  Trainee,
  "totalIndividualHours" | "totalGroupHours"
>;

const nonNegative = (value: number) => Math.max(0, value);
const numeric = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

export function reverseSessionFromSnapshot(
  snapshot: Partial<SnapshotAccounting>,
  type: SessionType,
  duration = 0,
): SnapshotAccounting {
  const individualHours = nonNegative(
    numeric(snapshot.individualHours) - (type === "individual" ? duration : 0),
  );
  const groupHours = nonNegative(
    numeric(snapshot.groupHours) - (type === "group" ? duration : 0),
  );
  const totalHours = individualHours + groupHours;

  return {
    individualHours,
    groupHours,
    totalHours,
    groupPercentage:
      totalHours > 0
        ? Math.round((groupHours / totalHours) * 1000) / 10
        : 0,
    absenceCount: nonNegative(
      numeric(snapshot.absenceCount) - (type === "absence" ? 1 : 0),
    ),
    warningCount: nonNegative(
      numeric(snapshot.warningCount) - (type === "warning" ? 1 : 0),
    ),
  };
}

export function reverseSessionFromTrainee(
  trainee: Partial<TraineeAccounting>,
  type: SessionType,
  duration = 0,
) {
  const totalIndividualHours = nonNegative(
    numeric(trainee.totalIndividualHours) -
      (type === "individual" ? duration : 0),
  );
  const totalGroupHours = nonNegative(
    numeric(trainee.totalGroupHours) - (type === "group" ? duration : 0),
  );

  return {
    totalIndividualHours,
    totalGroupHours,
    totalSupervisionSessionHours:
      totalIndividualHours + totalGroupHours,
  };
}
