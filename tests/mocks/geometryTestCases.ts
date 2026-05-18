/* eslint-disable @typescript-eslint/no-magic-numbers */

import type { Polygon } from 'geojson';

export const invalidGeometryTopologyTestCases = [
  {
    testCase: 'exterior ring must not cross itself',
    coordinates: [
      [
        [0, 0],
        [2, 0],
        [1, 1],
        [0, 2],
        [2, 2],
        [1, -1],
        [0, 0],
      ],
    ],
  },
  {
    testCase: 'exterior ring must not self-touch',
    coordinates: [
      [
        [0, 0],
        [2, 0],
        [1, 1],
        [1, 2],
        [1, 1],
        [0, 0],
      ],
    ],
  },
  {
    testCase: 'interior hole ring must not cross the exterior',
    coordinates: [
      [
        [0, 0],
        [3, 0],
        [3, 3],
        [0, 3],
        [0, 0],
      ],
      [
        [1, 1],
        [2, 1],
        [2, 4],
        [1, 4],
        [1, 1],
      ],
    ],
  },
  {
    testCase: 'interior hole rings must not cross each other',
    coordinates: [
      [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
        [0, 0],
      ],
      [
        [1, 1],
        [2, 1],
        [2, 3],
        [1, 3],
        [1, 1],
      ],
      [
        [1, 1],
        [1, 2],
        [3, 2],
        [3, 1],
        [1, 1],
      ],
    ],
  },
  {
    testCase: 'interior hole ring must not touch the exterior ring along a line',
    coordinates: [
      [
        [0, 0],
        [3, 0],
        [3, 3],
        [0, 3],
        [0, 0],
      ],
      [
        [0, 1],
        [2, 1],
        [2, 2],
        [0, 2],
        [0, 1],
      ],
    ],
  },
  {
    testCase: 'interior hole rings must not touch each other along a line',
    coordinates: [
      [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
        [0, 0],
      ],
      [
        [1, 1],
        [2, 1],
        [2, 2],
        [1, 2],
        [1, 1],
      ],
      [
        [2, 1],
        [3, 1],
        [3, 2],
        [2, 2],
        [2, 1],
      ],
    ],
  },
  {
    testCase: 'interior hole rings must be contained in exterior ring',
    coordinates: [
      [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
        [0, 0],
      ],
      [
        [3, 3],
        [4, 3],
        [4, 4],
        [3, 4],
        [3, 3],
      ],
    ],
  },
  {
    testCase: 'interior hole rings must not split the geometry into more than one part',
    coordinates: [
      [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
        [0, 0],
      ],
      [
        [2, 1],
        [4, 2],
        [0, 2],
        [2, 1],
      ],
    ],
  },
] satisfies { testCase: string; coordinates: Polygon['coordinates'] }[];
