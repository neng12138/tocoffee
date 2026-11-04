import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../setup/create-test-app.js';

describe('customer and staff auth (e2e)', () => {
  let app: INestApplication;
  let customerToken = '';

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('requests a code, logs in, and reads the current member', async () => {
    const phone = '13900000011';

    const codeResponse = await request(app.getHttpServer())
      .post('/api/auth/code')
      .send({ phone })
      .expect(200);

    expect(codeResponse.body.devCode).toMatch(/^\d{6}$/);
    expect(codeResponse.body.expiresInSeconds).toBe(300);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ phone, code: codeResponse.body.devCode })
      .expect(200);

    customerToken = loginResponse.body.token as string;
    expect(customerToken).toBeTruthy();
    expect(loginResponse.body.member.phone).toBe(phone);

    const meResponse = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    expect(meResponse.body.phone).toBe(phone);
  });

  it('rejects requests without a token using the unified error shape', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .expect(401);

    expect(response.body).toMatchObject({
      code: 'UNAUTHORIZED',
      message: expect.any(String),
    });
  });

  it('does not accept a customer token on the staff endpoint', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/auth/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(401);
  });

  it('logs in staff and reads the current staff', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ username: 'owner', password: 'admin123' })
      .expect(200);

    expect(loginResponse.body.staff.role).toBe('OWNER');
    const token = loginResponse.body.token as string;

    const meResponse = await request(app.getHttpServer())
      .get('/api/admin/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(meResponse.body.username).toBe('owner');
    expect(meResponse.body.store.name).toBe('ToCoffee 示例店');
  });

  it('rejects a wrong staff password', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/auth/login')
      .send({ username: 'owner', password: 'wrong-password' })
      .expect(401);
  });

  it('rate limits repeated code requests for the same phone', async () => {
    const phone = '13900000012';

    for (let index = 0; index < 5; index += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/code')
        .send({ phone })
        .expect(200);
    }

    const response = await request(app.getHttpServer())
      .post('/api/auth/code')
      .send({ phone })
      .expect(429);

    expect(response.body.code).toBe('RATE_LIMITED');
    expect(response.body.details.retryAfterSeconds).toBeGreaterThan(0);
  });
});
