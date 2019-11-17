const SteliaDb = require('../core');

/*
 *   Unit tests
 *      --> not implement now
 */

/* New connection */
let db = new SteliaDb();

/* Add a collection */
const fruits = {
    name: 'fruits',
    struct: {
        name: { type: 'varchar' },
        color: { type: 'varchar' },
        price: { type: 'float' },
        kg: { type: 'float' }
    }
};
db.fruits = db.getCollection(fruits);

/* Add fruits (dataset) */
db.fruits.insert({ name: 'Banana', color: 'Yellow', price: 2, kg: 20 });
db.fruits.insert({ name: 'Orange', color: 'Orange', price: 2.6, kg: 16 });
db.fruits.insert({ name: 'Apple', color: 'Green', price: 1.7, kg: 21.5 });
db.fruits.insert({ name: 'Kiwi', color: 'Brown', price: 1.5, kg: 23 });
db.fruits.insert({ name: 'Strawberry', color: 'Red', price: 1.5, kg: 9 });

/* Show all fruits */
console.log(
    db.fruits.findSync(
        { price: { $lt: 2 } },
        { name: 1, color: 1, $limit: 1, $skip: 1 }
    )
);
