import type { Application } from 'express';
import * as supertest from 'supertest';
import type { PolygonPartsPayload } from '../../../../src/polygonParts/models/interfaces';

export class PolygonPartsRequestSender {
  public constructor(private readonly app: Application) {}

  public async createPolygonParts(body: PolygonPartsPayload): Promise<supertest.Response> {
    return supertest.agent(this.app).post('/polygonParts').set('Content-Type', 'application/json').send(body);
  }
}
