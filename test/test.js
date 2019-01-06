const SteliaDb = require('../steliadb');
const users = require('./users.model.json');
const path = require('path');

/* Load a database */
var db = new SteliaDb();
db.use(path.resolve(__dirname, 'test.bson'));

/* Drop the database */
db.drop(true);

/* Use the model 'users' */
db.users = db.getCollection(users);

/* Create the users */
db.users.insert({ username: 'Alice', password: 'root', create: new Date().toISOString() });
db.users.insert({ username: 'Bob', password: 'master', create: new Date().toISOString() });
db.users.insert({ username: 'Carole', password: 'hacker', create: new Date().toISOString() });

/* Update the information */
db.users.update({ username: 'Alice' }, { $set: { role: 'root' } });
db.users.update({ username: 'Bob' }, { $unset: { password: 1 } });

/* Detect the threats */
var PoI = db.users.mapReduceSync(
    () => {
        if(this.password == 'hacker') {
            emit('threats', this.id);
        }
    },
    (key, values) => {
        return values;
    }
);

/* Remove the threats */
if(PoI.threats || false) {
    db.users.remove({ id: { $in: PoI.threats } });
}

/* Get all the users (sort by the last one) */
db.users
    .findSync({}, { $sort: { id: -1 } })
    .map(user => {
        console.log(user);
    });
