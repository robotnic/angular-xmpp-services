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


            /**
            waiting for incomming json stranzas
            @method watch
            */
            function watch() {
                var q = api.q;

                //Notification of new messages 
                xmpp.socket.on('xmpp.buddycloud.push.item', function(response) {
                    pushItem(response);
                });

                function pushItem(response){
                    var isnew=true;

                    if (!api.data.unread[response.node]) {
                        api.data.unread[response.node] = 0;
                    }
                    api.data.unread[response.node]++;
                    api.data.totalunread++;

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
                            //response.entry.atom.author.image = response.entry.atom.author.name.split("@")[0];
                            api.data.items.unshift(response);
                            addToTree(response,null,true);
                        }
                    }
                    q.notify("xmpp.buddycloud.push.item");
                    getAffiliations({node:response.node}).then(function() {
                        q.notify("affiliations after push item");
                    }, function(error) {
                        console.log(error);
                    });
                    api.send("xmpp.buddycloud.subscriptions",{node:response.node}).then(function(){
                        q.notify("xmpp.buddycloud.subscriptions");
                    });
                    api.notification(response);
                };

                //Item deletion notification
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

                //a message was deleted
                xmpp.socket.on('xmpp.buddycloud.push.retract', function(response) {
                    for (var i = 0; i < api.data.items.length; i++) {
                        var id = api.data.items[i].id;
                        if (id == response.id) {
                            removeFromTree(api.data.items[i]);
                            api.data.items.splice(i, 1);
                            q.notify("xmpp.buddycloud.push.retract");
                            break;
                        }
                    }
                });


                //notification-of-a-subscription-change
                xmpp.socket.on('xmpp.buddycloud.push.subscription', function(data) {
                    pushSubscription(data);
                });

                //fallback for superfeeder side effect on xmpp-ftw
                xmpp.socket.on('xmpp.pubsub.push.subscription', function(data) {
                    pushSubscription(data);
                });

                xmpp.socket.on('fanout.fpp.push', function(data) {
                    pushSubscription(data);
                });

                function pushSubscription(data){
                    delete data.from;  //superfeeder side effect
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

                };

                //Notification of affiliation changes
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

                //Node configuration update notification
                xmpp.socket.on("xmpp.buddycloud.push.configuration", function(data) {
                    getAffiliations().then(function() {
                        //api.maketree(api.data.items);
                    });
                });

                //Subscription authorisation request
                xmpp.socket.on('xmpp.buddycloud.push.authorisation', function(data, callback) {
                    console.log("xmpp.buddycloud.push.authorisation  not implemented",data)
                    //callback( /* see below */ )
                })

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
                        removeitem(this)
                    };
                }
                if(rights.publish){
                    //to do, make function
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
                            api.q.notify("xmpp.buddycloud.publish");
                        });
                    };
                }

                /* not working
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
                */
            }


            /**
        @method search
        */


            function search(text) {
                var q = $q.defer();
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
                var id=item.entry.atom.id;  //this works
//                var id=item.id;  //this should work
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
                            /*
                            for (var i = 0; i < api.data.items.length; i++) {
                                if (api.data.items[i].entry.atom.id === id) {
                                    removeFromTree(api.data.items[i]);
                                    api.data.items.splice(i, 1);
                                    api.q.notify("deleted");
                                    q.resolve("deleted");
                                }
                            }
                            */
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

            function makeConfigObject(response){
                api.data.configobj= {};
                for(var i=0;i<response.length;i++){
                    api.data.configobj[response[i].var]=response[i].value;
                }
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
                            //console.log("form", response);
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


            function addToTree(item,rsm,atTop){
                var issubitem=false;
                if(!item.entry['in-reply-to'] ){
                    loadChildnodes(item);
                }
                for(var i=0;i<api.data.tree.length;i++){
                    var treeitem=api.data.tree[i];
                    if(item.entry['in-reply-to'] && item.entry['in-reply-to'].ref==treeitem.id){
                        if(!treeitem.children){
                            treeitem.children=[];
                        }
                        if(angular.isArray(treeitem.children)){
                            treeitem.children.push(item);
                            var issubitem=true;  //what's that? ugly
                        }
                        if(rsm){
                            treeitem.rsm=rsm;
                        }
                        break;
                    } 

                }
                if(!issubitem){
                    if(atTop){
                        api.data.tree.unshift(item);
                    }else{
                        api.data.tree.push(item);
                    }
                    
                }
            }

            function removeFromTree(item){
                var issubitem=false;
                for(var i=0;i<api.data.tree.length;i++){
                    var treeitem=api.data.tree[i];
                    if(item.entry['in-reply-to'] && item.entry['in-reply-to'].ref==treeitem.id){
                        if(treeitem.children){
                            for(var j=0;j<treeitem.children.length;j++){
                                if(treeitem.children[j].id==item.id){
                                    treeitem.children.splice(j,1);        
                                    var issubitem=true;
                                    break;
                                }
                            }
                        }
                    }
                    if(!issubitem){
                        if(item.id==treeitem.id){
                            api.data.tree.splice(i,1);
                        }
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
                    //api.send('xmpp.buddycloud.affiliations', request),
                    api.send('xmpp.buddycloud.affiliations', {}),
                    api.send('xmpp.buddycloud.config.get', request)
                ]).then(function() {
                    if (request.node == api.data.currentnode) {
                        api.data.subscribed=true;
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
                 ]).then(function(response) {
                    //loadChildnodes(response[0]); 
                    nodeMethods();
                });
            }

            function loadChildnodes(item){

                //for(var i=0;i<api.data.tree.length;i++){
                 //   var item=api.data.tree[i];
                    
                    api.send( 'xmpp.buddycloud.items.replies', {
                        "node": item.node,
                        "id": item.id,
                        rsm:{max:3}
                    }).then(function(){
                        //console.log(arguments); //no idea what's happening here
                    });



            }

            function loadmore(request){
                if(api.data.rsm && api.data.rsmloading!=api.data.rsm.last && (!api.data.rsm.count || api.data.rsm.last)){
                    api.data.rsmloading=api.data.rsm.last; 
                    var rsm={
                        "max":10,
                        "after": api.data.rsm.last
                    }
                    if(!request)request={};
                    request.rsm=rsm;
                    if(api.data.currentnode=="recent"){
                        recent(request);
                    }else{
                        request.node=api.data.currentnode;
                        api.send("xmpp.buddycloud.retrieve",request).then(function(data){
                            api.q.notify();
                        },function(error){
                            console.log(error);
                        });
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

            }


            /*
            todo: put switch after callback
            */


            function send(command, request) {
                if(!request)request={};
                switch (command) {
                    case 'xmpp.buddycloud.subscribe':
                        var q = $q.defer();
                        xmpp.socket.send(
                            'xmpp.buddycloud.subscribe', request,
                            function(error, response) {
                                if (error) {
                                    console.log(error);
                                    api.data.errors.unshift(error);
                                    q.reject(error);
                                } else {
                                    q.resolve(request);
                                    api.q.notify(command);
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
                            request,
                            function(error, response) {
                                if (error) {
                                    console.log(error);
                                    api.data.errors.unshift(error);
                                    api.q.notify("error");
                                    q.reject(error);
                                } else {

                                    for (var i = 0; i < api.data.subscriptions.length; i++) {
                                        if (api.data.subscriptions[i].node == request.node) {
                                            api.data.subscriptions.splice(i, 1);
                                            delete api.data.myaffiliations[request.node];
                                            api.data.subscribed = false;
                                            nodeMethods();
                                            api.q.notify("xmpp.buddycloud.unsubscribe");
                                            q.resolve(request);
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
                            'xmpp.buddycloud.subscription', request,
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
                        getAffiliations(request).then(function(data) {
                            //api.data.subscribers=data;
                        });
                        break;
                    case 'xmpp.buddycloud.retrieve':

                        api.data.requested = request.node;
                        var q = $q.defer();
                        if(!request.rsm){
                            request.rsm={max:20}
                            api.data.items=[];
                            api.data.tree=[];
                        }


                        //var node='/user/team@topics.buddycloud.org/posts';
                        xmpp.socket.send(
                            'xmpp.buddycloud.retrieve', request,
                            function(error, response, rsm) {
                                if (error) {
                                    q.reject(error);
                                } else {
                                    for (var i = 0; i < response.length; i++) {
                                        //workaround for buggy id
                                        response[i].id = response[i].id.split(",").pop();
                                        itemMethods(response[i]);
                                        addToTree(response[i],rsm);
                                    }


                                    api.data.items = api.data.items.concat(response);

                                    //api.data.tree = maketree(api.data.items);
                                    //api.data.rights = isSubscribed(data.node);
                                    api.data.totalunread-=parseInt(api.data.unread[request.node],10);
                                    api.data.unread[request.node] = 0;
                                    api.data.rsm = rsm;
                                    api.data.currentnode = request.node;
                                    nodeMethods();
                                    q.resolve(response);
                                }
                            }
                        );
                        return q.promise;


                        break;
                    case 'xmpp.buddycloud.items.recent':
                        api.data.requested = request.node;
                        var parentOnly=false;
                        if(request.parentOnly){
                            parentOnly=true;
                        }
                        var q = $q.defer();
                        if(!request.rsm || !request.rsm.after){
                            request={rsm:{max:20},parentOnly:parentOnly}
                            api.data.items=[];
                            api.data.tree=[];
                        }
                        xmpp.socket.send(
                            'xmpp.buddycloud.items.recent',
                            request,
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
                                        addToTree(response[i],rsm);
                                    }

                                    api.data.items = api.data.items.concat(response);
                                    //api.data.tree = maketree(api.data.items); 
                                    q.resolve(response);
                                    api.data.rsm = rsm;
                                    api.data.currentnode = "recent"; //not beautiful programming
                                    nodeMethods();
                                    api.q.notify("xmpp.buddycloud.items.recent");
                                }
                            }
                        );
                        return q.promise;
                        break;
                     case 'xmpp.buddycloud.items.feed':
                        api.data.requested = request.node;
                        var append = false;
                        var q = $q.defer();
                        /*
                        var rsm = {
                            max: 10
                        };
                        */
                        if(!request.rsm){
                            request={rsm:{max:20}}
                        }
                        xmpp.socket.send(
                            'xmpp.buddycloud.items.feed',
                            request,
                            function(error, response, rsm) {
                                if (error) {
                                    api.data.errors.unshift(error);
                                    q.reject(error);
                                } else {
                                    //workaround for buggy id
                                    for (var i = 0; i < response.length; i++) {
                                        response[i].id = response[i].id.split(",").pop();
                                        itemMethods(response[i]);
                                        addToTree(response[i],rsm);
                                    }

                                    if (api.data.items) {
                                        api.data.items = api.data.items.concat(response);
                                    } else {
                                        api.data.items = response;
                                    }
                                    //api.data.tree = maketree(api.data.items); 
                                    q.resolve(request);
                                    api.data.rsm = rsm;
                                    api.data.currentnode = request.node;
                                    nodeMethods();
                                    api.q.notify("xmpp.buddycloud.items.feed");
                                }
                            }
                        );
                        return q.promise;

                        break;
                    case 'xmpp.buddycloud.item.delete':
                        return removeitem(request);
                        var q = $q.defer();
                        xmpp.socket.send(
                            'xmpp.buddycloud.item.delete', request,
                            function(error, data) {
                                if (error) {
                                    api.data.errors.unshift(error);
                                    api.q.notify("delete error");
                                    q.reject("deleted");
                                } else {
                                    /*
                                    for (var i = 0; i < api.data.items.length; i++) {
                                        if (api.data.items[i].entry.atom.id === id) {
                                            removeFromTree(api.data.items[i]);
                                            api.data.items.splice(i, 1);
                                            api.q.notify("deleted");
                                            q.resolve("deleted");
                                        }
                                    }
                                    */
                                }
                            }
                        );

                        return q.promise;

                        break;


/*
3:::{"type":0,"data":["xmpp.buddycloud.items.replies",{"node":"/user/oldhouse@buddycloud.org/posts","id":"f4787723-e431-4c2b-9e96-d26b13a5fc2a","rsm":{"max":1}}],"id":13}
*/

                    case 'xmpp.buddycloud.items.replies':
                        var q = $q.defer();
                        xmpp.socket.send(
                            'xmpp.buddycloud.items.replies', request,
                            function(error, response,rsm) {
                                if (error) {
                                    api.data.errors.unshift(error);
                                    q.reject(error);
                                } else {
                                    for (var i = 0; i < response.length; i++) {
                                        response[i].id = response[i].id.split(",").pop();
                                        itemMethods(response[i]);
                                        addToTree(response[i],rsm);
                                    }

                                    api.q.notify('xmpp.buddycloud.item.replies');
                                    q.resolve(response);
                                }

                            })
                        return q.promise;

                        break;

                    case 'xmpp.buddycloud.config.get':
                        var q = $q.defer();
                        xmpp.socket.send(
                            'xmpp.buddycloud.config.get',
                            request,
                            function(error, response) {
                                if (error) {
                                    api.data.errors.unshift(error);
                                    q.reject(error);
                                } else {
                                    api.data.config = response;
                                    makeConfigObject(response);
                                    api.q.notify('xmpp.buddycloud.config.get');
                                    q.resolve(response);
                                }
                            }
                        );
                        return q.promise;

                        break;
                    case 'xmpp.buddycloud.presence':
                        xmpp.socket.send( 'xmpp.buddycloud.presence', request);
                        break;
                    default:
                        var q = $q.defer();
                        xmpp.socket.send(
                            command,request,
                            function(error, response) {
                                if (error) {
                                    api.data.errors.unshift(error);
                                    api.q.notify("error");
                                    q.reject(error);
                                } else {
                                    q.resolve(response);
                                    switch(command){
                                        case "xmpp.login":

                                            break;

                                    }
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
                    totalunread: 0,
                    items: [],
                    tree: [],
                    subscriptions: [],
                    affiliations: {},
                    myaffiliations: {},
                    errors:[]
                },
                xmpp: xmpp,
                open: function(data) {
                    return opennode(data);
                },
                recent:function(rsm){
                    return recent(rsm);
                },
                loadmore:function(request){
                    return loadmore(request);
                },
                send: function(command, data) {
                    return send(command, data);
                },
                notification: function(command, data) {
                    this.notificationCallback(command,data);
                },
                onnotification:function(callback){
                    this.notificationCallback=callback;
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


