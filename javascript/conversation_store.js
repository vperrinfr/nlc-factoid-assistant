var cloudant = require('cloudant');
var bluemix  = require('../config/bluemix');
var extend   = require('util')._extend;

var CONVERSATIONS_DATABASE = 'ipa_conversations';

function ConversationStore(watson) {

    // If bluemix credentials (VCAP_SERVICES) are present then override the local credentials
    watson.config.cloudant =  extend(watson.config.cloudant, bluemix.getServiceCreds('cloudantNoSQLDB')); // VCAP_SERVICES

    if (watson.config.cloudant.url.indexOf("http") >= 0) {

        // Otherwise the use hasn't configured the app to track user text submissions.

        this.conversationsDB = null;
        var cloudantService = cloudant({account:watson.config.cloudant.username, password:watson.config.cloudant.password});
        cloudantService.db.list(function(err, allDbs) {

            //destroyDatabase();
            if(typeof allDbs != 'undefined'){
                for (var i = 0; i < allDbs.length; i++) {
                    if (allDbs[0] == CONVERSATIONS_DATABASE) {
                        this.conversationsDB = cloudantService.db.use(CONVERSATIONS_DATABASE)
                        console.log('Cloudant database ready');
                        return;
                    }
                }
            }
            createDatabase();
        });
    }
}

ConversationStore.prototype.storeConversation = function(conversationObj) {

    // if{} here has two effects:
    // 1. Avoid errors if cloudant service not enabled
    // 2. database creation can take awhile first time app launches so prevent errors
    if (this.conversationsDB) {
        conversationObj._id = conversationObj.dialog_id + "_" + conversationObj.conversation_id;
        this.conversationsDB.insert(conversationObj,function(err, body, header) {
            if (err) {
                updateConversation(conversationObj);
            }else{
                var conversationJson = JSON.stringify(conversationObj, null, 2);
                console.log('Inserted conversation: ' + conversationJson);
            }
        });
    }
}

ConversationStore.prototype.updateConversation = function(conversationObj) {

    this.conversationsDB.get(conversationObj._id,{ revs_info: true },function(err, body, header) {
        if (err) {
            console.log('conversationsDB.get failed', JSON.stringify(err));
            module.exports.storeConversation(conversationObj);
        }else{
            conversationObj._rev = body._rev;
            module.exports.storeConversation(conversationObj);
        }
    });
}

ConversationStore.prototype.printConversations = function(conversationObj) {

    var conversations = initDatabase();

    // fetch the primary index
    conversations.list(function(err, body){
        if (err) {
            // something went wrong!
            throw new Error(err);
        } else {
            // print all the documents in our database
            console.log(body);
        }
    });
}

ConversationStore.prototype.createDatabase = function() {
    cloudantService.db.create(CONVERSATIONS_DATABASE, function(err) {
        if (err) {
            console.log('Failure to create the cloudant database', JSON.stringify(err));
        } else {
            this.conversationsDB = cloudantService.db.use(CONVERSATIONS_DATABASE)
            console.log('Created Cloudant database');
        }
    });
}

ConversationStore.prototype.destroyDatabase = function() {
    cloudantService.db.destroy(CONVERSATIONS_DATABASE, function(err) {
        console.log('Destroyed Cloudant database');
        createDatabase();
    });
}

// Exported class
module.exports = ConversationStore;
