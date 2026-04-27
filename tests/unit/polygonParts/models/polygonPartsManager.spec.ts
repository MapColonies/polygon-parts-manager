import type { Logger } from '@map-colonies/js-logger';
import { ValidationErrorType, type PolygonPartValidationError } from '@map-colonies/raster-shared';
import type { EntityManager } from 'typeorm';
import { ConnectionManager } from '../../../../src/common/connectionManager';
import { IConfig } from '../../../../src/common/interfaces';
import { HistoryManager } from '../../../../src/history/models/historyManager';
import { EntitiesMetadata } from '../../../../src/polygonParts/models/interfaces';
import { PolygonPartsManager } from '../../../../src/polygonParts/models/polygonPartsManager';

describe('PolygonPartsManager', () => {
  describe('#validateResolutions', () => {
    it('should mark resolution as exceeded only when the new part is at least the configured zoom levels finer', async () => {
      const loggerMock = {
        child: jest.fn().mockReturnThis(),
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      } as unknown as Logger;
      const configMock = {
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
          if (key === 'application.entities.polygonParts.find.maxDecimalDigits') {
            return 15;
          }
          return undefined;
        }),
      } as unknown as IConfig;

      const queryBuilderMock = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { id: 'exceededPart', newResolution: '0.1', existingResolution: '0.00125' },
          { id: 'minorDegradationPart', newResolution: '0.1', existingResolution: '0.05' },
        ]),
      };

      const entityManager = {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilderMock),
      } as unknown as EntityManager;
      const connectionManager = { entityExists: jest.fn().mockResolvedValue(true) } as unknown as ConnectionManager;
      const historyManager = {} as unknown as HistoryManager;

      const manager = new PolygonPartsManager(loggerMock, configMock, connectionManager, historyManager);

      const entitiesMetadata = {
        entitiesNames: {
          validations: { databaseObjectQualifiedName: 'polygon_parts.valid' },
          polygonParts: {
            entityName: 'polygon_parts',
            databaseObjectQualifiedName: 'polygon_parts.parts',
          },
        },
      } as unknown as EntitiesMetadata;

      const castedManager = manager as unknown as {
        validateResolutions: (context: {
          entitiesMetadata: EntitiesMetadata;
          entityManager: EntityManager;
          logger: Logger;
        }) => Promise<PolygonPartValidationError[]>;
      };

      const result = await (async () =>
        castedManager.validateResolutions({
          entityManager,
          logger: loggerMock,
          entitiesMetadata,
        }))();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(entityManager.createQueryBuilder).toHaveBeenCalled();
      expect(result).toEqual([
        {
          id: 'exceededPart',
          errors: [{ code: ValidationErrorType.RESOLUTION, isExceeded: true }],
        },
        {
          id: 'minorDegradationPart',
          errors: [{ code: ValidationErrorType.RESOLUTION, isExceeded: false }],
        },
      ]);
    });
  });
});
