var app = require('../../app');
const request = require('supertest');
const cartRouter = require('../cartRouter'); // Assurez-vous que le chemin vers le routeur est correct
/*
const { passport } = require('../app'); // Importez app.js et accédez à passport
*/
// Montez le routeur cartRouter sur l'application
app.use('/cart', cartRouter); // Tous les chemins de l'objet cartRouter seront accessibles via /cart

describe('pages de panier', function() {
 /* beforeAll(() => {
    // Configurez la stratégie d'authentification pour les tests
    app.get('/', passport.authenticate('basic', { session: false }), (req, res) => {
      res.json({ message: 'Authenticated' });
    });
  });
*/
  test('Josbleau peut voir son panier', function(done) {
    request(app)
      .get('/cart/josbleau') //Le panier de josbleau
      .auth('josbleau', '12345') // Authentification basique
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200)
      .end(function(err, res) {
        if (err){
          console.log(res);
          return done(err);
        } 
       // console.log(res.body); // Affichez la réponse JSON renvoyée par l'appel
        done(); // Terminez le test
      });
  });

  test('une mauvaise auth ne peut pas voir un panier', function(done) {
    request(app)
      .get('/cart/josbleau') //Le panier de josbleau
      .auth('test', 'test') // Authentification basique
      .set('Accept', 'application/json')
      .expect(401)
      .end(function(err, res) {
        if (err){
          console.log(res);
          return done(err);
        } 
       // console.log(res.body); // Affichez la réponse JSON renvoyée par l'appel
        done(); // Terminez le test
      });
  });
  test('un utilisateur ne peut pas voir que son panier', function(done) {
    request(app)
      .get('/cart/josbleau') //Le panier de josbleau
      .auth('jeannebleau', '12345') // Authentification basique
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect(403)
      .end(function(err, res) {
        if (err){
          console.log(res);
          return done(err);
        } 
       // console.log(res.body); // Affichez la réponse JSON renvoyée par l'appel
        done(); // Terminez le test
      });
  });
});
