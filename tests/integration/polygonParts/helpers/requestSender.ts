import type { Application } from 'express';
import * as supertest from 'supertest';
import type {
  AggregatePolygonPartsRequestBody,
  AggregationLayerMetadataParams,
  DeleteValidationEntityQuery,
  ExistsRequestBody,
  FindPolygonPartsParams,
  FindPolygonPartsQueryParams,
  FindPolygonPartsRequestBody,
  ValidatePolygonPartsRequestBody,
} from '../../../../src/polygonParts/controllers/interfaces';
import type { PolygonPartsPayload } from '../../../../src/polygonParts/models/interfaces';

interface ExistsPolygonParts {
  body: ExistsRequestBody;
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

  public async existsPolygonParts({ body }: ExistsPolygonParts): Promise<supertest.Response> {
    return supertest.agent(this.app).post(`/polygonParts/exists`).set('Content-Type', 'application/json').send(body);
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

  public async aggregateLayerMetadata(options: {
    params: AggregationLayerMetadataParams;
    body?: AggregatePolygonPartsRequestBody;
  }): Promise<supertest.Response> {
    return supertest.agent(this.app).post(`/polygonParts/${options.params.polygonPartsEntityName}/aggregate`).send(options.body);
  }

  public async validatePolygonParts(body: ValidatePolygonPartsRequestBody): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/polygonParts/validate').set('Content-Type', 'application/json').send(body);
  }

  public async deleteValidationPolygonParts(query: DeleteValidationEntityQuery): Promise<supertest.Response> {
    return supertest.agent(this.app).delete('/polygonParts/validate').query(query).send();
  }
}
