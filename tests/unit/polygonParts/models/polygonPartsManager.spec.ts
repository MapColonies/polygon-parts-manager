import jsLogger from '@map-colonies/js-logger';
import config from 'config';
import { ConnectionManager } from '../../../../src/common/connectionManager';
import { PolygonPartsManager } from '../../../../src/polygonParts/models/polygonPartsManager';

let polygonPartsManager: PolygonPartsManager;

describe('PolygonPartsManager', () => {
  beforeEach(() => {
    const logger = jsLogger({ enabled: false });
    const connectionManager = new ConnectionManager(logger, config);
    polygonPartsManager = new PolygonPartsManager(logger, connectionManager);
  });
  describe('#createPolygonParts', () => {
    it.todo('should create the resource');
  });
});
