import type { Application } from 'express';
import * as supertest from 'supertest';
import { PolygonPartsPayload } from '../../../../src/polygonParts/models/interfaces';

export class PolygonPartsRequestSender {
  public constructor(private readonly app: Application) {}

  // TODO: import request body type from OpenAPI def
  public async createPolygonParts(body: PolygonPartsPayload): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/polygonParts').set('Content-Type', 'application/json').send(body);
  }
}
