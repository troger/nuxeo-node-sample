'use strict';

// require the nuxeo lib
var nuxeo = require('nuxeo');

// create the Nuxeo client
var client = new nuxeo.Client({
  baseURL: 'http://localhost:8080/nuxeo/',
  username: 'Administrator',
  password: 'Administrator'
});

// check for --dry-run option
var dryRun = false;
var args = process.argv.slice(2);
if (args.length > 0 && args[0] === '--dry-run') {
   dryRun = true;
}

// connect to nuxeo
client.connect(function(error, client) {
  if (error) {
    console.log('Cannot connect to Nuxeo server');
    throw new Error(error);
  }

  // do the update
  var query = "SELECT * FROM Document"
    + " WHERE ecm:primaryType = 'File'"
    + " AND ecm:path STARTSWITH '/default-domain/workspaces/'"
    + " AND content/data IS NOT NULL"
    + " AND dc:title <> content/name"
    + " AND ecm:isProxy = 0 AND ecm:isCheckedInVersion = 0 AND ecm:currentLifeCycleState != 'deleted'"
  var request = client.request('/').schema(['dublincore', 'file'])
    .path('@search')
    .query({
      'query': query,
    });

  var updatedDocsCount = 0,
    totalDocsToUpdate = 0;

  function processEntries(entries) {
    for (var i = 0; i < entries.length; i++) {
      var doc = client.document(entries[i]);
      if (doc.properties['file:content'] && doc.properties['file:content'].name
        && doc.properties['dc:title'] !== doc.properties['file:content'].name) {
        if (dryRun) {
          console.log("Will rename '" + doc.title + "' to '" + doc.properties["file:content"].name + "'");
        } else {
          doc.set({'dc:title' : doc.properties['file:content'].name })
          doc.save(function(error, data) {
            if (error) {
              console.log('Error while saving document');
              throw new Error(error);
            }
            console.log("Successfully renamed '" + data.title + '"');
            updatedDocsCount++;
            if (updatedDocsCount >= totalDocsToUpdate) {
              // finish updating
              console.log('Successfully updated ' + updatedDocsCount + ' documents.');
            }
          });
        }
      }
    }
  }

  request.execute(function(error, data) {
    if (error) {
      console.log('Error while fetching documents');
      throw new Error(error);
    }
    totalDocsToUpdate = data.totalSize;
    console.log('Starting updating ' + totalDocsToUpdate + ' documents');
    // process the first page
    processEntries(data.entries);

    // iterate over all the next pages (using the currentPageIndex parameter to retrieve the right page)
    for (var i = 1; i < data.pageCount; i++) {
      request.query({ currentPageIndex: i }).execute(function(error, data) {
        if (error) {
          console.log('Error while fetching documents');
          throw new Error(error);
        }

        processEntries(data.entries);
      })
    }
  });
});
