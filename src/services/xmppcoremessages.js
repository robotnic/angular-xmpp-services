angular.module('XmppMessages', [])


.factory('MessagesFactory',['$q',function($q){
    return function(xmpp){

        function initjid(jid){
            if(!api.byjid[jid]){
                api.byjid[jid]={
                    items:[],
                    unread:0
                }
            }
        }

        //notify is used to apply changes (render html);
        function watch(q){
            xmpp.socket.on('xmpp.chat.message', function(message) {
                if(!message.delay){
                    message.receivetime=(new Date()).getTime();
                }
                message.from.jid=message.from.user+"@"+message.from.domain;
                initjid(message.from.jid);
                if(message.state){
                    if(message.state=="composing"){
                        api.byjid[message.from.jid].composing=true;
                    }
                    if(message.state=="paused"){
                        delete api.byjid[message.from.jid].composing;
                    }
                }

                if(message.content){

                    api.unread++;
                    api.topmessages[message.from.jid]=message;
                    api.byjid[message.from.jid].items.push(message);
                    api.byjid[message.from.jid].unread++;
                    delete api.byjid[message.from.jid].composing;
                }
                console.log(api.byjid);
                q.notify(message);
            });
        }


        var api={
            unread:0,
            topmessages:{},
            byjid:{},
/*
            byjid:{
                "robotnic@xy.com":{
                    unread:4,
                    composing:true,
                    items:[]    
                },
                "elke@xy.com":{
                    unread:4,
                    composing:false,
                    items:[]
                }
            }
*/
            watch:function(){
                return watch();
            },
            send:function(message) {
                xmpp.socket.send('xmpp.chat.message', message);
                message.sendtime=(new Date()).getTime();
                initjid(message.to);
                api.byjid[message.to].items.push(message);
                console.log(api.byjid);
            },
            markread:function(jid){
                initjid(jid);
                api.byjid[jid].unread=0;
                api.topmessages[jid]=[];
                var sum=0;
                for(var m in api.byjid){
                   sum+=api.byjid[m].unread;
                }
                api.unread=sum;
            }

        };
        watch(xmpp.q);
        return api;
    };
}])

