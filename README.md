# Octobag

Transform a GitHub repository into a simple document-oriented database.

## Usage

```js
var db = new Octobag({
  user: 'USER_NAME',
  repo: 'REPO_NAME',
  auth: 'oauth',
  token: 'OAUTH_TOKEN'
});
```

## Collection

List all collections inside the repository.

```js
coll.collections(function(err, colls) {
  if (err) console.error(err);
});
```

Use a collection (it will only be created when you put some document in it).

```js
var coll = db.collection('products');
```

Insert a document into the collection.

```js
var docKey = 1;
var docVal = {name: 'iPhone', brand: 'Apple'};
coll.put(docKey, docVal, function(err) {
  if (err) console.error(err);
  else console.log('success');
});
```

Get a document by key.

```js
coll.get(1, function(err, doc) {
  if (err) console.error(err);
});
```

Delete a document by key.

```js
coll.delete(1, function(err, doc) {
  if (err) console.error(err);
});
```

List document keys inside the collection.

```js
coll.list(function(err, keys) {
  if (err) console.error(err);
});
```

Get the number of documents inside the collection.

```js
coll.count(function(err, count) {
  if (err) console.error(err);
});
```

Drop the collection.

```js
coll.drop(function(err) {
  if (err) console.error(err);
});
```
