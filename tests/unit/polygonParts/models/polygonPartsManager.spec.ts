import jsLogger from '@map-colonies/js-logger';
import { container } from 'tsyringe';
import { ConnectionManager } from '../../../../src/common/connectionManager';
import { SERVICES } from '../../../../src/common/constants';
import { PolygonPartsManager } from '../../../../src/polygonParts/models/polygonPartsManager';

let connectionManager: ConnectionManager;
let polygonPartsManager: PolygonPartsManager;

describe('PolygonPartsManager', () => {
  beforeAll(() => {
    const logger = jsLogger({ enabled: false });
    container.register(SERVICES.LOGGER, { useValue: logger });
    container.register(SERVICES.CONFIG, { useValue: {} });

    connectionManager = container.resolve(ConnectionManager); //new ConnectionManager(logger, config);
    polygonPartsManager = container.resolve(PolygonPartsManager); //new PolygonPartsManager(logger, connectionManager);
  });

  describe('#createPolygonParts', () => {
    it.todo('should create the resource');
  });
});
