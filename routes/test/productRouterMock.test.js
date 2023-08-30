const request = require('supertest');
const express = require('express');
const productRouter = require('../productRouter');
const productQueries = require('../../queries/ProductQueries');

// Crée une application Express factice pour tester le routeur
const app = express();
app.use('/products', productRouter);

// Mock des fonctions de la couche d'accès aux données (ProductQueries)
jest.mock('../../queries/ProductQueries', () => ({
  getAllProducts: jest.fn(),
  getProductById: jest.fn()
}));

describe('GET /products', () => {
  test('should respond with JSON containing products', async () => {
    // Mock la fonction getAllProducts pour renvoyer un tableau de produits simulé
    const mockProducts = [
      { id: 1, name: 'Product 1', price: 10 },
      { id: 2, name: 'Product 2', price: 20 }
    ];
    productQueries.getAllProducts.mockResolvedValue(mockProducts);

    // Effectue la requête HTTP GET à '/products'
    const response = await request(app).get('/products');

    // Vérifie la réponse
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(mockProducts);
  });

  test('should respond with JSON containing 1 product', async () => {
    // Mock la fonction getAllProducts pour renvoyer un tableau de produits simulé
    const mockProduct = { id: 1, name: 'Product 1', price: 10 };
     
    productQueries.getProductById.mockResolvedValue(mockProduct);

    // Effectue la requête HTTP GET à '/products'
    const response = await request(app).get('/products/chaise');

    // Vérifie la réponse
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(mockProduct);
  });

  /**
   * On simule ici que l'appel a L'API renvoie une erreur 500 et une exception 
   */
  test('should handle errors and pass them to the error handling middleware', async () => {
    // Mock la fonction getAllProducts pour renvoyer une erreur simulée
    const mockError = new Error('Test error');
    productQueries.getAllProducts.mockRejectedValue(mockError);

    // Effectue la requête HTTP GET à '/products'
    const response = await request(app).get('/products');

    // Vérifie le code de statut et le corps de la réponse
    expect(response.statusCode).toBe(500);
    expect(response.text).toContain('Test error');
  });
});
