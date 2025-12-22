import { Router } from 'express';
import type { FactoryFunction } from 'tsyringe';
import { PolygonPartsController } from '../controllers/polygonPartsController';
import { TransformerController } from '../controllers/transformerController';

const historyRouterFactory: FactoryFunction<Router> = (dependencyContainer) => {
    const router = Router();
    const controller = dependencyContainer.resolve(PolygonPartsController);
    const transformer = dependencyContainer.resolve(TransformerController);

    router.put('/history', transformer.parseDeleteValidationPolygonPartsEntity, controller.moveValidationsToHistory);

    return router;
};

export const HISTORY_ROUTER_SYMBOL = Symbol('historyRouterFactory');

export { historyRouterFactory };
