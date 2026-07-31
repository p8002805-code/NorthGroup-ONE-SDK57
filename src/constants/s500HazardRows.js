export const S500_BASE_HAZARD_COUNT = 20;
export const S500_MAX_HAZARD_COUNT = 25;

export const S500_HAZARD_ROWS = Array.from(
  { length: S500_MAX_HAZARD_COUNT },
  (_, index) => {
    const number = index + 1;

    return {
      number: String(number),
      hazardKey: `hazard${number}`,
      controlKey: `control${number}`,
      pKey: `riskP${number}`,
      cKey: `riskC${number}`,
      rKey: `riskR${number}`,
      includeKey: `hazardInclude${number}`,
    };
  }
);
