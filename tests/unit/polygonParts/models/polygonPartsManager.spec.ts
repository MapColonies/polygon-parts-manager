import { PolygonPartsManager } from '../../../../src/polygonParts/models/polygonPartsManager';
import { FeatureValidationError } from '../../../../src/common/enums';

describe('PolygonPartsManager', () => {
  describe('#validateResolutions', () => {
    it('should mark resolution as exceeded only when the new part is at least the configured zoom levels finer', async () => {
      const logger = {
        child: jest.fn().mockReturnThis(),
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      } as any;
      const config = {
        get: jest.fn((key: string) => {
          if (key === 'application') {
            return {
              validateResolutionsFunction: 'validate_resolutions',
              entities: {
                polygonParts: { find: { maxDecimalDigits: 15 } },
              },
              validation: { resolutionZoomLevelThreshold: 2 },
            };
          }
          if (key === 'application.validation.resolutionZoomLevelThreshold') {
            return 2;
          }
          if (key === 'db.schema') {
            return 'polygon_parts';
          }
          return undefined;
        }),
      } as any;
      const entityManager = {
        createQueryBuilder: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
          setParameters: jest.fn().mockReturnThis(),
          getRawMany: jest.fn().mockResolvedValue([
            { id: 'exceededPart', newResolution: '0.1', existingResolution: '0.00125' },
            { id: 'minorDegradationPart', newResolution: '0.1', existingResolution: '0.05' },
          ]),
        }),
      } as any;
      const connectionManager = { entityExists: jest.fn().mockResolvedValue(true) } as any;
      const historyManager = {} as any;

      const manager = new PolygonPartsManager(logger, config, connectionManager, historyManager);
      const result = await manager['validateResolutions']({
        entityManager,
        logger,
        entitiesMetadata: {
          entitiesNames: {
            validations: { databaseObjectQualifiedName: 'polygon_parts.valid' },
            polygonParts: {
              entityName: 'polygon_parts',
              databaseObjectQualifiedName: 'polygon_parts.parts',
            },
          },
        },
      } as any);

      expect(entityManager.createQueryBuilder).toHaveBeenCalled();
      expect(result).toEqual([
        {
          id: 'exceededPart',
          errors: [{ code: FeatureValidationError.RESOLUTION, isExceeded: true }],
        },
        {
          id: 'minorDegradationPart',
          errors: [{ code: FeatureValidationError.RESOLUTION, isExceeded: false }],
        },
      ]);
    });
  });
});
