export const aggregationFeaturePropertiesValidationTestCases = [
  {
    name: 'should return 400 status code if a feature has an invalid minResolutionDeg property',
    properties: {
      minResolutionDeg: 'not a number' as unknown as number,
      maxResolutionDeg: 0.703125,
    },
  },
  {
    name: 'should return 400 status code if a feature has an invalid maxResolutionDeg property',
    properties: {
      minResolutionDeg: 0.703125,
      maxResolutionDeg: 'not a number' as unknown as number,
    },
  },
  {
    name: 'should return 400 status code if a feature has an invalid negative minResolutionDeg value',
    properties: {
      minResolutionDeg: -1,
      maxResolutionDeg: 0.703125,
    },
  },
  {
    name: 'should return 400 status code if a feature has an invalid negative maxResolutionDeg value',
    properties: {
      minResolutionDeg: 0.703125,
      maxResolutionDeg: -1,
    },
  },
  {
    name: 'should return 400 status code if a feature has out of range minResolutionDeg value',
    properties: {
      minResolutionDeg: 0.0000000167638063430786,
      maxResolutionDeg: 0.703125,
    },
  },
  {
    name: 'should return 400 status code if a feature has out of range maxResolutionDeg value',
    properties: {
      minResolutionDeg: 0.703125,
      maxResolutionDeg: 0.8,
    },
  },
];
