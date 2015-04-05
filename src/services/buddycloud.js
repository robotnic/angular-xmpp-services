// actions:
// Actions for items: reply to item, delete, update, block user, like, make a user a moderator, change a user from a being able to post to being read-only

/**
* Buddycloud module provides a timeline.
@module buddycloud
*/


var BC = null;
var BCAPI = null;
var LIKE = null;




angular.module('BuddycloudModule', [])

.factory('BuddycloudFactory', ['$q',
    function($q) {
        return function(xmpp) {
            console.log("init buddycloud", xmpp);


            /**
            waiting for incomming json stranzas
            @method watch
            */
            function watch() {
                var q = api.q;


                xmpp.socket.on('xmpp.buddycloud.push.item', function(response) {
                    var isnew=true;

                    if (!api.data.unread[response.node]) {
                        api.data.unread[response.node] = 0;
                    }
                    api.data.unread[response.node]++;




                    if (response.node == api.data.currentnode || api.data.currentnode == 'recent') {
                        var ar = response.id.split(",");
                        var id = ar[ar.length - 1];
                        response.id = id;
                        for(var i=0;i<api.data.items.length;i++){
                            if(api.data.items[i].id==id){
                                isnew=false;
                            }
                        }
                        if(isnew){
                            itemMethods(response);
                            response.entry.atom.author.image = response.entry.atom.author.name.split("@")[0];
                            api.data.items.unshift(response);
                        }
                    }
                    q.notify("push item");
                    getAffiliations({node:response.node}).then(function() {
                        q.notify("affiliations after push item");
                    }, function(error) {
                        console.log(error);
                    });
                    api.send("xmpp.buddycloud.subscriptions",{node:response.node}).then(function(){
                        q.notify("subscriptions");
                    });
                });
                xmpp.socket.on('xmpp.buddycloud.push.delete', function(response) {
                    q.notify("xmpp.buddycloud.push.delete",response);
                    getAffiliations({node:response.node}).then(function() {
                        q.notify("affiliations after subscriptions");
                        api.send("xmpp.buddycloud.subscriptions",{}).then(function(){
                            q.notify("xmpp.buddycloud.subscriptions");
                        });
                    }, function(error) {
                        console.log(error);
                    });

                });

                xmpp.socket.on('xmpp.buddycloud.push.retract', function(response) {
                    for (var i = 0; i < api.data.items.length; i++) {
                        var id = api.data.items[i].id;
                        if (id == response.id) {
                            api.data.items.splice(i, 1);
                            q.notify("retract");
                            break;
                        }
                    }
                });



                xmpp.socket.on('xmpp.buddycloud.push.subscription', function(data) {
                    var forMe = false;
                    if (data.jid.user == api.xmpp.data.me.jid.user && data.jid.domain == api.xmpp.data.me.jid.domain) {
                        forMe = true;
                    }
                    var found = false;
                    //alert(data.subscription);
                    if (data.subscription !== 'none') {
                        for (var i = 0; i < api.data.subscriptions.length; i++) {
                            if (api.data.subscriptions[i].node == data.node) {
                                var found = true;
                                //api.data.subscriptions[i]=data;
                            }
                        }
                        if (!found) {
                            addToNodeList(data);
                        }
                    }
                    if (data.subscription == 'none') {
                        for (var i = 0; i < api.data.subscriptions.length; i++) {
                            if (api.data.subscriptions[i].node == data.node) {
                                var found = true;
                                if (false) {
                                    api.data.subscriptions.splice(i, 1);
                                    break;
                                }
                            }
                            api.data.subscribed = false;
                        }
                        if (!found) {
                            //addToNodeList(data);
                        }
                    }
                    if (data.subscription == 'subscribed') {
                        if (data.node == api.data.currentnode) {
                            api.data.subscribed = true;
                        }
                    }
                    getAffiliations({node:api.data.currentnode}).then(function() {
                        q.notify("affiliations after subscriptions");
                    }, function(error) {
                        console.log(error);
                    });

                });
                xmpp.socket.on("xmpp.buddycloud.push.affiliation", function(data) {
                    getAffiliations({
                        'node': data.node
                    }).then(function() {
                        getAffiliations().then(function(){
                            allMethods();
                            q.notify("affilations changed");
                        })
                    });
                });

                xmpp.socket.on("xmpp.buddycloud.push.configuration", function(data) {
                    console.log("config changed",data);
                    getAffiliations().then(function() {
                        //api.maketree(api.data.items);
                    });
                });
                return q.promise;


            }


            /**
            Add methods to node items
            */

            function itemMethods(item) {
                delete item.reply;
                delete item.remove;
                delete item.save;
                var rights=calcRights(item);

                if(rights.remove){
                    item.remove = function() {
                        //emoveitem(this.node,this.entry.atom.id)
                        removeitem(this)
                    };
                }
                if(rights.publish){
                    item.reply = function(text) {
                        xmpp.socket.send("xmpp.buddycloud.publish", {
                            node: item.node,
                            "content": {
                                "atom": {
                                    "content": text
                                },
                                "in-reply-to": {
                                    "ref": this.id
                                }
                            }
                        }, function(data) {
                            api.q.notify(data);
                        });
                    };
                }
                if(rights.update){
                    item.save = function() {
                        xmpp.socket.send("xmpp.buddycloud.publish", {
                            node: this.node,
                            "content": {
                                "atom": {
                                    "content": this.entry.atom.content
                                }
                            },
                            id: this.id
                        }, function(data) {
                            api.q.notify(data);
                        });
                    }
                }
            }


            /**
        @method search
        */


            function search(text) {
                var q = $q.defer();
                console.log("====", text);
                var stanza = {
                    form: [{
                        "var": 'content',
                        "value": text
                    }]
                };
                xmpp.socket.send(
                    'xmpp.buddycloud.search.do', stanza,
                    function(error, data) {
                        if (error) {
                            console.error(stanza, error);
                            //$scope.create(stanza.node);
                        } else {
                            console.log("search result:", data);
                            q.resolve("search result");
                        }
                    }
                );
                return q.promise;
            }


            /* not working
            function rate(node, ref) {
                var ar = ref.split(",");
                var id = ar[ar.length - 1];
                var stanza = {
                    node: node,
                    "content": {
                        activity: {
                            target: {
                                id: id
                            },
                            verb: 'rated'

                        }
                    }
                };
                xmpp.socket.send(
                    'xmpp.buddycloud.publish', stanza,
                    function(error, data) {
                        if (error) {
                            console.error(stanza, error);
                            //$scope.create(stanza.node);
                        } else {
                            console.log("Message rated.");
                        }
                    }
                );

            }

*/

            /**
            @method Buddycloud publish
            */
            function publish(data) {
                var q = $q.defer();
                xmpp.socket.send(
                    'xmpp.buddycloud.publish', data,
                    function(error, response) {
                        if (error) {
                            console.error(data.node, error);
                            //$scope.create(stanza.node);
                            api.data.errors.unshift(error);
                            q.reject(error);
                        } else {
                            q.resolve(response);
                            //            rate(node,data.id);
                        }
                    }
                );
                return q.promise;
            }


            /**
            @method removeitem
            */

           
            function removeitem(item) {
                var q = $q.defer();
                var id=item.entry.atom.id;
//                var id=item.id;
                var request={node:item.node,id:id};
                xmpp.socket.send(
                    'xmpp.buddycloud.item.delete', request,
                    function(error, data) {
                        if (error) {
                            console.error(error);
                            api.data.errors.unshift(error);
                            api.q.notify("error");
                            q.reject("deleted");
                        } else {
                            for (var i = 0; i < api.data.items.length; i++) {
                                if (api.data.items[i].entry.atom.id === id) {
                                    api.data.items.splice(i, 1);
                                    api.q.notify("deleted");
                                    q.resolve("deleted");
                                }
                            }
                        }
                    }
                );

                return q.promise;

            }
            
            /**
            @method calcRights
            @param item
            */

            //not in use
            function calcRights(item) {
                var write = false;
                var remove = false;
                if (api.data.myaffiliations[item.node]) {
                    var affiliation = api.data.myaffiliations[item.node].affiliation;
                    if (affiliation === "publisher" || affiliation === "owner" || affiliation === "moderator") {
                        write = true;
                    }
                    if (affiliation === "owner" || affiliation === "moderator") {
                        remove = true;
                    }
                }
                if (item.entry.atom.author.name == xmpp.data.me.jid.user+"@"+xmpp.data.me.jid.domain) {
                    remove = true;
                    update = true;
                }
                return {
                    publish: write,
                    remove: remove,
                    update: remove
                };

            }

            //https://github.com/buddycloud/buddycloud-server-java/issues/302
            function  removeDuplicates(response){
                var result=[];
                for(var i=0;i<response.length;i++){
                    var exists=false;
                    for(var j=0;j<api.data.items.length;j++){
                       if(response[i].id==api.data.items[j].id){
                            exists=true;
                            break;
                        } 
                    }
                    if(!exists){
                        result.push(response[i]);
                    }
                }
                return result;
            }


            function getAffiliations(request) {
                if (!request) request = {
                    node: null
                }; //ugly
                var node = request.node
                var q = $q.defer();
                if (false && api.data.affiliations[node]) {
                    nodeMethods();
                    q.resolve(api.data.affiliations);
                    api.q.notify(api.data.affiliations);
                } else {
                    xmpp.socket.send(
                        'xmpp.buddycloud.affiliations', request,
                        function(error, data) {
                            if (error) {
                                console.log(error);
                                q.reject(error);
                            } else {
                                if (!node) {
                                    api.data.myaffiliations = {};
                                    for (var i = 0; i < data.length; i++) {
                                        api.data.myaffiliations[data[i].node] = data[i];
                                    }
                     
                                } else {
                                    for (var i = 0; i < data.length; i++) {
                                        api.data.affiliations[data[i].node] = {};
                                    }
                                    for (var i = 0; i < data.length; i++) {
                                        if(!api.data.affiliations[data[i].node][data[i].affiliation]){
                                            api.data.affiliations[data[i].node][data[i].affiliation]=[];
                                        }
                                        api.data.affiliations[data[i].node][data[i].affiliation].push(data[i]);
                                    }
                                }
                                nodeMethods();
                                q.resolve(api.data.affiliations);
                                api.q.notify(api.data.affiliations);

                            }
                        }
                    );
                }
//                nodeMethods();
//                api.q.notify("durch1");
                return q.promise;
            };

            function allMethods(){
                    for(var i=0;i<api.data.items.length;i++){
                        itemMethods(api.data.items[i]);
                    }
                    nodeMethods();
            }



            /**
            enable/disable subscribe, unsubscribe, config, publish
            todo: ugly code
            */
            function nodeMethods() {
                delete api.publish;
                delete api.subscribe;
                delete api.unsubscribe;
                delete api.config;
                delete api.affiliation;
                api.data.subscribed = false;
                for (var i = 0; i < api.data.subscriptions.length; i++) {
                    if (api.data.subscriptions[i].node == api.data.currentnode) {
                        api.data.subscribed = true;
                    }
                }

                if (api.data.myaffiliations[api.data.currentnode] && api.data.myaffiliations[api.data.currentnode].affiliation == "owner") {
                    api.config = function() {
                        api.send('xmpp.buddycloud.config.get', {
                            node: this.data.currentnode
                        }).then(function(response) {
                            console.log("form", response);
                        });
                    }
                } else {
                    if (api.data.myaffiliations[api.data.currentnode]) {
                        api.data.nodeaffiliation = api.data.myaffiliations[api.data.currentnode].affiliation;
                    }
                    if (api.data.subscribed) {
                        api.unsubscribe = function() {
                            var that = this;
                            api.send('xmpp.buddycloud.unsubscribe', {
                                'node': this.data.currentnode
                            }).then(function(data) {
                                getAffiliations({
                                    'node': that.data.currentnode
                                }).then(function() {
                                    getAffiliations().then(function(){
                                        for(var i=0;i<api.data.items.length;i++){
                                            itemMethods(api.data.items[i]);
                                        }
                                        nodeMethods();
                                        api.q.notify("subscribed");
                                    });
                                }, function(error) {
                                    //api.data.errors.unshift(error);
                                });
                            }, function(error) {
                                api.data.errors.unshift(error);
                            });

                        }
                    } else {
                        api.subscribe = function() {
                            var that = this;
                            api.send('xmpp.buddycloud.subscribe', {
                                'node': that.data.currentnode
                            }).then(function() {
                                getAffiliations({
                                    'node': that.data.currentnode
                                }).then(function() {
                                    getAffiliations().then(function(){
                                        for(var i=0;i<api.data.items.length;i++){
                                            itemMethods(api.data.items[i]);
                                        }
                                        nodeMethods();
                                        api.q.notify("subscribed");
                                    });
                                });
                            });

                        }
                    }
                }
                
                if (api.data.subscribed && api.data.myaffiliations[api.data.currentnode]) {
                    var affiliation=api.data.myaffiliations[api.data.currentnode].affiliation;
                    if(affiliation=="publisher" || affiliation=="owner"){
                        api.publish = function(content) {
                            api.send('xmpp.buddycloud.publish', {
                                'node': this.data.currentnode,
                                'content': content
                            })
                        }
                    }
                }
                if(api.data.currentnode=="recent"){
                    api.publish = function(content) {
                            api.send('xmpp.buddycloud.publish', {
                                'node': '/user/' + this.xmpp.data.me.jid.user + '@' + this.xmpp.data.me.jid.domain + '/posts',
                                'content': content
                            });
                    }
                }
                if(api.data.myaffiliations[api.data.currentnode] && api.data.myaffiliations[api.data.currentnode].affiliation=='owner'){
                    api.affiliation = function(jid, affiliation) {
                        api.send('xmpp.buddycloud.affiliation', {
                            'node': this.data.currentnode,
                            'jid': jid,
                            'affiliation': affiliation
                        })
                    }
                }
            }


            /**
        @method makeNodeList
        */
            function makeNodeList(data) {
                api.data.subscriptions = [];
                for (var i = 0; i < data.length; i++) {
                    var nodeObj = xmpp.parseNodeString(data[i].node);
                    if (nodeObj.type == 'posts') {
                        addToNodeList(data[i]);
                    }
                }

            }

            /**
        @function open
        */

            function opennode(request) {
                var q=$q.defer();
                $q.all([
                    api.send('xmpp.buddycloud.retrieve', request),
                    api.send('xmpp.buddycloud.affiliations', request),
                    api.send('xmpp.buddycloud.affiliations', {}),
                    api.send('xmpp.buddycloud.config.get', request)
                ]).then(function() {
                    if (request.node == api.data.currentnode) {
                        //api.data.subscribed=true;
                    }
                    nodeMethods();
                    api.q.notify("opennode");
                    q.resolve();
                },function(error){
                    q.reject(error);
                });
                return q.promise;
            }

            function recent(request){
                $q.all([
                    api.send('xmpp.buddycloud.items.recent', request),
                 ]).then(function() {
                    nodeMethods();
                });
            }

            function loadmore(){
                if(api.data.rsm && api.data.rsmloading!=api.data.rsm.last && (!api.data.rsm.count || api.data.rsm.last)){
                    api.data.rsmloading=api.data.rsm.last; 
                    var rsm={
                        "max":10,
                        "after": api.data.rsm.last
                    }
                    if(api.data.currentnode=="recent"){
                        recent({rsm:rsm});
                    }else{
                        api.send("xmpp.buddycloud.retrieve",{node:api.data.currentnode,rsm:rsm});
                    }
                }
            }



            /**
        @method addToNodeList
        */
            function addToNodeList(data, forMe) {
                data.open = function() {
                    opennode(this);
                }
                api.data.subscriptions.push(data);
            }


            function subscription(data) {
                console.log("SUBSCRIPTION CHANGED", data);

            }


            /*
            todo: put switch after callback
            */


            function send(command, data) {
                if(!data)data={};
                switch (command) {
                    case 'xmpp.buddycloud.subscribe':
                        var q = $q.defer();
                        xmpp.socket.send(
                            'xmpp.buddycloud.subscribe', data,
                            function(error, response) {
                                if (error) {
                                    console.log(error);
                                    api.data.errors.unshift(error);
                                    q.reject(error);
                                } else {
                                    q.resolve(data);
                                    api.q.notify(data);
                                    //addToNodeList(response);
                                    /*
                                    api.data.rights = isSubscribed(data);
                                    api.getSubscribers(data).then(function(){
                                        q.resolve(response);
                                    });
                                    */
                                }
                            }
                        );
                        return q.promise;

                        break;
                    case 'xmpp.buddycloud.unsubscribe':
                        var q = $q.defer();
                        xmpp.socket.send(
                            'xmpp.buddycloud.unsubscribe',
                            data,
                            function(error, response) {
                                if (error) {
                                    console.log(error);
                                    api.data.errors.unshift(error);
                                    api.q.notify("error");
                                    q.reject(error);
                                } else {

                                    for (var i = 0; i < api.data.subscriptions.length; i++) {
                                        console.log("subscription bug", api.data.subscriptions[i].node , data.node) ;
                                        if (api.data.subscriptions[i].node == data.node) {
                                            api.data.subscriptions.splice(i, 1);
                                            delete api.data.myaffiliations[data.node];
                                            api.data.subscribed = false;
                                            nodeMethods();
                                            api.q.notify("unsubscribed");
                                            q.resolve(data);
                                            break;
                                        }
                                    }
                                }
                            }
                        );
                        return q.promise;

                        break;
                    case 'xmpp.buddycloud.subscriptions':
                        var q = $q.defer();
                        xmpp.socket.send(
                            'xmpp.buddycloud.subscriptions', {},
                            function(error, response) {
                                if (error) {
                                    api.data.errors.unshift(error);
                                    q.reject(error);
                                } else {
                                    makeNodeList(response);
                                    q.resolve(response);
                                    //api.q.notify(response);

                                }
                            }
                        );
                        return q.promise;

                        break;
                    case 'xmpp.buddycloud.subscription':
                        var q = $q.defer();
                        xmpp.socket.send(
                            'xmpp.buddycloud.subscription', data,
                            function(error, response) {
                                if (error) {
                                    api.data.errors.unshift(error);
                                    q.reject(error);
                                } else {
                                    subscription(response);
                                    q.resolve(response);

                                }
                            }
                        );
                        return q.promise;


                        break;
                    case 'xmpp.buddycloud.affiliations':
                        getAffiliations(data).then(function(data) {
                            //api.data.subscribers=data;
                        });
                        break;
                    case 'xmpp.buddycloud.retrieve':

                        var q = $q.defer();
                        if(!data.rsm){
                            data.rsm={rsm:{max:10}}
                            api.data.items=[]
                        }


                        //var node='/user/team@topics.buddycloud.org/posts';
                        xmpp.socket.send(
                            'xmpp.buddycloud.retrieve', data,
                            function(error, response, rsm) {
                                if (error) {
                                    q.reject(error);
                                } else {
                                    //workaround for buggy id
                                    for (var i = 0; i < response.length; i++) {
                                        response[i].id = response[i].id.split(",").pop();
                                        itemMethods(response[i]);
                                    }


                                    api.data.items = api.data.items.concat(response);

                                    //api.data.tree = maketree(api.data.items);
                                    //api.data.rights = isSubscribed(data.node);
                                    api.data.unread[data.node] = 0;
                                    api.data.rsm = rsm;
                                    api.data.currentnode = data.node;
                                    nodeMethods();
                                    q.resolve(response);
                                }
                            }
                        );
                        return q.promise;


                        break;
                    case 'xmpp.buddycloud.items.recent':
                        var q = $q.defer();
                        if(!data.rsm){
                            data={rsm:{max:10}}
                            api.data.items=[]
                        }
                        xmpp.socket.send(
                            'xmpp.buddycloud.items.recent',
                            data,
                            function(error, response, rsm) {
                                if (error) {
                                    api.data.errors.unshift(error);
                                    q.reject(error);
                                } else {
                                    //https://github.com/buddycloud/buddycloud-server-java/issues/302
                                    response=removeDuplicates(response);
                                    //workaround for buggy id
                                    for (var i = 0; i < response.length; i++) {
                                        response[i].id = response[i].id.split(",").pop();
                                        itemMethods(response[i]);
                                    }

                                    api.data.items = api.data.items.concat(response);
                                    //api.data.tree = maketree(api.data.items); 
                                    q.resolve(data);
                                    api.data.rsm = rsm;
                                    api.data.currentnode = "recent"; //not beautiful programming
                                    nodeMethods();
                                    api.q.notify("recent");
                                }
                            }
                        );
                        return q.promise;
                        break;
                     case 'xmpp.buddycloud.items.feed':
                        var append = false;
                        var q = $q.defer();
                        /*
                        var rsm = {
                            max: 10
                        };
                        */
                        if(!data.rsm){
                            data={rsm:{max:10}}
                        }
                        xmpp.socket.send(
                            'xmpp.buddycloud.items.feed',
                            data,
                            function(error, response, rsm) {
                                if (error) {
                                    api.data.errors.unshift(error);
                                    q.reject(error);
                                } else {
                                    //workaround for buggy id
                                    for (var i = 0; i < response.length; i++) {
                                        response[i].id = response[i].id.split(",").pop();
                                        itemMethods(response[i]);
                                    }

                                    if (api.data.items) {
                                        api.data.items = api.data.items.concat(response);
                                    } else {
                                        api.data.items = response;
                                    }
                                    //api.data.tree = maketree(api.data.items); 
                                    q.resolve(data);
                                    api.data.rsm = rsm;
                                    api.data.currentnode = "recent"; //not beautiful programming
                                    nodeMethods();
                                    api.q.notify("feed");
                                }
                            }
                        );
                        return q.promise;

                        break;
                    case 'xmpp.buddycloud.item.delete':
                        return removeitem(data);
                        var q = $q.defer();
                        xmpp.socket.send(
                            'xmpp.buddycloud.item.delete', data,
                            function(error, data) {
                                if (error) {
                                    api.data.errors.unshift(error);
                                    api.q.notify("delete error");
                                    q.reject("deleted");
                                } else {
                                    for (var i = 0; i < api.data.items.length; i++) {
                                        if (api.data.items[i].entry.atom.id === id) {
                                            api.data.items.splice(i, 1);
                                            api.q.notify("deleted");
                                            q.resolve("deleted");
                                        }
                                    }
                                }
                            }
                        );

                        return q.promise;

                        break;
                    case 'xmpp.buddycloud.config.get':
                        var q = $q.defer();
                        xmpp.socket.send(
                            'xmpp.buddycloud.config.get',
                            data,
                            function(error, response) {
                                if (error) {
                                    api.data.errors.unshift(error);
                                    q.reject(error);
                                } else {
                                    api.data.config = response;
                                    api.q.notify("config");
                                    q.resolve(response);
                                }
                            }
                        );
                        return q.promise;

                        break;
                    case 'xmpp.buddycloud.presence':
                        xmpp.socket.send( 'xmpp.buddycloud.presence', data);
                        break;
                    default:
                        var q = $q.defer();
                        xmpp.socket.send(
                            command,data,
                            function(error, response) {
                                if (error) {
                                    api.data.errors.unshift(error);
                                    api.q.notify("error");
                                    q.reject(error);
                                } else {
                                    q.resolve(response);
                                }
                            }
                        );
                        return q.promise;
                }
            }



            /**
            Public API;
            */


            var api = {
                version:"0.4.6",
                q: xmpp.q,
                data: {
                    unread: {},
                    items: [],
                    tree: {},
                    subscriptions: [],
                    affiliations: {},
                    myaffiliations: {},
                    errors:[]
                },
                xmpp: xmpp,
                open: function(data) {
                    return opennode(data);
                },
                recent:function(){
                    return recent();
                },
                loadmore:function(){
                    return loadmore();
                },
                send: function(command, data) {
                    return send(command, data);
                },
                createNode:function(request){
                    var q=$q.defer();
                    api.send("xmpp.buddycloud.create",request).then(function(data){
                        api.send("xmpp.buddycloud.subscriptions",{}).then(function(){
                            api.q.notify("xmpp.buddycloud.subscriptions");
                            q.resolve(data);
                        })
                    });
                    return q.promise;
                },
                deleteNode:function(request){
                    var q=$q.defer();
                    api.send("xmpp.buddycloud.delete",request).then(function(data){
                        api.send("xmpp.buddycloud.subscriptions",{}).then(function(){
                            api.q.notify("xmpp.buddycloud.subscriptions");
                            q.resolve(data);
                        })
                    })
                    return q.promise;
 
                },
                init: function() {
                    var q=$q.defer();
                    api.send('xmpp.buddycloud.discover', {}).then(function() {
                        q.resolve();
                        api.q.notify("init");
                        api.send('xmpp.buddycloud.register', {});
                        api.send('xmpp.buddycloud.subscriptions', {});
                        api.send('xmpp.buddycloud.affiliations', {});
                        api.send('xmpp.buddycloud.presence', {});
                    }, function(error) {
                        api.data.errors.unshift(error);
                        q.reject("error");
                    });
                    return q.promise;
                }

            };
            watch();
            BCAPI = api;
            return api;
        };
    }
])


