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
                            addMethods(response);
                            response.entry.atom.author.image = response.entry.atom.author.name.split("@")[0];
                            api.data.items.push(response);
                        }
                    }
                    q.notify("push item");
                });

                xmpp.socket.on('xmpp.buddycloud.push.retract', function(response) {
                    for (var i = 0; i < api.data.items.length; i++) {
                        var id = api.data.items[i].id;
                        if (id == response.id) {
                            api.data.items.splice(i, 1);
                            break;
                        }
                    }
                    q.notify("retract");
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
                        q.notify("affilations changed");
                    });
                });

                xmpp.socket.on("xmpp.buddycloud.push.configuration", function(data) {
                    getAffiliations().then(function() {
                        //api.maketree(api.data.items);
                    });
                });
                return q.promise;


            }


            /**
            Add methods to node items
            */

            function addMethods(item) {

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

            /* This will go to an other module
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
*/

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
                            console.log("affiliation data",data);
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


            function nodeMethods() {
                delete api.subscribe;
                delete api.unsubscribe;
                delete api.config;
                delete api.affiliation;
                if (api.data.myaffiliations[api.data.currentnode] && api.data.myaffiliations[api.data.currentnode].affiliation == "owner") {
                    api.config = function() {
                        api.send('xmpp.buddycloud.config.get', {
                            node: this.data.currentnode
                        }).then(function(response) {
                            console.log("form", response);
                        });
                    }
                } else {
                    api.data.subscribed = false;
                    for (var i = 0; i < api.data.subscriptions.length; i++) {
                        if (api.data.subscriptions[i].node == api.data.currentnode) {
                            api.data.subscribed = true;
                        }
                    }
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
                                    api.q.notify("unsubscribed");
                                    //api.maketree(api.data.items);
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
                                    api.q.notify("subscribed");
                                });
                            });

                            //add user to roster !!!!!!!!!!!!!!!!!!!

                            var jid=that.xmpp.parseNodeString(that.data.currentnode).jid;
                            api.xmpp.send('xmpp.roster.add', {
                                "jid": jid
                            }).then(function(data){
                                api.q.notify("user added");
                            });
                        }
                    }
                }
                api.publish = function(content) {
                    if (this.data.currentnode == "recent") {
                        api.send('xmpp.buddycloud.publish', {
                            'node': '/user/' + api.xmpp.data.me.jid.user + '@' + api.xmpp.data.me.jid.domain + '/posts',
                            'content': content
                        });
                    } else {
                        api.send('xmpp.buddycloud.publish', {
                            'node': this.data.currentnode,
                            'content': content
                        })
                    }
                }
                api.affiliation = function(jid, affiliation) {
                    api.send('xmpp.buddycloud.affiliation', {
                        'node': this.data.currentnode,
                        'jid': jid,
                        'affiliation': affiliation
                    })
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
                });

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
                        var start = 0;
                        var max = 10;
                        var q = $q.defer();
                        var append = false;
                        if (start === 0) {
                            api.data.rsm = null;
                        }
                        var rsm = {
                            max: max
                        };
                        if (api.data.rsm) {
                            rsm.after = api.data.rsm.last;
                            append = true; //concat result
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
                                        addMethods(response[i]);
                                    }


                                    if (append) {
                                        api.data.items = api.data.items.concat(response);
                                    } else {
                                        api.data.items = response;
                                    }

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
                        var append = false;
                        var q = $q.defer();
                        var rsm = {
                            max: 10
                        };
                        xmpp.socket.send(
                            'xmpp.buddycloud.items.recent',
                            data,
                            function(error, response, rsm) {
                                if (error) {
                                    api.data.errors.unshift(error);
                                    q.reject(error);
                                } else {
                                    //workaround for buggy id
                                    for (var i = 0; i < response.length; i++) {
                                        response[i].id = response[i].id.split(",").pop();
                                        addMethods(response[i]);
                                    }

                                    if (append) {
                                        api.data.items = api.data.items.concat(items);
                                    } else {
                                        api.data.items = response;
                                    }
                                    //api.data.tree = maketree(api.data.items); 
                                    q.resolve(data);
                                    api.data.rsm = rsm;
                                    api.data.currentnode = "recent"; //not beautiful programming
                                    api.q.notify("recent");
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
                        break;
                }
            }



            /**
            Public API;
            */


            var api = {
                q: xmpp.q,
                data: {
                    unread: {},
                    nodes: [],
                    subscriptions: [],
                    affiliations: {},
                    myaffiliations: {},
                    errors:[]
                },
                xmpp: xmpp,
                open: function(data) {
                    return opennode(data);
                },
                send: function(command, data) {
                    return send(command, data);
                },
                init: function() {
                    var q=$q.defer();
                    api.send('xmpp.buddycloud.discover', {}).then(function() {
                        q.resolve();
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


/*
.filter('getUser', function() {
    return function(item) {
        if (item.indexOf("@") !== -1) {
            return item.split("@")[0];
        } else {
            return item;
        }
    }
})



//http://stackoverflow.com/questions/19992090/angularjs-group-by-directive

.filter('groupBy', ['$parse',
    function($parse) {
        return function(list, group_by) {

            var filtered = [];
            var prev_item = null;
            var group_changed = false;
            // this is a new field which is added to each item where we append "_CHANGED"
            // to indicate a field change in the list
            //was var new_field = group_by + '_CHANGED'; - JB 12/17/2013
            var new_field = 'group_by_CHANGED';

            // loop through each item in the list
            angular.forEach(list, function(item) {

                group_changed = false;

                // if not the first item
                if (prev_item !== null) {

                    // check if any of the group by field changed

                    //force group_by into Array
                    group_by = angular.isArray(group_by) ? group_by : [group_by];

                    //check each group by parameter
                    for (var i = 0, len = group_by.length; i < len; i++) {
                        if ($parse(group_by[i])(prev_item) !== $parse(group_by[i])(item)) {
                            group_changed = true;
                            break;
                        }
                    }


                } // otherwise we have the first item in the list which is new
                else {
                    group_changed = true;
                }

                // if the group changed, then add a new field to the item
                // to indicate this
                if (group_changed) {
                    item[new_field] = true;
                } else {
                    item[new_field] = false;
                }

                filtered.push(item);
                prev_item = item;

            });

            return filtered;
        };
    }
]);

*/
