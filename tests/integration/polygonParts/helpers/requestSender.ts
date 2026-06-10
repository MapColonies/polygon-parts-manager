import type { Application } from 'express';
import { type Response, agent } from 'supertest';
import type {
  AggregatePolygonPartsRequestBody,
  AggregationLayerMetadataParams,
  ExistsRequestBody,
  FindPolygonPartsParams,
  FindPolygonPartsQueryParams,
  FindPolygonPartsRequestBody,
  IntersectionParams,
  IntersectionRequestBody,
  ProcessPolygonPartsRequestBody,
  ValidatePolygonPartsRequestBody,
  ValidationEntityQuery,
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

  public async createPolygonParts(body: PolygonPartsPayload): Promise<Response> {
    return agent(this.app).post('/polygonParts').set('Content-Type', 'application/json').send(body);
  }

  public async existsPolygonParts({ body }: ExistsPolygonParts): Promise<Response> {
    return agent(this.app).post(`/polygonParts/exists`).set('Content-Type', 'application/json').send(body);
  }

  public async findPolygonParts({ params, body, query }: FindPolygonParts): Promise<Response> {
    return agent(this.app)
      .post(`/polygonParts/${params.polygonPartsEntityName}/find`)
      .query(query ?? {})
      .send(body);
  }

  public async intersection({ params, body }: { params: IntersectionParams; body: IntersectionRequestBody }): Promise<Response> {
    return agent(this.app).post(`/polygonParts/${params.polygonPartsEntityName}/intersection`).send(body);
  }

  public async updatePolygonParts(body: PolygonPartsPayload, isSwap: boolean): Promise<Response> {
    return agent(this.app).put('/polygonParts').query({ isSwap }).set('Content-Type', 'application/json').send(body);
  }

  public async aggregateLayerMetadata(options: {
    params: AggregationLayerMetadataParams;
    body?: AggregatePolygonPartsRequestBody;
  }): Promise<Response> {
    return agent(this.app).post(`/polygonParts/${options.params.polygonPartsEntityName}/aggregate`).send(options.body);
  }

  public async validatePolygonParts(body: ValidatePolygonPartsRequestBody): Promise<Response> {
    return agent(this.app).post('/polygonParts/validate').set('Content-Type', 'application/json').send(body);
  }

  public async deleteValidationPolygonParts(query: ValidationEntityQuery): Promise<Response> {
    return agent(this.app).delete('/polygonParts/validate').query(query).send();
  }

  public async moveValidationsToHistory(query: ValidationEntityQuery): Promise<Response> {
    return agent(this.app).put('/history').query(query).send();
  }

  public async process(body: ProcessPolygonPartsRequestBody): Promise<Response> {
    return agent(this.app).put('/polygonParts/process').set('Content-Type', 'application/json').send(body);
  }
}
