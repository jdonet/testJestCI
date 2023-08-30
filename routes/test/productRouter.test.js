const express = require('express');
const app = express();
const request = require('supertest');
const productRouter = require('../productRouter');


describe('GET /products', () => {
  test('should respond with JSON containing speficied text', async () => {
    app.use('/products', productRouter);

    // Effectue la requête HTTP GET à '/products/plante'
    const response = await request(app)
      .get('/products')
      //.set('Accept', 'application/json')
    //console.log(response)
    //vérifie que le retour est en json
    expect(response.headers["content-type"]).toMatch(/json/);
    //vérifie le type HTTP 200
    expect(response.status).toEqual(200);
    /// Vérifie le corps de la réponse
    expect(JSON.stringify(response.body)).toMatch(/Une plante avec un feuillage vert./);
  });
});

/*
describe('GET /products/plante', () => {
  test('should respond with JSON containing specified text', async () => {
    app.use('/products', productRouter);
  
    // Effectue la requête HTTP GET à '/products/plante'
    const response = await request(app)
      .get('/products/plante')
      .expect('Content-Type', /json/)
      .expect(200);
  
    // Vérifie le corps de la réponse
    expect(JSON.stringify(response.body)).toMatch(/Une plante avec un feuillage vert./);
  });
});*/
/*
describe('GET /products/djfkjd', () => {
  test('should respond with 404 not found', () => {
    const app = express();
    app.use('/products', productRouter);

    // Effectue la requête HTTP GET à '/products/plante'
    return request(app)
      .get('/products/djfkjd')
      .expect(404);
  });
});*/
