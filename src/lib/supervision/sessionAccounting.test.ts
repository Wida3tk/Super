import { describe, expect, it } from "vitest";
import {
  reverseSessionFromSnapshot,
  reverseSessionFromTrainee,
} from "./sessionAccounting";

describe("session accounting reversal", () => {
  it("reverses an individual session from snapshot and trainee totals", () => {
    expect(
      reverseSessionFromSnapshot(
        {
          individualHours: 4,
          groupHours: 2,
          totalHours: 6,
          groupPercentage: 33.3,
          absenceCount: 1,
          warningCount: 2,
        },
        "individual",
        1.5,
      ),
    ).toEqual({
      individualHours: 2.5,
      groupHours: 2,
      totalHours: 4.5,
      groupPercentage: 44.4,
      absenceCount: 1,
      warningCount: 2,
    });

    expect(
      reverseSessionFromTrainee(
        { totalIndividualHours: 10, totalGroupHours: 5 },
        "individual",
        1.5,
      ),
    ).toEqual({
      totalIndividualHours: 8.5,
      totalGroupHours: 5,
      totalSupervisionSessionHours: 13.5,
    });
  });

  it("reverses group hours and recalculates the group percentage", () => {
    const result = reverseSessionFromSnapshot(
      {
        individualHours: 3,
        groupHours: 2,
        absenceCount: 0,
        warningCount: 0,
      },
      "group",
      1,
    );

    expect(result.totalHours).toBe(4);
    expect(result.groupHours).toBe(1);
    expect(result.groupPercentage).toBe(25);
  });

  it("decrements attendance counters without allowing negative values", () => {
    expect(
      reverseSessionFromSnapshot({ absenceCount: 0 }, "absence"),
    ).toMatchObject({ absenceCount: 0 });
    expect(
      reverseSessionFromSnapshot({ warningCount: 2 }, "warning"),
    ).toMatchObject({ warningCount: 1 });
  });

  it("never creates negative totals from inconsistent legacy data", () => {
    expect(
      reverseSessionFromTrainee(
        { totalIndividualHours: 0.5, totalGroupHours: 0 },
        "individual",
        1,
      ),
    ).toEqual({
      totalIndividualHours: 0,
      totalGroupHours: 0,
      totalSupervisionSessionHours: 0,
    });
  });
});
