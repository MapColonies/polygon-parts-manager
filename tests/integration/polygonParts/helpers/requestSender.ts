import type { Application } from 'express';
import * as supertest from 'supertest';
import type {
  AggregateLayerMetadataParams,
  AggregateLayerMetadataQueryParams,
  AggregateLayerMetadataRequestBody,
  FindPolygonPartsParams,
  FindPolygonPartsQueryParams,
  FindPolygonPartsRequestBody,
} from '../../../../src/polygonParts/controllers/interfaces';
import type { PolygonPartsPayload } from '../../../../src/polygonParts/models/interfaces';

interface AggregatePolygonParts {
  params: AggregateLayerMetadataParams;
  body: AggregateLayerMetadataRequestBody;
  query?: AggregateLayerMetadataQueryParams;
}

interface FindPolygonParts {
  params: FindPolygonPartsParams;
  body: FindPolygonPartsRequestBody;
  query?: FindPolygonPartsQueryParams;
}

export class PolygonPartsRequestSender {
  public constructor(private readonly app: Application) {}

  public async createPolygonParts(body: PolygonPartsPayload): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/polygonParts').set('Content-Type', 'application/json').send(body);
  }

  public async findPolygonParts({ params, body, query }: FindPolygonParts): Promise<supertest.Response> {
    return supertest
      .agent(this.app)
      .post(`/polygonParts/${params.polygonPartsEntityName}/find`)
      .query(query ?? {})
      .send(body);
  }

  public async updatePolygonParts(body: PolygonPartsPayload, isSwap: boolean): Promise<supertest.Response> {
    return supertest.agent(this.app).put('/polygonParts').query({ isSwap }).set('Content-Type', 'application/json').send(body);
  }

  public async aggregateLayerMetadata({ params, body, query }: AggregatePolygonParts): Promise<supertest.Response> {
    return supertest
      .agent(this.app)
      .post(`/polygonParts/${params.polygonPartsEntityName}/aggregate`)
      .query(query ?? {})
      .send(body);
  }
}
