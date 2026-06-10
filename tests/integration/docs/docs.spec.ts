import { jsLogger } from '@map-colonies/js-logger';
import { trace } from '@opentelemetry/api';
import httpStatusCodes from 'http-status-codes';
import { getApp } from '../../../src/app';
import { SERVICES } from '../../../src/common/constants';
import { initConfigForTests } from '../../configurations/config';
import { DocsRequestSender } from './helpers/docsRequestSender';

describe('docs', function () {
  let requestSender: DocsRequestSender;

  beforeAll(async () => {
    await initConfigForTests();
  });

  beforeEach(async () => {
    const [app] = await getApp({
      override: [
        { token: SERVICES.CONNECTION_MANAGER, provider: { useValue: { destroy: () => undefined } } },
        { token: SERVICES.LOGGER, provider: { useValue: await jsLogger({ enabled: false }) } },
        { token: SERVICES.TRACER, provider: { useValue: trace.getTracer('testTracer') } },
      ],
      useChild: true,
    });
    requestSender = new DocsRequestSender(app);
  });

  describe('Happy Path', () => {
    it('should return 200 status code and the resource', async () => {
      const response = await requestSender.getDocs();

      expect(response.status).toBe(httpStatusCodes.OK);
      expect(response.type).toBe('text/html');
    });

    it('should return 200 status code and the json spec', async () => {
      const response = await requestSender.getDocsJson();

      expect(response.status).toBe(httpStatusCodes.OK);

      expect(response.type).toBe('application/json');
      expect(response.body).toHaveProperty('openapi');
    });
  });
});
