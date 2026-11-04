import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../setup/create-test-app.js';

interface MenuProduct {
  id: string;
  name: string;
  specGroups: unknown[];
}

interface MenuCategory {
  id: string;
  name: string;
  products: MenuProduct[];
}

describe('public store and catalog (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/store returns the seeded store and business state', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/store')
      .expect(200);

    expect(response.body.name).toBe('ToCoffee 示例店');
    expect(response.body.businessHours).toHaveLength(7);
    expect(typeof response.body.isOpen).toBe('boolean');
    expect(response.body.prepMinutes).toBe(8);
  });

  it('GET /api/menu returns 5 categories and 12 products', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/menu')
      .expect(200);

    const categories = response.body.categories as MenuCategory[];
    expect(categories).toHaveLength(5);

    const products = categories.flatMap((category) => category.products);
    expect(products).toHaveLength(12);
    expect(products.every((product) => Array.isArray(product.specGroups))).toBe(
      true,
    );
  });

  it('GET /api/products/:id returns product detail with category', async () => {
    const menuResponse = await request(app.getHttpServer())
      .get('/api/menu')
      .expect(200);
    const categories = menuResponse.body.categories as MenuCategory[];
    const firstProduct = categories[0]?.products[0];
    expect(firstProduct).toBeDefined();

    const response = await request(app.getHttpServer())
      .get(`/api/products/${firstProduct!.id}`)
      .expect(200);

    expect(response.body.id).toBe(firstProduct!.id);
    expect(response.body.category.name).toBeTruthy();
    expect(Array.isArray(response.body.specGroups)).toBe(true);
  });

  it('GET /api/products/:id returns NOT_FOUND for unknown product', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/products/00000000-0000-4000-8000-000000000000')
      .expect(404);

    expect(response.body.code).toBe('NOT_FOUND');
  });
});
