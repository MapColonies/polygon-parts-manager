import { Router } from 'express';
import { FactoryFunction } from 'tsyringe';
import { parseCreatePolygonParts, parseUpdatePolygonParts } from '../../common/middlewares/validations';
import { PolygonPartsController } from '../controllers/polygonPartsController';

const polygonPartsRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
  const router = Router();
  const controller = dependencyContainer.resolve(PolygonPartsController);

  router.post('/', parseCreatePolygonParts, controller.createPolygonParts);
  router.put('/', parseUpdatePolygonParts, controller.updatePolygonParts);

  return router;
};

export const POLYGON_PARTS_ROUTER_SYMBOL = Symbol('polygonPartsRouterFactory');

export { polygonPartsRouterFactory };
