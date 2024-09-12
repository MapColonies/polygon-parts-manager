import jsLogger from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { PolygonPartsRequestSender } from './helpers/requestSender';

describe('polygonParts', () => {
  let requestSender: PolygonPartsRequestSender;
  beforeEach(async () => {
    const app = await getApp({
      override: [
        { token: SERVICES.LOGGER, provider: { useValue: jsLogger({ enabled: false }) } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
      ],
      useChild: true,
    });
    requestSender = new PolygonPartsRequestSender(app);
  });

  describe('Happy Path', () => {
    it.todo('should return 200 status code and create the resource');
  });
  describe('Bad Path', () => {
    // All requests with status code of 400
  });
  describe('Sad Path', () => {
    // All requests with status code 4XX-5XX
  });
});
