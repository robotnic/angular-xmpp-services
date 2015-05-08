/**
XmppCore
@module
@params 9
*/


angular.module('XmppCoreFactory', ['XmppMessages'])



.factory("Xmpp",function($q,MessagesFactory){
    return function(host,callback){
        console.log("New XMPP init");


        /**
        Listen to incoming json stanzas
        @method watch
        */    

        function watch(){
            var q=$q.defer();
            api.q=q;

            //messages are in a seperat Factory
            api.messages=new MessagesFactory(api);

            //roster change
            api.socket.on('xmpp.connection', function(data) {
                console.log("loged in",data);
                api.model.me=data;
                api.model.connected=true;
                q.notify("xmpp.connection");
            },function(error){
                api.connected=false;
                api.model.errors.unshift(error);
                q.notify("login error");
            });
            api.socket.on('xmpp.logout', function(data) {
                api.connected=false;
                resetModel();
                q.notify("xmpp.logout");
            });

            api.socket.on('xmpp.roster.push', function(data) {
                var exists=false;
                for (var i = 0; i < api.model.roster.length; i++) {
                    if (api.model.roster[i].jid.user == data.jid.user) {   //domain missing you fixit!!
                            exists=true;
                            console.log("subcription",data.subscription); 
                            if(data.subscription=="remove"){
                                api.model.roster.splice(i,1);
                            }else{
                                api.model.roster[i]=data;
                            }
                            break;
                    }
                }
                if(!exists && data.subscription!=="remove"){
                    api.model.roster.push(data);
                }
                q.notify("xmpp.roster.push");
            });



            //presence handling
            api.socket.on('xmpp.presence', function(data) {
                var presence={
                    show:data.show,
                    status:data.status,
                    priority:data.priority,
                }
                if(api.model.roster){
                    for (var i = 0; i < api.model.roster.length; i++) {
                        if (api.model.roster[i].jid.user == data.from.user && api.model.roster[i].jid.domain == data.from.domain) {  
                            api.model.roster[i].presence = presence;
                            if(data.show=="offline"){
                                delete api.model.roster[i].presence;
                            }
                        }
                    }
                }
                if (api.model.me.jid.user == data.from.user && api.model.me.jid.domain == data.from.domain) {  
                    api.model.me.presence = presence;
                }
                q.notify("xmpp.presence");
            });
            api.socket.on('xmpp.error', function(error) {
                api.model.errors.unshift(error);
                q.notify("xmpp.error");
            });

            api.socket.on('xmpp.presence.subscribe', function(data) {
                 if(api.model.roster){
                    for (var i = 0; i < api.model.roster.length; i++) {
                        if (api.model.roster[i].jid.user == data.from.user && api.model.roster[i].jid.domain == data.from.domain) {  
                            api.model.roster[i].ask = "subscribe";
                        }
                    }
                }
                console.log('-----------------------------------------xmpp.presence.subscribe',data,api.model.roster);
            });
            api.socket.on('xmpp.presence.subscribed', function(data) {
                console.log('-----------------------------------------xmpp.presence.subscribed',data);
            });
            return q.promise;
        }

        function send(command,request){
            console.log("send",command,request);
            if(!request)request={};
            switch(command){
                case 'xmpp.login':
                case 'xmpp.login.anonymous':
                    var q=$q.defer();
                    if(!request){
                        q.reject("missing parameters for login");
                    }
                    api.socket.on('xmpp.connection', function(data) {
                        if(command=="xmpp.login.anonymous"){
                            api.model.anonymous=true;
                        }
                        if(command=="xmpp.login"){
                            api.model.anonymous=false;
                        }
                        q.resolve(data);
                        api.q.notify(command);
                    });
                    api.model.credentials={command:command, request:request};  
                    api.socket.send(command, request);
                    return q.promise;
                    break;
                case 'xmpp.logout':
                    var q=$q.defer();
                    api.socket.send(
                        'xmpp.logout',
                        {},
                        function(error, data) {
                            if(error){
                                console.log(error);
                            }else{
                                api.model.me=null;
                                api.model.connected=false;
                                api.q.notify("logout");
                                q.resolve("logout");
                            }
                        }
                    );
                    return q.promise;
                    break;
                case 'xmpp.chat.message':
                    api.messages.send(request);
                    break;
                case 'xmpp.roster.get':
                case 'xmpp.roster.add':
                case 'xmpp.roster.remove':
                case 'xmpp.discover.items':
                    var q=$q.defer();
                    api.socket.send(
                        command, request,

                        function(error, data) {
                            switch(command){
                            case "xmpp.roster.get":
                                //replace content of roster array (but don't replace array);
                                api.model.roster.length=0;  //clear
                                for(var i=0;i<data.length;i++){
                                   api.model.roster.push(data[i]);
                                }
                                if(api.q){
                                    api.q.notify("roster");
                                }
                                q.resolve(command);
                                break;
                            case "xmpp.roster.remove":
                                for(var i=0;i<api.model.roster.length;i++){
                                    var item=api.model.roster[i];
                                    if(item.subscription=="remove"){
                                            api.model.roster.splice(i,1);
                                            break;
                                    }
                                }
                                api.q.notify("roster remove");
                                q.resolve(command);
                                break;
                            case 'xmpp.discover.items':
                                q.resolve(data);
                            }
                        }
                    );
                    return q.promise;

                    break;
                default:console.log(command,"no promise, fire and forget");
                    api.socket.send( command, request);
            }
        }

        function resetModel(){
            api.model={
                connected:null,
                roster:[],
                me:null,
                items:[],
                errors:[]

            }
            api.data=api.model; //outdated
        } 

        var api={
            jid:null,
            //user:null,
            socket:null,
            q:null,
            watch:function(){
                return watch();
            },
            connect:function(host){
                var q=$q.defer();
                if(api.socket){
                    q.resolve();
                }


                //no idea if needed poking to get stable connection
                 var options = {
                    transformer: 'socket.io',
                    parser: 'JSON',
                    transports: [
                        'websocket',
                        'htmlfile',
                        'xhr-polling',
                        'jsonp-polling'
                    ],
                    global: 'Buddycloud'
                };

                api.socket = new Primus(host,options);

                api.socket.on("open", function() {
                    q.resolve();
                });
                api.socket.on("error",function(error){
                        console.log("Primus error",error);
                });
                api.socket.on('disconnection', function (spark) {
                        console.log("Primus disconnect",spark);
                });
                api.socket.on('reconnect', function (spark) {
                        console.log("Primus reconnect",spark);
                        api.q.resolve("reconnect");

                });
                return q.promise;
            },

            
    /**
            * @method parseNodeString
            */
            parseNodeString:function(node){  
                    var n = node.indexOf('@');
                    var name=node.substring(0,n);
                    var domain=node.substring(n+1);
                    n = name.lastIndexOf('/');
                    name=name.substring(n+1);

                    n = domain.indexOf('/');
                    if(n!==-1){
                        domain=domain.substring(0,n);
                    }

                    n = node.lastIndexOf('/');
                    var type = node.substring(n + 1);

                    var jid=name+"@"+domain;
                    return {name:name,user:name,domain:domain,jid:jid,type:type};

            },
            /**
            * @method parseJidString
            */
            parseJidString:function(jid){   
                var domain=null;
                var resource=null;
                var parts=jid.split("@");
                var user=parts[0];
                var domainresource=parts[1];
                var n = name.indexOf('/');
                if(n==-1){
                    domain=domainresource;
                }else{
                    domain=domainresource.substring(0,n);
                    resource=domainresource.substring(n);
                }
                return({user:user,domain:domain,resource:resource});

            },
            addContact:function(jid){
                send('xmpp.presence.subscribe',{to:jid})
            },
            confirmContact:function(jid){
                send('xmpp.presence.subscribed',{to:jid})
            },
            removeContact:function(jid){
                api.send('xmpp.roster.remove',{jid:'test1@laos.buddycloud.com'});
            },
            watch:function(){
                return watch();
            },

            send:function(command,request){
                console.log(command,request);
                return send(command,request);
            }



        };
        resetModel();
        console.log("---------",host);
        api.connect(host);


        return api;
    };
    return q;
})





/*
To Array filter is hidden here, should go to helpers
*/

/*
.filter('toArray', function() {
    'use strict';

    return function(obj) {
        if (!(obj instanceof Object)) {
            return obj;
        }

        return Object.keys(obj).filter(function(key) {
            if (key.charAt(0) !== "$") {
                return key;
            }
        }).map(function(key) {
            return Object.defineProperty(obj[key], '$key', {
                __proto__: null,
                value: key
            });
        });
    };
})
*/


