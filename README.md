# SteliaDb

![license](https://img.shields.io/badge/license-CC_BY--NC--SA-green.svg)
![version](https://img.shields.io/badge/app-v1.0.0_not_published-blue.svg)

SteliaDb can be able to use on the server side. It's a small database inspire of MongoDB. The usage is similar. You can link the database to your [express](https://github.com/expressjs/express) server.

With the last commit, you can use it in your browser. No save method or synchronization is available but you can manage more easily your data in web application. In the future, I want to work on a synchronization method.

## Prerequisites

You have to install Node.js on your computer (Windows / Linux / Mac / ARM systems).

[Download here](https://nodejs.org/en/download/)

## Install

Execute on your shell:

```bash
$> npm install https://github.com/Yarflam/steliadb
```

## Usage

Add the next line at the top of your script:

```js
const SteliaDb = require('steliadb');
```

### Open a database

When you want to begin to use it:

```js
var db = new SteliaDb();
db.use(path.resolve(__dirname, 'test.bson'));
```

Replace as you want the filename 'test.bson' (it's BSON format obviously).

### Use a collection

Define your model in JSON format (import or declare it in the JS script):

```json
{
    "name": "users",
    "struct": {
        "username": { "type": "varchar" },
        "password": { "type": "varchar" },
        "age": { "type": "int" },
        "role": { "type": "varchar" },
        "create": { "type": "timestamp" }
    }
}
```

Call the function 'getCollection':

```js
var users = { ... }; /* or require('./users.json') */
db.users = db.getCollection(users);
```

Now, you can manipulate the collection with 'db.users'.

### Insert

It's require one argument { key1: value1, key2: value2 ... keyN: valueN }.

Example:

```js
db.users.insert({ username: 'Alice', create: new Date().toISOString() });
```

You can define any deep of attributes in your model.

### Find or FindSync

It's take two arguments : your search and the options.

Example:

```js
db.users
    .findSync({
        role: { $regex: 'root$' }
    }, {
        username.$: 1,
        password.$: 1,
        $sort: { id: -1 }
    })
    .map(doc => {
        console.log(doc);
    })
```

**Search:**

-   **exists**: be or not be.
-   **\$regex**: apply a regex.
-   **\$lt**: lower of X.
-   **\$lte**: lower or equal of X.
-   **\$gt**: greater of X.
-   **\$gte**: greater or equal of X.
-   **\$in**: has to equal the values in the array.
-   **\$nin**: has not to equal the values in the array.
-   **\$or**: accept many proposals.
-   **\$ne**: have to different of X.
-   **\$eq**: have to equal to X.

**Options:**

-   **limit**: number of results (you can use it in async mode)
-   **sort**: sort by something (asc: 1, desc: -1), you can use float value.
-   **[attrib].\$**: it's the projection of you request, you can return specific attributes.

### Remove

The argument take the same thing of 'find' method.

Like this:

```js
db.users.remove({
    id: { $in: [1, 2, 3] }
});
```

### MapReduce or MapReduceSync

Example (calculate an average):

```js
db.users.mapReduceSync(
    /* Map */
    () => {
        if (this.role == 'user') {
            emit('test', this.age);
        }
    },
    /* Reduce */
    (key, values) => {
        return values.reduce((acc, x) => acc + x) / values.length;
    }
);
```

## Bugs

In here, I enumerate the bugs detected during the development and tests.

### db.save()

The cache is not clear.

Fixed on September 18, 2019:

```js
/* Close the last stream */
this.handleCache.close();

/* Delete the file */
fs.unlinkSync(this.dbUse + '.tmp');

/* New stream */
this.handleCache = fs.createWriteStream(this.dbUse + '.tmp');
```

### A BSON file can't exceed 17MB

Currently, SteliaDb doesn't support the splitting of the data. But if we can't write more data ... bad!

Fixed on September 18, 2019:

```js
/* Replace the 17 MB limit with 1 GB */
this.bsonMaxSize = 1024 * 1024 * 1024;

/* Import the BSON library and set the new limit */
const bson = require('bson');
bson.setInternalBufferSize(this.bsonMaxSize);

/* We can serialize the database */
bson.serialize(this.dbStore);
```

### Conflict between two instances

Strange thing ... we can't create multi instance of SteliaDb with the same collection. I must understand the problem.

## Authors

-   Yarflam - _initial work_

## License

The project is licensed under Creative Commons (BY-NC-SA) - see the [LICENSE.md](LICENSE.md) file for details.
