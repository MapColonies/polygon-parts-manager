import { ProductType , PolygonPart} from "@map-colonies/mc-model-types";
import { Polygon } from 'geojson';

const layerMetadata = {
    productId: 'BLUE_MARBLE',
    productType: ProductType.ORTHOPHOTO,
    catalogId: 'c52d8189-7e07-456a-8c6b-53859523c3e9',
    productVersion: '1.0',
}

const partDataDetails = {
    sourceId: 'string',
    sourceName: 'string',
    imagingTimeBeginUTC: '2024-11-13T14:26:21.715Z',
    imagingTimeEndUTC: '2024-11-13T14:26:21.715Z',
    resolutionDegree: 0.703125,
    resolutionMeter: 78271.52,
    sourceResolutionMeter: 78271.52,
    horizontalAccuracyCE90: 4000,
    sensors: [ 'string' ],
    countries: [ 'string' ],
    cities: [ 'string' ],
    description: 'string',
}

const worldFootprint = {
    type: 'Polygon',
    coordinates: [
      [
        [-180, 90],
        [-180, -90],
        [180, -90],
        [180, 90],
        [-180, 90],
      ],
    ]
  }

const franceFootprint =  {
    type: 'Polygon',
    coordinates:  [
        [
          [
            -2.4665482828026484,
            48.887141594331894
          ],
          [
            -1.2454127629423795,
            43.89934370894406
          ],
          [
            6.1233025322743515,
            44.11822053690119
          ],
          [
            5.856707262678924,
            49.31450588562336
          ],
          [
            -2.4665482828026484,
            48.887141594331894
          ]
        ]
      ]
  };

const germanyFootprint =  {
    type: 'Polygon',
    coordinates:   [
        [
          [
            7.27089952814373,
            53.180758608636125
          ],
          [
            8.234012102070523,
            48.84326694299858
          ],
          [
            13.657889668595743,
            48.81988047270431
          ],
          [
            13.852779148663245,
            53.743357886857154
          ],
          [
            7.27089952814373,
            53.180758608636125
          ]
        ]
      ]
  };
  
const italyFootprint =  {
    type: 'Polygon',
    coordinates:  [
        [
          [
            8.00965846045662,
            45.07006283085923
          ],
          [
            12.556004637006907,
            39.09877499242364
          ],
          [
            18.45834665868881,
            39.843200896431
          ],
          [
            14.213356721380023,
            45.07951202671654
          ],
          [
            8.00965846045662,
            45.07006283085923
          ]
        ]
      ]
  };  

const europeFootprint =  {
    type: 'Polygon',
    coordinates:  [
        [
          [
            -11.215763071087054,
            55.96351377452038
          ],
          [
            -6.719781234377905,
            42.09374429147678
          ],
          [
            -5.06285410114657,
            39.6502337427211
          ],
          [
            19.685007346186524,
            37.53507900657999
          ],
          [
            28.764891217480397,
            55.090669595591635
          ],
          [
            -11.215763071087054,
            55.96351377452038
          ]
        ]
      ]
  };   
  
const intersectionWithFranceAndGermanyFootprint = {
    type: 'Polygon',
    coordinates:[
        [
          [
            0.03338779470774966,
            48.663448425842006
          ],
          [
            5.431175578792505,
            47.15592163018394
          ],
          [
            11.510350564251098,
            48.15427399189073
          ],
          [
            8.470968666450517,
            52.39099512132344
          ],
          [
            0.03338779470774966,
            48.663448425842006
          ]
        ]
      ]
  };  

const intersectionWithItalyFootprint = {
    type: 'Polygon',
    coordinates: [
        [
          [
            15.242703744811251,
            47.63748815188245
          ],
          [
            12.619116067663526,
            44.40706680284379
          ],
          [
            16.663020524356796,
            41.46011220063403
          ],
          [
            20.155700258171464,
            43.52570628088938
          ],
          [
            15.242703744811251,
            47.63748815188245
          ]
        ]
      ]
  }

function generatePartData(layerMetadata , )  


  
  



  